/**
 * storage.ts
 *
 * All data goes through Replit PostgreSQL (no Supabase DDL needed):
 *
 *   stripe.*                  — synced by stripe-replit-sync (read-only)
 *   public.user_subscriptions — user ↔ Stripe customer/subscription mapping (read-write)
 *
 * Supabase writes:
 *   - auth.users app_metadata (premium provisioning via admin API)
 *   - public.subscriptions    (subscription state)
 *   - public.access_levels    (access grants)
 *
 * Drizzle ORM via @workspace/db.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { userSubscriptionsTable, type UserSubscription } from "@workspace/db/schema";
import { createClient } from "@supabase/supabase-js";

export type { UserSubscription };

// ── Supabase admin client ────────────────────────────────────────────────────

function makeSupabaseAdmin() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Storage class ─────────────────────────────────────────────────────────────

export class Storage {

  // ── Webhook secret ───────────────────────────────────────────────────────

  private _webhookSecret: string | null = null;

  async getWebhookSecret(): Promise<string | null> {
    if (this._webhookSecret) return this._webhookSecret;

    // Priority 1: user-supplied env var
    const envSecret = process.env["STRIPE_WEBHOOK_SECRET"];
    if (envSecret) {
      this._webhookSecret = envSecret;
      return envSecret;
    }

    // Priority 2: stripe-replit-sync managed webhook secret
    try {
      const result = await db.execute(
        sql`SELECT secret FROM stripe._managed_webhooks LIMIT 1`
      );
      const secret = result.rows[0]?.secret as string | null;
      if (secret) this._webhookSecret = secret;
      return secret ?? null;
    } catch {
      return null;
    }
  }

  // ── Stripe schema reads (stripe-replit-sync, read-only) ──────────────────

  async listProductsWithPrices(active = true) {
    const result = await db.execute(sql`
      SELECT
        p.id           AS product_id,
        p.name         AS product_name,
        p.description  AS product_description,
        p.active       AS product_active,
        p.metadata     AS product_metadata,
        pr.id          AS price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active      AS price_active,
        pr.metadata    AS price_metadata
      FROM stripe.products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = ${active}
      ORDER BY p.created DESC, pr.unit_amount
    `);
    return result.rows;
  }

  async listProducts(active = true) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE active = ${active} ORDER BY created DESC`
    );
    return result.rows;
  }

  async getProduct(productId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}`
    );
    return result.rows[0] ?? null;
  }

  async getPricesForProduct(productId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE product = ${productId} AND active = true`
    );
    return result.rows;
  }

  async getPrice(priceId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE id = ${priceId}`
    );
    return result.rows[0] ?? null;
  }

  async getPriceByInterval(interval: string): Promise<{ id: string } | null> {
    const productId = process.env["STRIPE_PRODUCT_ID"] ?? null;
    const result = productId
      ? await db.execute(sql`
          SELECT id FROM stripe.prices
          WHERE active = true
            AND product = ${productId}
            AND (recurring::jsonb->>'interval') = ${interval}
          ORDER BY created DESC
          LIMIT 1
        `)
      : await db.execute(sql`
          SELECT id FROM stripe.prices
          WHERE active = true
            AND (recurring::jsonb->>'interval') = ${interval}
          ORDER BY created DESC
          LIMIT 1
        `);
    return (result.rows[0] as { id: string } | null) ?? null;
  }

  async getSubscriptionFromStripe(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return result.rows[0] ?? null;
  }

  // ── User subscription reads/writes (Drizzle — Replit DB) ─────────────────

  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    const rows = await db
      .select()
      .from(userSubscriptionsTable)
      .where(eq(userSubscriptionsTable.user_id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async upsertUserSubscription(
    userId: string,
    fields: Partial<Omit<UserSubscription, "id" | "user_id" | "created_at" | "updated_at">>
  ): Promise<UserSubscription> {
    const existing = await this.getUserSubscription(userId);

    if (existing) {
      const rows = await db
        .update(userSubscriptionsTable)
        .set({ ...fields, updated_at: new Date() })
        .where(eq(userSubscriptionsTable.user_id, userId))
        .returning();
      return rows[0]!;
    }

    const rows = await db
      .insert(userSubscriptionsTable)
      .values({ user_id: userId, ...fields })
      .returning();
    return rows[0]!;
  }

  async getSubscriptionByCustomerId(stripeCustomerId: string): Promise<UserSubscription | null> {
    const rows = await db
      .select()
      .from(userSubscriptionsTable)
      .where(eq(userSubscriptionsTable.stripe_customer_id, stripeCustomerId))
      .limit(1);
    return rows[0] ?? null;
  }

  // ── Supabase public.access_levels ─────────────────────────────────────────

  async upsertSupabaseAccessLevel(
    userId: string,
    _planType: string,
    accessUntil: Date | null,
  ): Promise<void> {
    // access_levels.plan_type check constraint only allows "free" | "premium"
    const planType = "premium";
    // null = lifetime; use far-future sentinel so NOT NULL columns stay valid
    const farFuture = new Date("2099-01-01T00:00:00.000Z");
    const until = accessUntil ?? farFuture;
    const sb = makeSupabaseAdmin();
    const { error } = await sb
      .from("access_levels")
      .upsert(
        {
          user_id:      userId,
          plan_type:    planType,
          access_until: until.toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (error) throw new Error(`upsertSupabaseAccessLevel: ${error.message}`);
  }

  async revokeSupabaseAccessLevel(userId: string): Promise<void> {
    const sb = makeSupabaseAdmin();
    const { error } = await sb
      .from("access_levels")
      .delete()
      .eq("user_id", userId);
    if (error) throw new Error(`revokeSupabaseAccessLevel: ${error.message}`);
  }

  // ── Supabase public.subscriptions ─────────────────────────────────────────
  // NOTE: subscriptions table has no unique constraint on user_id — use
  // update-first, then insert-if-missing pattern instead of upsert.

  async upsertSupabaseSubscription(
    userId: string,
    data: {
      stripe_customer_id?:     string;
      stripe_subscription_id?: string;
      status?:                 string;
      current_period_end?:     Date;
    }
  ): Promise<void> {
    const sb = makeSupabaseAdmin();
    const payload: Record<string, any> = {};
    if (data.stripe_customer_id)     payload["stripe_customer_id"]     = data.stripe_customer_id;
    if (data.stripe_subscription_id) payload["stripe_subscription_id"] = data.stripe_subscription_id;
    if (data.status)                 payload["status"]                  = data.status;
    if (data.current_period_end)     payload["current_period_end"]      = data.current_period_end.toISOString();

    // Try updating the existing row first
    const { data: updated, error: updateErr } = await sb
      .from("subscriptions")
      .update(payload)
      .eq("user_id", userId)
      .select("user_id");
    if (updateErr) throw new Error(`upsertSupabaseSubscription (update): ${updateErr.message}`);

    // If no row existed, insert a new one
    if (!updated || updated.length === 0) {
      const { error: insertErr } = await sb
        .from("subscriptions")
        .insert({ user_id: userId, ...payload });
      if (insertErr) throw new Error(`upsertSupabaseSubscription (insert): ${insertErr.message}`);
    }
  }

  // Read stripe_customer_id from Supabase subscriptions table (returns null if not found)
  async getSupabaseSubscription(userId: string): Promise<{
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    status?: string;
  } | null> {
    const sb = makeSupabaseAdmin();
    const { data, error } = await sb
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("user_id", userId)
      .limit(1)
      .single();
    if (error || !data) return null;
    return data as { stripe_customer_id?: string; stripe_subscription_id?: string; status?: string };
  }

  // Find user_id by Stripe customer ID (checks Supabase subscriptions table)
  async getSupabaseSubscriptionByCustomerId(customerId: string): Promise<{
    user_id: string;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    status?: string;
  } | null> {
    const sb = makeSupabaseAdmin();
    const { data, error } = await sb
      .from("subscriptions")
      .select("user_id, stripe_customer_id, stripe_subscription_id, status")
      .eq("stripe_customer_id", customerId)
      .limit(1)
      .single();
    if (error || !data) return null;
    return data as { user_id: string; stripe_customer_id?: string; stripe_subscription_id?: string; status?: string };
  }

  async revokeSupabaseSubscription(userId: string): Promise<void> {
    const sb = makeSupabaseAdmin();
    const { error } = await sb
      .from("subscriptions")
      .upsert(
        { user_id: userId, status: "canceled" },
        { onConflict: "user_id" }
      );
    if (error) throw new Error(`revokeSupabaseSubscription: ${error.message}`);
  }

  // ── Supabase app_metadata (premium provisioning) ──────────────────────────
  // app_metadata is admin-only — cannot be set by the client, so it's tamper-proof.

  /**
   * Grant premium:
   *   - Supabase auth app_metadata
   *   - public.subscriptions
   *   - public.access_levels
   */
  async provisionPremiumInSupabase(
    userId: string,
    accessUntilMs: number | null,
    interval?: string,
    stripeData?: {
      customerId?:     string;
      subscriptionId?: string;
      status?:         string;
    }
  ): Promise<void> {
    // null or 0 → lifetime access (e.g. 100% coupon with no_payment_required)
    const _accessUntilDate = (accessUntilMs && accessUntilMs > 0) ? new Date(accessUntilMs) : null;
    const accessUntil = (_accessUntilDate && !isNaN(_accessUntilDate.getTime())) ? _accessUntilDate : null;
    const planType = interval === "year" ? "annual" : interval === "month" ? "monthly" : (interval ?? "premium");

    // 1. Update auth app_metadata
    const sb = makeSupabaseAdmin();
    const { error: authError } = await sb.auth.admin.updateUserById(userId, {
      app_metadata: {
        plan_type:     "premium",
        access_until:  accessUntil ? accessUntil.toISOString() : null,
        plan_interval: interval ?? null,
      },
    });
    if (authError) throw new Error(`provisionPremiumInSupabase (auth): ${authError.message}`);

    // 2. Upsert access_levels (null → far-future handled inside)
    await this.upsertSupabaseAccessLevel(userId, planType, accessUntil);

    // 3. Upsert subscriptions (if we have Stripe data)
    if (stripeData) {
      await this.upsertSupabaseSubscription(userId, {
        stripe_customer_id:     stripeData.customerId,
        stripe_subscription_id: stripeData.subscriptionId,
        status:                 stripeData.status ?? "active",
        current_period_end:     accessUntil ?? undefined,
      });
    }
  }

  /**
   * Revoke premium:
   *   - Supabase auth app_metadata
   *   - public.access_levels (delete row)
   *   - public.subscriptions (set status=canceled)
   */
  async revokePremiumInSupabase(userId: string): Promise<void> {
    const sb = makeSupabaseAdmin();

    // 1. Clear auth app_metadata
    const { error: authError } = await sb.auth.admin.updateUserById(userId, {
      app_metadata: {
        plan_type:     null,
        access_until:  null,
        plan_interval: null,
      },
    });
    if (authError) throw new Error(`revokePremiumInSupabase (auth): ${authError.message}`);

    // 2. Remove access_levels row
    await this.revokeSupabaseAccessLevel(userId).catch(() => {});

    // 3. Mark subscription as canceled
    await this.revokeSupabaseSubscription(userId).catch(() => {});
  }
}

export const storage = new Storage();
