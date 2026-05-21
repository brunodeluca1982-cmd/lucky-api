import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { WebhookHandlers } from "./webhookHandlers.js";
import { getUncachableStripeClient } from "./stripeClient.js";
import { storage } from "./storage.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());

// ── Stripe webhook — MUST be registered BEFORE express.json() ────────────────
// Stripe requires the raw body Buffer for signature verification.
// express.raw() is used ONLY for this route; all others get express.json().
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;

    if (!sig) {
      logger.warn("Stripe webhook received without signature header");
      return res.status(400).json({ error: "Missing stripe-signature header" });
    }

    // Load webhook secret from DB (managed webhook secret stored in stripe._managed_webhooks)
    const webhookSecret = await storage.getWebhookSecret();

    if (!webhookSecret) {
      logger.error(
        "No webhook secret found in stripe._managed_webhooks — " +
        "set STRIPE_WEBHOOK_SECRET env var or ensure the managed webhook is registered"
      );
      // Return 200 to avoid Stripe retrying; log for manual investigation
      return res.json({ received: true, warning: "no_webhook_secret" });
    }

    // 1. Verify signature + parse event
    let event: any;
    try {
      const stripe = await getUncachableStripeClient();
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch (err: any) {
      logger.error({ err }, "Stripe webhook signature verification failed");
      return res.status(400).json({ error: `Webhook signature error: ${err.message}` });
    }

    // 2. Respond 200 immediately — Stripe requires a fast response
    res.json({ received: true });

    // 3. Sync to stripe schema (stripe-replit-sync)
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
    } catch (err: any) {
      logger.error({ err }, "stripe-replit-sync processWebhook failed (non-fatal after 200)");
    }

    // 4. Business logic: update user_subscriptions + Supabase app_metadata
    try {
      await handleSubscriptionWebhook(event);
    } catch (err: any) {
      logger.error({ err }, "handleSubscriptionWebhook failed");
    }
  }
);

// ── Standard middleware ───────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;

// ── Webhook business logic ────────────────────────────────────────────────────

async function handleSubscriptionWebhook(event: any) {
  switch (event.type) {

    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription") break;

      const customerId     = session.customer as string;
      const subscriptionId = session.subscription as string;

      const sub = await storage.getSubscriptionByCustomerId(customerId);
      if (!sub) {
        logger.warn({ customerId }, "checkout.session.completed: no user_subscription found for customer");
        break;
      }

      // Fetch full subscription from Stripe to get period_end
      const stripe = await getUncachableStripeClient();
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      const rawEnd      = stripeSubscription.current_period_end;
      const periodEndMs = (rawEnd && rawEnd > 0) ? rawEnd * 1000 : null;
      const interval    = stripeSubscription.items.data[0]?.price?.recurring?.interval;

      await storage.upsertUserSubscription(sub.user_id, {
        stripe_subscription_id: subscriptionId,
        subscription_status:    stripeSubscription.status,
        plan_type:              interval ?? null,
      });

      await storage.provisionPremiumInSupabase(sub.user_id, periodEndMs, interval, {
        customerId,
        subscriptionId,
        status: stripeSubscription.status,
      });
      logger.info({ userId: sub.user_id, subscriptionId }, "Premium provisioned via checkout");
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId   = subscription.customer as string;
      const sub          = await storage.getSubscriptionByCustomerId(customerId);
      if (!sub) break;

      const interval          = subscription.items?.data?.[0]?.price?.recurring?.interval ?? null;
      const rawSubEnd         = subscription.current_period_end;
      const periodEndMs       = (rawSubEnd && rawSubEnd > 0) ? rawSubEnd * 1000 : null;

      await storage.upsertUserSubscription(sub.user_id, {
        stripe_subscription_id: subscription.id,
        subscription_status:    subscription.status,
        plan_type:              interval,
      });

      if (subscription.status === "active") {
        await storage.provisionPremiumInSupabase(sub.user_id, periodEndMs, interval ?? undefined, {
          customerId,
          subscriptionId: subscription.id,
          status: subscription.status,
        });
        logger.info({ userId: sub.user_id, status: subscription.status }, "Premium updated");
      } else if (["canceled", "unpaid", "paused"].includes(subscription.status)) {
        await storage.revokePremiumInSupabase(sub.user_id);
        logger.info({ userId: sub.user_id, status: subscription.status }, "Premium revoked");
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId   = subscription.customer as string;
      const sub          = await storage.getSubscriptionByCustomerId(customerId);
      if (!sub) break;

      await storage.upsertUserSubscription(sub.user_id, {
        stripe_subscription_id: subscription.id,
        subscription_status:    "canceled",
      });
      await storage.revokePremiumInSupabase(sub.user_id);
      logger.info({ userId: sub.user_id }, "Premium revoked — subscription canceled");
      break;
    }

    case "invoice.paid": {
      // Renewal — extend access_until
      const invoice    = event.data.object;
      const customerId = invoice.customer as string;
      const sub        = await storage.getSubscriptionByCustomerId(customerId);
      if (!sub || !invoice.subscription) break;

      const stripe = await getUncachableStripeClient();
      const stripeSubscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
      const rawInvEnd   = stripeSubscription.current_period_end;
      const periodEndMs = (rawInvEnd && rawInvEnd > 0) ? rawInvEnd * 1000 : null;
      const interval    = stripeSubscription.items.data[0]?.price?.recurring?.interval;

      await storage.upsertUserSubscription(sub.user_id, {
        stripe_subscription_id: stripeSubscription.id,
        subscription_status:    "active",
        plan_type:              interval ?? null,
      });
      await storage.provisionPremiumInSupabase(sub.user_id, periodEndMs, interval, {
        customerId,
        subscriptionId: stripeSubscription.id,
        status:         "active",
      });
      logger.info({ userId: sub.user_id }, "Premium renewed via invoice.paid");
      break;
    }

    case "invoice.payment_failed": {
      const invoice    = event.data.object;
      const customerId = invoice.customer as string;
      const sub        = await storage.getSubscriptionByCustomerId(customerId);
      if (!sub) break;

      await storage.upsertUserSubscription(sub.user_id, {
        subscription_status: "past_due",
      });
      // Don't revoke immediately — Stripe will retry; revoke on subscription.deleted
      logger.info({ userId: sub.user_id }, "Invoice payment failed — marked past_due");
      break;
    }

    default:
      break;
  }
}
