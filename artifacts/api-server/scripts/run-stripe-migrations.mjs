/**
 * run-stripe-migrations.mjs
 *
 * Runs stripe-replit-sync migrations before the server starts.
 * Executed as a pre-start step (see package.json "dev" / "start" scripts).
 *
 * This must run as a standalone Node ESM script (NOT through esbuild),
 * because runMigrations relies on __dirname to find SQL migration files.
 */

import { runMigrations } from 'stripe-replit-sync';

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  console.warn('[stripe-migrations] DATABASE_URL not set — skipping');
  process.exit(0);
}

try {
  console.log('[stripe-migrations] Running stripe-replit-sync migrations…');
  await runMigrations({ databaseUrl });
  console.log('[stripe-migrations] Done');
} catch (err) {
  console.error('[stripe-migrations] Failed:', err.message);
  // Non-fatal in dev — server still boots
  process.exit(0);
}
