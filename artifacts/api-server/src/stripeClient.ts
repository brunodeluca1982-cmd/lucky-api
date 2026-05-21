/**
 * stripeClient.ts
 *
 * Authenticates with Stripe via the Replit Connectors API.
 * Credentials (publishable key + secret key) are fetched dynamically at runtime
 * using the REPL_IDENTITY / WEB_REPL_RENEWAL token — never stored as env vars.
 *
 * Integration: Stripe (connector:ccfg_stripe_01K611P4YQR0SZM11XFRQJC44Y)
 * Connection:  conn_stripe_01KNKTKSCKP3EG11BDVT8JQDA7
 */

import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";
import { logger } from "./lib/logger.js";

// ── Credential resolution ─────────────────────────────────────────────────────
// Priority: STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY env vars (user-supplied live keys)
//           → Replit Connector sandbox (fallback for development/testing)

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  // STRIPE_FORCE_SANDBOX=true forces Replit Connector (sandbox/test mode) even when live keys are
  // set. Only honoured in non-production environments (REPLIT_DEPLOYMENT !== "1").
  // Useful when live keys are blocked by IP restriction on shared hosting during development.
  const isProduction = process.env["REPLIT_DEPLOYMENT"] === "1";
  const forceSandbox = !isProduction && process.env["STRIPE_FORCE_SANDBOX"] === "true";

  // If the user supplied their own Stripe secret key AND sandbox is not forced, use them directly.
  const envSecret      = process.env["STRIPE_SECRET_KEY"];
  const envPublishable = process.env["STRIPE_PUBLISHABLE_KEY"] ?? "";
  if (envSecret && !forceSandbox) {
    // Strip any non-ASCII characters from the publishable key (copy-paste corruption guard)
    const cleanPk = envPublishable.replace(/[^\x20-\x7E]/g, "");
    if (!cleanPk) {
      throw new Error(
        "STRIPE_PUBLISHABLE_KEY is missing or invalid. " +
        "Set a valid pk_live_ (or pk_test_ in sandbox) key in Replit Secrets."
      );
    }
    return { publishableKey: cleanPk, secretKey: envSecret };
  }

  if (forceSandbox) {
    logger.info("STRIPE_FORCE_SANDBOX=true — using Replit Connector (sandbox mode, dev only)");
  }

  // Fall back to Replit Connectors API (sandbox / test mode)
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const xReplitToken = process.env["REPL_IDENTITY"]
    ? "repl " + process.env["REPL_IDENTITY"]
    : process.env["WEB_REPL_RENEWAL"]
      ? "depl " + process.env["WEB_REPL_RENEWAL"]
      : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found — REPL_IDENTITY and WEB_REPL_RENEWAL are both unset");
  }

  if (!hostname) {
    throw new Error("REPLIT_CONNECTORS_HOSTNAME is not set");
  }

  const targetEnv       = isProduction ? "production" : "development";
  const connectorName   = "stripe";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", connectorName);
  url.searchParams.set("environment", targetEnv);

  const response = await fetch(url.toString(), {
    headers: {
      Accept:           "application/json",
      "X-Replit-Token": xReplitToken,
    },
  });

  if (!response.ok) {
    throw new Error(`Connector API returned ${response.status}: ${await response.text()}`);
  }

  const data = await response.json() as { items?: any[] };
  const connectionSettings = data.items?.[0];

  if (!connectionSettings?.settings?.publishable || !connectionSettings?.settings?.secret) {
    throw new Error(`Stripe ${targetEnv} connection not found or missing keys`);
  }

  return {
    publishableKey: connectionSettings.settings.publishable as string,
    secretKey:      connectionSettings.settings.secret as string,
  };
}

// ── Stripe client (never cached per Replit guidelines) ───────────────────────

/**
 * Returns a fresh, authenticated Stripe client.
 * WARNING: Never cache this client. Call on every request.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, { apiVersion: "2025-06-30.basil" });
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey(): Promise<string> {
  const { secretKey } = await getCredentials();
  return secretKey;
}

// ── StripeSync singleton ─────────────────────────────────────────────────────

let _stripeSync: StripeSync | null = null;

/**
 * Returns a StripeSync instance for webhook processing and backfill.
 * Cached after first creation (the pool is long-lived).
 */
export async function getStripeSync(): Promise<StripeSync> {
  if (_stripeSync) return _stripeSync;

  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("DATABASE_URL must be set for StripeSync");

  const secretKey = await getStripeSecretKey();

  _stripeSync = new StripeSync({
    poolConfig: {
      connectionString: databaseUrl,
      max: 2,
    },
    stripeSecretKey: secretKey,
  });

  logger.info("StripeSync initialized");
  return _stripeSync;
}
