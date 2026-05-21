/**
 * stripe-webhook/index.ts
 *
 * Handles Stripe webhook events and updates access_levels + subscriptions tables.
 * Requires STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY secrets.
 *
 * User identity is extracted from:
 *   1. client_reference_id (priority — set by create-checkout)
 *   2. metadata.user_id (fallback — set on subscription_data and invoice subscription_details)
 *
 * Events handled:
 *   checkout.session.completed      → create subscription row, grant premium access
 *   customer.subscription.updated   → sync status and period end
 *   customer.subscription.deleted   → revoke premium access
 *   invoice.paid                    → extend access_until to new period end
 *   invoice.payment_failed          → mark subscription past_due (keep access until period ends)
 *
 * NOTE: Uses Deno.serve — required for current Supabase Edge Runtime.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Stripe signature verification ─────────────────────────────────────────────

async function verifyStripeSignature(
  payload:   string,
  sigHeader: string,
  secret:    string,
): Promise<boolean> {
  try {
    const parts = sigHeader.split(",").reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split("=");
      acc[k] = v;
      return acc;
    }, {});

    const timestamp = parts["t"];
    const sig       = parts["v1"];
    if (!timestamp || !sig) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
    const computed  = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return computed === sig;
  } catch {
    return false;
  }
}

// ── User ID extraction helpers ────────────────────────────────────────────────

function userIdFromSession(obj: Record<string, unknown>): string | null {
  // Priority: client_reference_id (most reliable — set explicitly in create-checkout)
  if (obj.client_reference_id && typeof obj.client_reference_id === "string") {
    return obj.client_reference_id;
  }
  // Fallback: metadata.user_id
  const meta = obj.metadata as Record<string, string> | undefined;
  return meta?.user_id ?? null;
}

function userIdFromSubscription(obj: Record<string, unknown>): string | null {
  const meta = obj.metadata as Record<string, string> | undefined;
  return meta?.user_id ?? null;
}

function userIdFromInvoice(obj: Record<string, unknown>): string | null {
  // invoice.subscription_details.metadata.user_id
  const details = obj.subscription_details as Record<string, unknown> | undefined;
  const meta    = details?.metadata as Record<string, string> | undefined;
  if (meta?.user_id) return meta.user_id;
  return null;
}

// ── Epoch seconds → ISO string ────────────────────────────────────────────────

function epochToIso(seconds: unknown): string | null {
  if (typeof seconds !== "number") return null;
  return new Date(seconds * 1000).toISOString();
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
      },
    });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return new Response("STRIPE_WEBHOOK_SECRET not configured", { status: 503 });
  }

  const payload   = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";

  const valid = await verifyStripeSignature(payload, sigHeader, webhookSecret);
  if (!valid) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")              ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const eventType = event.type as string;
  const obj       = (event.data as Record<string, unknown>)?.object as Record<string, unknown>;

  try {
    // ── checkout.session.completed ──────────────────────────────────────────
    if (eventType === "checkout.session.completed") {
      const userId = userIdFromSession(obj);
      if (!userId) {
        console.error("checkout.session.completed: no user_id found in client_reference_id or metadata");
        return new Response("No user_id", { status: 400 });
      }

      const stripeCustomerId     = obj.customer as string | null;
      const stripeSubscriptionId = obj.subscription as string | null;

      // Grant premium access — exact period will be corrected by invoice.paid
      const accessUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      await supa.from("access_levels").upsert(
        { user_id: userId, plan_type: "premium", access_until: accessUntil },
        { onConflict: "user_id" },
      );

      await supa.from("subscriptions").upsert(
        {
          user_id:                userId,
          stripe_customer_id:     stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          status:                 "active",
          current_period_end:     accessUntil,
        },
        { onConflict: "user_id" },
      );
    }

    // ── customer.subscription.updated ───────────────────────────────────────
    if (eventType === "customer.subscription.updated") {
      const userId = userIdFromSubscription(obj);
      if (!userId) {
        // Look up by stripe_subscription_id as fallback
        const { data } = await supa
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", obj.id as string)
          .maybeSingle();
        if (!data?.user_id) {
          console.error("customer.subscription.updated: no user_id found");
          return new Response("received", { status: 200 });
        }
      }

      const resolvedUserId = userId ?? (
        await supa.from("subscriptions").select("user_id").eq("stripe_subscription_id", obj.id as string).maybeSingle()
      ).data?.user_id;

      if (resolvedUserId) {
        const periodEnd = epochToIso(obj.current_period_end);
        const status    = (obj.status as string) ?? "active";

        await supa.from("subscriptions").update({
          status,
          current_period_end: periodEnd,
        }).eq("user_id", resolvedUserId);

        // Keep or revoke premium based on status
        if (status === "active" || status === "trialing") {
          await supa.from("access_levels").update({
            plan_type:    "premium",
            access_until: periodEnd,
          }).eq("user_id", resolvedUserId);
        }
      }
    }

    // ── customer.subscription.deleted ───────────────────────────────────────
    if (eventType === "customer.subscription.deleted") {
      const userId = userIdFromSubscription(obj);

      const resolvedUserId = userId ?? (
        await supa.from("subscriptions").select("user_id").eq("stripe_subscription_id", obj.id as string).maybeSingle()
      ).data?.user_id;

      if (resolvedUserId) {
        await supa.from("subscriptions").update({
          status: "canceled",
        }).eq("user_id", resolvedUserId);

        await supa.from("access_levels").update({
          plan_type:    "free",
          access_until: null,
        }).eq("user_id", resolvedUserId);
      }
    }

    // ── invoice.paid ────────────────────────────────────────────────────────
    if (eventType === "invoice.paid") {
      const userId  = userIdFromInvoice(obj);
      const periodEnd = epochToIso(obj.period_end);

      const resolvedUserId = userId ?? (
        await supa.from("subscriptions").select("user_id").eq("stripe_subscription_id", obj.subscription as string).maybeSingle()
      ).data?.user_id;

      if (resolvedUserId && periodEnd) {
        await supa.from("access_levels").update({
          plan_type:    "premium",
          access_until: periodEnd,
        }).eq("user_id", resolvedUserId);

        await supa.from("subscriptions").update({
          status:             "active",
          current_period_end: periodEnd,
        }).eq("user_id", resolvedUserId);
      }
    }

    // ── invoice.payment_failed ───────────────────────────────────────────────
    if (eventType === "invoice.payment_failed") {
      const userId = userIdFromInvoice(obj);

      const resolvedUserId = userId ?? (
        await supa.from("subscriptions").select("user_id").eq("stripe_subscription_id", obj.subscription as string).maybeSingle()
      ).data?.user_id;

      if (resolvedUserId) {
        await supa.from("subscriptions").update({
          status: "past_due",
        }).eq("user_id", resolvedUserId);
        // Keep access_levels unchanged — access continues until period ends
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status:  200,
    });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
    });
  }
});
