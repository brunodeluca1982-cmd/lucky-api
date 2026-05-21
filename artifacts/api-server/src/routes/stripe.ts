/**
 * routes/stripe.ts
 *
 * Stripe is handled 100% in this API server. No Supabase Edge Functions.
 *
 * Endpoints:
 *   GET  /api/stripe/products             — list active products + prices (public)
 *   POST /api/stripe/checkout             — create Stripe Checkout session (auth required)
 *   GET  /api/stripe/subscription         — get user's subscription status (auth required)
 *   GET  /api/stripe/verify-session       — verify a checkout session by ID (auth required)
 *   POST /api/stripe/portal               — create billing portal session (auth required)
 *   GET  /api/stripe/publishable-key      — return publishable key for client (public)
 *
 * Price resolution order:
 *   1. STRIPE_PRICE_ID env var (single price — preferred for live)
 *   2. plan name → STRIPE_PRICE_ID_ANNUAL / MONTHLY / WEEKLY env vars (legacy)
 *   3. DB lookup from stripe.prices (stripe-replit-sync)
 *
 * Auth: Bearer token (Supabase JWT) in Authorization header.
 */

import { Router, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { storage } from "../storage.js";
import { stripeService } from "../stripeService.js";
import { getStripePublishableKey, getUncachableStripeClient } from "../stripeClient.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── Supabase auth helper ──────────────────────────────────────────────────────

async function getUserFromRequest(req: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  const url        = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) return null;

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}

function requireAuth(
  handler: (req: Request & { user: { id: string; email?: string } }, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    await handler(Object.assign(req, { user }), res);
  };
}

// ── Price resolution ──────────────────────────────────────────────────────────
// Priority:
//   1. Explicit price_... ID (passed directly by caller)
//   2. Plan-specific env var: STRIPE_PRICE_ID_ANNUAL / MONTHLY / WEEKLY
//   3. DB lookup by billing interval (year/month/week) — reflects Stripe catalogue
//   4. STRIPE_PRICE_ID env var (single catch-all fallback for unknown plans)

const PLAN_TO_INTERVAL: Record<string, string> = {
  annual:  "year",
  monthly: "month",
  weekly:  "week",
};

async function resolvePriceId(planOrPriceId: string): Promise<string | null> {
  // Direct price ID — use as-is
  if (planOrPriceId.startsWith("price_")) return planOrPriceId;

  // Priority 1: plan-specific env var (STRIPE_PRICE_ID_ANNUAL / MONTHLY / WEEKLY)
  const envKey = `STRIPE_PRICE_ID_${planOrPriceId.toUpperCase()}`;
  const envVal = process.env[envKey];
  if (envVal) return envVal;

  // Priority 2: DB lookup by billing interval (most reliable — reflects actual Stripe catalogue)
  const interval = PLAN_TO_INTERVAL[planOrPriceId];
  if (interval) {
    const price = await storage.getPriceByInterval(interval);
    if (price?.id) return price.id;
  }

  // Priority 3: single STRIPE_PRICE_ID env var (catch-all fallback for unknown plans)
  const singlePriceId = process.env["STRIPE_PRICE_ID"];
  if (singlePriceId) return singlePriceId;

  return null;
}

// ── GET /api/stripe/publishable-key ──────────────────────────────────────────

router.get("/publishable-key", async (_req, res) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (err: any) {
    logger.error({ err }, "GET /publishable-key failed");
    res.status(500).json({ error: "Failed to get publishable key" });
  }
});

// ── GET /api/stripe/products ──────────────────────────────────────────────────

