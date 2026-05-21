/**
 * stripeInit.ts
 *
 * Called once on server startup to:
 *   1. Optionally run stripe-replit-sync (only when using Replit sandbox/test connector)
 *   2. Register the managed webhook endpoint if using sandbox
 *   3. Run a backfill if using sandbox
 *
 * When STRIPE_SECRET_KEY is set (user's own live/test key), stripe-replit-sync
 * is NOT used — it only works with the Replit Connector. Webhook verification
 * still works via STRIPE_WEBHOOK_SECRET env var.
 *
 * Non-blocking: if anything fails, the server still boots normally.
 */

import { getStripeSync } from "./stripeClient.js";
import { logger } from "./lib/logger.js";

export async function initStripe(): Promise<void> {
  // If the user provided their own Stripe keys, skip stripe-replit-sync entirely.
  // Their webhook secret is read directly from STRIPE_WEBHOOK_SECRET env var,
  // and the stripe schema tables are populated from a previous sandbox backfill.
  const hasUserKeys = !!process.env["STRIPE_SECRET_KEY"];
  if (hasUserKeys) {
    logger.info(
      "STRIPE_SECRET_KEY detected — skipping stripe-replit-sync. " +
      "Webhook verification will use STRIPE_WEBHOOK_SECRET env var."
    );
    return;
  }

  // Replit Connector path (sandbox/test mode)
  const hasConnector =
    !!(process.env["REPL_IDENTITY"] || process.env["WEB_REPL_RENEWAL"]) &&
    !!process.env["REPLIT_CONNECTORS_HOSTNAME"];

  if (!hasConnector) {
    logger.warn("Replit Stripe connector env vars not found — skipping Stripe initialization");
    return;
  }

  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    logger.warn("DATABASE_URL is not set — skipping Stripe initialization");
    return;
  }

  // 1. Instantiate StripeSync
  let sync: any;
  try {
    sync = await getStripeSync();
  } catch (err) {
    logger.error({ err }, "Failed to initialize StripeSync");
    return;
  }

  // 2. Register managed webhook
  const rawDomains = process.env["REPLIT_DOMAINS"] ?? "";
  const domain = rawDomains.split(",")[0]?.trim();
  if (domain) {
    const webhookUrl = `https://${domain}/api/stripe/webhook`;
    try {
      logger.info({ webhookUrl }, "Registering managed Stripe webhook…");
      await sync.findOrCreateManagedWebhook?.(webhookUrl);
      logger.info("Stripe webhook registered");
    } catch (err) {
      logger.warn({ err }, "Stripe managed webhook registration skipped (may already exist)");
    }
  } else {
    logger.warn("REPLIT_DOMAINS is not set — skipping webhook registration");
  }

  // 3. Backfill Stripe data
  try {
    logger.info("Starting Stripe backfill…");
    await sync.syncBackfill?.();
    logger.info("Stripe backfill complete");
  } catch (err) {
    logger.warn({ err }, "Stripe backfill failed (non-fatal)");
  }
}
