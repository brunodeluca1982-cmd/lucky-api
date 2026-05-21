/**
 * Supabase connection test
 * Run: pnpm --filter @workspace/scripts tsx test-supabase.ts
 */
import { supabase } from "@workspace/supabase";

console.log("Supabase client created — running queries...\n");

// ── Query 1: stay_neighborhoods ─────────────────────────────────────────────
console.log("=== stay_neighborhoods (limit 5) ===");
const { data: neighborhoods, error: err1 } = await supabase
  .from("stay_neighborhoods")
  .select("*")
  .limit(5);

if (err1) {
  console.error("ERROR:", JSON.stringify(err1, null, 2));
} else {
  console.log("Rows returned:", neighborhoods?.length);
  if (neighborhoods && neighborhoods.length > 0) {
    console.log("Columns:", Object.keys(neighborhoods[0]).join(", "));
    console.log(JSON.stringify(neighborhoods, null, 2));
  } else {
    console.log("(empty result set)");
  }
}

// ── Query 2: v_stay_neighborhoods_with_hotels ────────────────────────────────
console.log("\n=== v_stay_neighborhoods_with_hotels (limit 5) ===");
const { data: view, error: err2 } = await supabase
  .from("v_stay_neighborhoods_with_hotels")
  .select("*")
  .limit(5);

if (err2) {
  console.error("ERROR:", JSON.stringify(err2, null, 2));
} else {
  console.log("Rows returned:", view?.length);
  if (view && view.length > 0) {
    console.log("Columns:", Object.keys(view[0]).join(", "));
    console.log(JSON.stringify(view, null, 2));
  } else {
    console.log("(empty result set)");
  }
}
