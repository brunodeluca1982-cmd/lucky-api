/**
 * geocode-batch/index.ts
 *
 * Enriches core place tables with real Google Maps geodata.
 * Reuses GOOGLE_MAPS_API_KEY + SUPABASE_SERVICE_ROLE_KEY secrets already
 * present in this project (shared with google-places / autopilot_geocode).
 *
 * Tables: restaurantes · stay_hotels · o_que_fazer_rio_v2 · lucky_list_rio_v2
 *
 * Confidence (Jaccard similarity on normalised name tokens):
 *   ≥ 0.80  HIGH   → write place_id, lat, lng, formatted_address, google_maps_url
 *   0.50–0.79 MEDIUM → mark low_confidence (no geo write)
 *   < 0.50  LOW    → skip, mark low_confidence
 *
 * POST body:
 *   tables?:     string[]  (default: all 4)
 *   batch_size?: number    (default 50, max 200)
 *   dry_run?:   boolean   (default false)
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLE_CONFIGS = {
  restaurantes:       { nameCol: "nome",       neighborhoodCol: "bairro" },
  stay_hotels:        { nameCol: "hotel_name", neighborhoodCol: "neighborhood_slug" },
  o_que_fazer_rio_v2: { nameCol: "nome",       neighborhoodCol: "bairro" },
  lucky_list_rio_v2:  { nameCol: "nome",       neighborhoodCol: "bairro" },
};

// ── Jaccard similarity on normalised tokens ───────────────────────────────────

function normTokens(s) {
  return new Set(
    s.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

function jaccardSim(a, b) {
  const ta = normTokens(a);
  const tb = normTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : intersection / union;
}

// ── Google Places helpers ─────────────────────────────────────────────────────

async function autocomplete(query, key) {
  const url =
    "https://maps.googleapis.com/maps/api/place/autocomplete/json" +
    `?input=${encodeURIComponent(query)}` +
    "&location=-22.9068,-43.1729&radius=80000&language=pt-BR" +
    `&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.predictions?.length) return [];
  return data.predictions.slice(0, 5).map((p) => ({
    placeId:     p.place_id,
    mainText:    p.structured_formatting?.main_text ?? p.description,
    description: p.description,
  }));
}

async function placeDetails(placeId, key) {
  const url =
    "https://maps.googleapis.com/maps/api/place/details/json" +
    `?place_id=${encodeURIComponent(placeId)}` +
    "&fields=geometry,formatted_address,name,url" +
    "&language=pt-BR" +
    `&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== "OK" || !data.result) return null;
  const r = data.result;
  return {
    lat:               r.geometry.location.lat,
    lng:               r.geometry.location.lng,
    formatted_address: r.formatted_address,
    normalized_name:   r.name,
    google_maps_url:   r.url ?? `https://www.google.com/maps/place/?q=place_id:${placeId}`,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const GOOGLE_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
  const SUPA_URL   = Deno.env.get("SUPABASE_URL")               ?? "";
  const SUPA_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")  ?? "";

  if (!GOOGLE_KEY) {
    return new Response(
      JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not set" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const body = req.method === "POST"
    ? await req.json().catch(() => ({}))
    : {};

  const requestedTables = body.tables ?? Object.keys(TABLE_CONFIGS);
  const batchSize       = Math.min(body.batch_size ?? 50, 200);
  const dryRun          = body.dry_run === true;

  const supabase = createClient(SUPA_URL, SUPA_KEY);
  const report   = {};

  for (const table of requestedTables) {
    const cfg = TABLE_CONFIGS[table];
    if (!cfg) continue;

    report[table] = { processed: 0, matched: 0, low_conf: 0, failed: 0, examples: [] };

    const { data: rows } = await supabase
      .from(table)
      .select(`id, ${cfg.nameCol}, ${cfg.neighborhoodCol}`)
      .is("place_id", null)
      .neq("geo_status", "matched")
      .limit(batchSize);

    if (!rows?.length) continue;

    for (const row of rows) {
      const rowId   = String(row.id);
      const srcName = String(row[cfg.nameCol] ?? "");
      const bairro  = String(row[cfg.neighborhoodCol] ?? "Rio de Janeiro");

      report[table].processed++;

      // ── Search ──
      const preds = await autocomplete(
        `${srcName} ${bairro} Rio de Janeiro`,
        GOOGLE_KEY,
      );

      if (!preds.length) {
        if (!dryRun) await supabase.from(table).update({ geo_status: "failed" }).eq("id", row.id);
        report[table].failed++;
        continue;
      }

      // ── Best match by Jaccard similarity ──
      let bestScore = 0;
      let bestPred  = null;
      for (const p of preds) {
        const s = jaccardSim(srcName, p.mainText);
        if (s > bestScore) { bestScore = s; bestPred = p; }
      }

      if (!bestPred || bestScore < 0.50) {
        if (!dryRun) {
          await supabase.from(table).update({
            match_confidence: bestScore,
            geo_status:       "low_confidence",
          }).eq("id", row.id);
        }
        report[table].low_conf++;
        if (report[table].examples.length < 3) {
          report[table].examples.push({
            src: srcName, candidate: bestPred?.mainText ?? "(none)",
            score: Math.round(bestScore * 100) / 100, status: "low_confidence",
          });
        }
        continue;
      }

      if (bestScore < 0.80) {
        if (!dryRun) {
          await supabase.from(table).update({
            match_confidence: bestScore,
            geo_status:       "low_confidence",
            normalized_name:  bestPred.mainText,
          }).eq("id", row.id);
        }
        report[table].low_conf++;
        if (report[table].examples.length < 3) {
          report[table].examples.push({
            src: srcName, candidate: bestPred.mainText,
            score: Math.round(bestScore * 100) / 100, status: "low_confidence",
          });
        }
        continue;
      }

      // ── HIGH confidence → fetch coords ──
      const details = await placeDetails(bestPred.placeId, GOOGLE_KEY);
      if (!details) {
        if (!dryRun) {
          await supabase.from(table).update({
            match_confidence: bestScore, geo_status: "failed",
          }).eq("id", row.id);
        }
        report[table].failed++;
        continue;
      }

      if (!dryRun) {
        await supabase.from(table).update({
          place_id:          bestPred.placeId,
          lat:               details.lat,
          lng:               details.lng,
          formatted_address: details.formatted_address,
          google_maps_url:   details.google_maps_url,
          normalized_name:   details.normalized_name,
          match_confidence:  bestScore,
          geo_status:        "matched",
        }).eq("id", row.id);
      }

      report[table].matched++;
      if (report[table].examples.length < 5) {
        report[table].examples.push({
          src: srcName, candidate: details.normalized_name,
          place_id: bestPred.placeId,
          score: Math.round(bestScore * 100) / 100, status: "matched",
        });
      }

      // 120ms delay → ~8 QPS, well under Google's 10 QPS default limit
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  const totals = Object.values(report).reduce(
    (acc, r) => {
      acc.processed += r.processed;
      acc.matched   += r.matched;
      acc.low_conf  += r.low_conf;
      acc.failed    += r.failed;
      return acc;
    },
    { processed: 0, matched: 0, low_conf: 0, failed: 0 },
  );

  return new Response(
    JSON.stringify({ dry_run: dryRun, summary: totals, tables: report }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
