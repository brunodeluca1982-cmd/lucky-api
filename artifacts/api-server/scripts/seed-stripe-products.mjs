#!/usr/bin/env node
/**
 * One-time script: creates Lucky Pro products + prices in Stripe.
 * Run from the workspace root: node artifacts/api-server/scripts/seed-stripe-products.mjs
 *
 * Uses STRIPE_SECRET_KEY env var if available; otherwise falls back to Replit Connector.
 *
 * Plans:
 *   - Lucky Pro Anual   → BRL R$97.00 / year
 *   - Lucky Pro Mensal  → BRL R$29.90 / month
 */

// ── Get Stripe secret key ─────────────────────────────────────────────────────

async function getStripeSecretKey() {
  // Use user-supplied key if present
  const envKey = process.env["STRIPE_SECRET_KEY"];
  if (envKey) return envKey;

  // Fall back to Replit Connectors API
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const replIdentity = process.env["REPL_IDENTITY"];
  const webReplRenewal = process.env["WEB_REPL_RENEWAL"];
  const token = replIdentity
    ? "repl " + replIdentity
    : webReplRenewal
    ? "depl " + webReplRenewal
    : null;

  if (!hostname || !token) {
    throw new Error("STRIPE_SECRET_KEY not set and Replit Connector not available");
  }

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("target_env", "development");

  const res = await fetch(url.toString(), {
    headers: { "X-Replit-Token": token },
  });

  if (!res.ok) throw new Error(`Connectors API error: ${res.status} ${await res.text()}`);

  const json = await res.json();
  const item = json?.items?.[0];
  if (!item?.settings?.secret) throw new Error("No secret in Stripe connection settings");
  return item.settings.secret;
}

// ── Stripe REST helper ────────────────────────────────────────────────────────

async function stripePost(secretKey, path, body) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null) params.append(k, String(v));
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe error on ${path}: ${json.error?.message}`);
  return json;
}

async function stripeGet(secretKey, path) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe error on ${path}: ${json.error?.message}`);
  return json;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching Stripe credentials…");
  const secretKey = await getStripeSecretKey();
  const isLive = secretKey.startsWith("sk_live_");
  console.log(`Key mode: ${isLive ? "LIVE" : "TEST"}`);

  // If STRIPE_PRODUCT_ID is set, use that product — just ensure it has prices
  const productId = process.env["STRIPE_PRODUCT_ID"];
  if (productId) {
    console.log(`STRIPE_PRODUCT_ID is set: ${productId}`);
    console.log("Checking existing prices for this product…");
    const prices = await stripeGet(secretKey, `prices?product=${productId}&active=true`);
    if (prices.data.length > 0) {
      console.log("Existing prices:");
      for (const p of prices.data) {
        const interval = p.recurring?.interval ?? "one-time";
        console.log(`  - ${p.id}: ${p.currency.toUpperCase()} ${p.unit_amount / 100} / ${interval}`);
      }
      console.log("\n✅ Product already has prices. No seeding needed.");
      console.log("   The API server will use these prices for plan resolution.");
      return;
    }
    console.log("No active prices found for this product. Creating prices…");

    const annualPrice = await stripePost(secretKey, "prices", {
      product:                     productId,
      unit_amount:                 9700,
      currency:                    "brl",
      "recurring[interval]":       "year",
      "recurring[interval_count]": 1,
      "metadata[plan_type]":       "premium",
      "metadata[label]":           "annual",
    });
    console.log(`  → Annual price created: ${annualPrice.id}`);

    const monthlyPrice = await stripePost(secretKey, "prices", {
      product:                     productId,
      unit_amount:                 2990,
      currency:                    "brl",
      "recurring[interval]":       "month",
      "recurring[interval_count]": 1,
      "metadata[plan_type]":       "premium",
      "metadata[label]":           "monthly",
    });
    console.log(`  → Monthly price created: ${monthlyPrice.id}`);

    console.log("\n✅ Prices created! Restart the API server to sync.");
    return;
  }

  // No product ID — check existing products to avoid duplicates
  const existing = await stripeGet(secretKey, "products?active=true&limit=20");
  const existingNames = existing.data.map((p) => p.name);
  console.log("Existing products:", existingNames.length > 0 ? existingNames : "(none)");

  const plans = [
    {
      name:     "Lucky Pro Anual",
      desc:     "Acesso total ao Lucky Trip por um ano. R$97 cobrados anualmente.",
      amount:   9700,
      currency: "brl",
      interval: "year",
      label:    "annual",
    },
    {
      name:     "Lucky Pro Mensal",
      desc:     "Acesso total ao Lucky Trip por mês. Cancele quando quiser.",
      amount:   2990,
      currency: "brl",
      interval: "month",
      label:    "monthly",
    },
  ];

  for (const plan of plans) {
    if (existingNames.includes(plan.name)) {
      const existingProduct = existing.data.find((p) => p.name === plan.name);
      console.log(`⏭  Skipping "${plan.name}" — already exists (${existingProduct?.id})`);
      // List its prices
      const prices = await stripeGet(secretKey, `prices?product=${existingProduct.id}&active=true`);
      for (const p of prices.data) {
        console.log(`     price: ${p.id} / ${p.recurring?.interval}`);
      }
      continue;
    }

    console.log(`Creating product "${plan.name}"…`);
    const product = await stripePost(secretKey, "products", {
      name:                  plan.name,
      description:           plan.desc,
      "metadata[plan_type]": "premium",
      "metadata[label]":     plan.label,
    });
    console.log(`  → product id: ${product.id}`);

    const price = await stripePost(secretKey, "prices", {
      product:                     product.id,
      unit_amount:                 plan.amount,
      currency:                    plan.currency,
      "recurring[interval]":       plan.interval,
      "recurring[interval_count]": 1,
      "metadata[plan_type]":       "premium",
      "metadata[label]":           plan.label,
    });
    console.log(`  → price id: ${price.id} (${plan.interval})`);
  }

  console.log("\n✅ Done. Restart the API server so it picks up the new products.");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