router.get("/products", async (_req, res) => {
  try {
    const rows = await storage.listProductsWithPrices();

    const productsMap = new Map<string, any>();
    for (const row of rows) {
      if (!productsMap.has(row.product_id as string)) {
        productsMap.set(row.product_id as string, {
          id:          row.product_id,
          name:        row.product_name,
          description: row.product_description,
          active:      row.product_active,
          prices:      [],
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id as string).prices.push({
          id:          row.price_id,
          unit_amount: row.unit_amount,
          currency:    row.currency,
          recurring:   row.recurring,
          active:      row.price_active,
        });
      }
    }

    res.json({ data: Array.from(productsMap.values()) });
  } catch (err: any) {
    logger.error({ err }, "GET /products failed");
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ── POST /api/stripe/checkout ─────────────────────────────────────────────────

router.post(
  "/checkout",
  requireAuth(async (req, res) => {
    try {
      const { plan, price_id: rawPriceId, success_url, cancel_url } = req.body as {
        plan?:        string;
        price_id?:    string;
        success_url?: string;
        cancel_url?:  string;
      };

      // Resolve price ID
      const planOrId = plan ?? rawPriceId ?? "monthly";
      const priceId = await resolvePriceId(planOrId);

      if (!priceId) {
        return res.status(400).json({
          error:
            `No active Stripe price found for plan "${planOrId}". ` +
            "Set the STRIPE_PRICE_ID env var with your live price ID.",
        }) as any;
      }

      // Build success / cancel URLs — always use an absolute HTTPS base.
      // The client may send a relative URL if EXPO_PUBLIC_APP_ORIGIN is not set;
      // in that case, fall back to the server's known domain so Stripe can redirect correctly.
      const serverOrigin =
        process.env["APP_ORIGIN"] ||
        (process.env["REPLIT_DOMAINS"]
          ? `https://${process.env["REPLIT_DOMAINS"]!.split(",")[0]}`
          : "https://example.com");

      const isAbsolute = (u?: string) => typeof u === "string" && /^https:\/\//i.test(u);

      const successUrl = isAbsolute(success_url)
        ? success_url!
        : `${serverOrigin}/post-purchase?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = isAbsolute(cancel_url)
        ? cancel_url!
        : `${serverOrigin}/subscription`;

      // Find or create Stripe customer — check Supabase first, then Replit DB fallback
      const sbSub    = await storage.getSupabaseSubscription(req.user.id);
      const replitSub = sbSub?.stripe_customer_id ? null : await storage.getUserSubscription(req.user.id);
      let customerId  = sbSub?.stripe_customer_id ?? replitSub?.stripe_customer_id ?? null;

      if (!customerId) {
        const customer = await stripeService.createCustomer(req.user.email ?? "", req.user.id);
        customerId = customer.id;
        await storage.upsertUserSubscription(req.user.id, { stripe_customer_id: customerId });
        await storage.upsertSupabaseSubscription(req.user.id, { stripe_customer_id: customerId }).catch(() => {});
        logger.info({ userId: req.user.id, customerId }, "Stripe customer created");
      }

      // Create checkout session — if the stored customer doesn't exist in the current Stripe
      // environment (e.g. test → live switch), create a fresh customer and retry once.
      let session: Awaited<ReturnType<typeof stripeService.createCheckoutSession>>;
      try {
        session = await stripeService.createCheckoutSession(
          customerId,
          priceId,
          successUrl,
          cancelUrl,
          req.user.email,
        );
      } catch (stripeErr: any) {
        const isNoSuchCustomer =
          stripeErr?.code === "resource_missing" &&
          stripeErr?.message?.toLowerCase().includes("no such customer");

        if (!isNoSuchCustomer) throw stripeErr;

        logger.warn({ userId: req.user.id, oldCustomerId: customerId },
          "Stripe customer not found in current environment — creating fresh customer");

        const freshCustomer = await stripeService.createCustomer(req.user.email ?? "", req.user.id);
        customerId = freshCustomer.id;
        await storage.upsertUserSubscription(req.user.id, { stripe_customer_id: customerId });

        session = await stripeService.createCheckoutSession(
          customerId,
          priceId,
          successUrl,
          cancelUrl,
          req.user.email,
        );
      }

      logger.info({ userId: req.user.id, sessionId: session.id, priceId }, "Checkout session created");
      res.json({ url: session.url, session_id: session.id });
    } catch (err: any) {
      logger.error({ err }, "POST /checkout failed");
      res.status(500).json({ error: err.message ?? "Failed to create checkout session" });
    }
  })
);

// ── GET /api/stripe/verify-session ───────────────────────────────────────────

router.get(
  "/verify-session",
  requireAuth(async (req, res) => {
    try {
      const sessionId = req.query.session_id as string;
      if (!sessionId) {
        return res.status(400).json({ error: "session_id query param required" }) as any;
      }

      const stripe  = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });

      // Accept "paid" OR "no_payment_required" (100% coupon), only when session is complete
      const isComplete  = session.status === "complete";
      const isPaymentOk = session.payment_status === "paid"
        || session.payment_status === "no_payment_required";
      if (!isComplete || !isPaymentOk) {
        return res.json({ confirmed: false, payment_status: session.payment_status }) as any;
      }

      const customerId = session.customer as string;
      // Check Supabase first, then fall back to Replit DB
      const sbSubByCust = await storage.getSupabaseSubscriptionByCustomerId(customerId);
      let sub = sbSubByCust ?? await storage.getSubscriptionByCustomerId(customerId);
      if (!sub) sub = await storage.getUserSubscription(req.user.id);

      if (sub || session.customer) {
        const stripeSubscription = typeof session.subscription === "string"
          ? await stripe.subscriptions.retrieve(session.subscription)
          : (session.subscription as any);

        if (stripeSubscription) {
          // Guard: current_period_end can be 0 or null for no_payment_required sessions
          const rawEnd      = stripeSubscription.current_period_end;
          const periodEndMs = (rawEnd && rawEnd > 0) ? rawEnd * 1000 : null;
          const interval    = stripeSubscription.items.data[0]?.price?.recurring?.interval;

          await storage.upsertUserSubscription(req.user.id, {
            stripe_customer_id:     customerId,
            stripe_subscription_id: stripeSubscription.id,
            subscription_status:    stripeSubscription.status,
            plan_type:              interval ?? null,
          });

          await storage.provisionPremiumInSupabase(
            req.user.id,
            periodEndMs,
            interval,
            {
              customerId,
              subscriptionId: stripeSubscription.id,
              status:         stripeSubscription.status,
            }
          );
          logger.info({ userId: req.user.id, sessionId }, "Premium provisioned via verify-session");
        }
      }

      res.json({
        confirmed:           true,
        payment_status:      session.payment_status,
        subscription_status: "active",
      });
    } catch (err: any) {
      logger.error({ err }, "GET /verify-session failed");
      res.status(500).json({ error: err.message ?? "Failed to verify session" });
    }
  })
);

// ── GET /api/stripe/subscription ─────────────────────────────────────────────

router.get(
  "/subscription",
  requireAuth(async (req, res) => {
    try {
      // Supabase-first, then Replit DB fallback
      const sbSub = await storage.getSupabaseSubscription(req.user.id);
      const sub   = sbSub?.stripe_subscription_id ? sbSub : await storage.getUserSubscription(req.user.id);
      if (!sub?.stripe_subscription_id) {
        return res.json({ subscription: null }) as any;
      }

      const stripeSub = await storage.getSubscriptionFromStripe(sub.stripe_subscription_id);
      res.json({
        subscription: {
          ...sub,
          stripe_data: stripeSub ?? null,
        },
      });
    } catch (err: any) {
      logger.error({ err }, "GET /subscription failed");
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  })
);

// ── GET /api/stripe/sync-subscription ────────────────────────────────────────
// Healing endpoint: queries Stripe for the user's customer subscriptions and
// provisions premium in Supabase if an active subscription is found.
// Safe to call on every app foreground — idempotent.

router.get(
  "/sync-subscription",
  requireAuth(async (req, res) => {
    try {
      // Supabase-first, then Replit DB fallback
      const sbSub   = await storage.getSupabaseSubscription(req.user.id);
      const sub     = sbSub?.stripe_customer_id ? sbSub : await storage.getUserSubscription(req.user.id);
      if (!sub?.stripe_customer_id) {
        return res.json({ synced: false, reason: "no_customer" }) as any;
      }

      const stripe = await getUncachableStripeClient();
      const subscriptions = await stripe.subscriptions.list({
        customer: sub.stripe_customer_id,
        status:   "active",
        limit:    5,
      });

      const activeSub = subscriptions.data[0];
      if (!activeSub) {
        // Also check trialing
        const trialSubs = await stripe.subscriptions.list({
          customer: sub.stripe_customer_id,
          status:   "trialing",
          limit:    5,
        });
        const trialSub = trialSubs.data[0];
        if (!trialSub) {
          return res.json({ synced: false, reason: "no_active_subscription" }) as any;
        }
        // Provision from trialing subscription
        const _trialEnd   = trialSub.current_period_end;
        const periodEndMs = (_trialEnd && _trialEnd > 0) ? _trialEnd * 1000 : null;
        const interval    = trialSub.items.data[0]?.price?.recurring?.interval;
        await storage.upsertUserSubscription(req.user.id, {
          stripe_customer_id:     sub.stripe_customer_id,
          stripe_subscription_id: trialSub.id,
          subscription_status:    trialSub.status,
          plan_type:              interval ?? null,
        });
        await storage.provisionPremiumInSupabase(req.user.id, periodEndMs, interval, {
          customerId:     sub.stripe_customer_id,
          subscriptionId: trialSub.id,
          status:         trialSub.status,
        });
        logger.info({ userId: req.user.id, subId: trialSub.id }, "Premium synced (trialing)");
        return res.json({ synced: true, status: trialSub.status }) as any;
      }

      // Provision from active subscription
      const _activeEnd  = activeSub.current_period_end;
      const periodEndMs = (_activeEnd && _activeEnd > 0) ? _activeEnd * 1000 : null;
      const interval    = activeSub.items.data[0]?.price?.recurring?.interval;

      await storage.upsertUserSubscription(req.user.id, {
        stripe_customer_id:     sub.stripe_customer_id,
        stripe_subscription_id: activeSub.id,
        subscription_status:    activeSub.status,
        plan_type:              interval ?? null,
      });

      await storage.provisionPremiumInSupabase(req.user.id, periodEndMs, interval, {
        customerId:     sub.stripe_customer_id,
        subscriptionId: activeSub.id,
        status:         activeSub.status,
      });

      logger.info({ userId: req.user.id, subId: activeSub.id }, "Premium synced (active)");
      res.json({ synced: true, status: activeSub.status });
    } catch (err: any) {
      logger.error({ err }, "GET /sync-subscription failed");
      res.status(500).json({ error: err.message ?? "Failed to sync subscription" });
    }
  })
);

// ── POST /api/stripe/portal ───────────────────────────────────────────────────

router.post(
  "/portal",
  requireAuth(async (req, res) => {
    try {
      // Supabase-first, then Replit DB fallback
      const sbSub = await storage.getSupabaseSubscription(req.user.id);
      const sub   = sbSub?.stripe_customer_id ? sbSub : await storage.getUserSubscription(req.user.id);
      if (!sub?.stripe_customer_id) {
        return res.status(400).json({ error: "No Stripe customer found for this user" }) as any;
      }

      const appOrigin =
        process.env["APP_ORIGIN"] ||
        (process.env["REPLIT_DOMAINS"]
          ? `https://${process.env["REPLIT_DOMAINS"]!.split(",")[0]}`
          : "https://example.com");

      const returnUrl     = req.body.return_url ?? appOrigin;
      const portalSession = await stripeService.createCustomerPortalSession(
        sub.stripe_customer_id,
        returnUrl,
      );

      res.json({ url: portalSession.url });
    } catch (err: any) {
      logger.error({ err }, "POST /portal failed");
      res.status(500).json({ error: "Failed to create portal session" });
    }
  })
);

export default router;
