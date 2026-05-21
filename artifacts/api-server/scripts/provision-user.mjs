/**
 * provision-user.mjs
 *
 * One-shot emergency script to provision premium for a specific user.
 * Usage: node scripts/provision-user.mjs <user_id>
 *
 * Writes app_metadata = { plan_type: "premium", access_until: null, plan_interval: "year" }
 * to the Supabase auth user via the admin API.
 *
 * Safe to run multiple times (idempotent).
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL             = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: node scripts/provision-user.mjs <user_id>");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`Provisioning premium for user ${userId}...`);

const { data, error } = await sb.auth.admin.updateUserById(userId, {
  app_metadata: {
    plan_type:     "premium",
    access_until:  null,
    plan_interval: "year",
  },
});

if (error) {
  console.error("ERROR:", error.message);
  process.exit(1);
}

console.log("SUCCESS. Updated user:", {
  id:           data.user.id,
  email:        data.user.email,
  app_metadata: data.user.app_metadata,
});
