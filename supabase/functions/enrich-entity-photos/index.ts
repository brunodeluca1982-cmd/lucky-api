/**
 * enrich-entity-photos/index.ts
 *
 * Fetches real photos from Google Places for entity table rows that lack photo_url.
 * Writes back to the entity table and caches in place_photos.
 *
 * Runs until ALL rows with photo_url IS NULL are processed (no LIMIT).
 * Works in batches of 20–50 rows to keep each Google-API burst manageable.
 * Rows that permanently fail (not found / no photo) are skipped in
 * subsequent batches so the loop always terminates.
 *
 * POST body:
 *   table?:        "stay_hotels" | "lucky_list_rio_v2" | "restaurantes" | "o_que_fazer_rio_v2"
 *                   (default: all four)
 *   batch_size?:   number  (default 20, max 50)
 *   force?:        boolean (default false — skip rows that already have photo_url)
 *   max_batches?:  number  (default 200 — hard safety cap per table)
 *
 * Uses GOOGLE_MAPS_API_KEY + SUPABASE_SERVICE_ROLE_KEY from Supabase secrets.
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Table config ──────────────────────────────────────────────────────────────
//
// activeCol: column used to filter active rows.
//   - null means the table has no active/ativo column → no filter applied.
//   - v2 tables (o_que_fazer_rio_v2, lucky_list_rio_v2) have an `ativo` column.

interface TableConfig {
  nameCol:         string;
  neighborhoodCol: string;
  activeCol:       string | null;
}

const TABLE_CONFIGS: Record<string, TableConfig> = {
  restaurantes:       { nameCol: "nome",       neighborhoodCol: "bairro",            activeCol: "ativo"  },
  stay_hotels:        { nameCol: "hotel_name", neighborhoodCol: "neighborhood_slug", activeCol: "active" },
  o_que_fazer_rio_v2: { nameCol: "nome",       neighborhoodCol: "bairro",            activeCol: "ativo"  },
  lucky_list_rio_v2:  { nameCol: "nome",       neighborhoodCol: "bairro",            activeCol: "ativo"  },
};

// ── Google Places helpers ─────────────────────────────────────────────────────

async function findPlace(
  query: string,
  key: string,
): Promise<{ placeId: string; photoRef: string | null } | null> {
  const url =
    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json" +
    `?input=${encodeURIComponent(query + " Rio de Janeiro")}` +
    "&inputtype=textquery" +
    "&fields=place_id,photos" +
    `&key=${key}`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== "OK") return null;
  const candidate = data.candidates?.[0];
  if (!candidate?.place_id) return null;
  const photoRef = candidate.photos?.[0]?.photo_reference ?? null;
  return { placeId: candidate.place_id, photoRef };
}

async function getPhotoRef(placeId: string, key: string): Promise<string | null> {
  const url =
    "https://maps.googleapis.com/maps/api/place/details/json" +
    `?place_id=${placeId}` +
    "&fields=photos" +
    `&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.result?.photos?.[0]?.photo_reference ?? null;
}

/**
 * Resolve a photo_reference to a stable CDN URL (lh3.googleusercontent.com).
 *
 * Uses redirect:"follow" so Deno exposes the final URL via res.url after the
 * 302 redirect — a stable, keyless lh3.googleusercontent.com CDN URL.
 */
async function resolvePhotoCdnUrl(photoRef: string, key: string): Promise<string | null> {
  const apiUrl =
    "https://maps.googleapis.com/maps/api/place/photo" +
    `?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${key}`;
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) return null;

    const finalUrl = res.url;
    if (finalUrl && finalUrl.startsWith("http") && !finalUrl.includes("googleapis.com/maps/api")) {
      return finalUrl;
    }

    return null;
  } catch {
    return null;
  }
}

async function enrichRow(
  supabase: ReturnType<typeof createClient>,
  table: string,
  row: Record<string, unknown>,
  nameCol: string,
  neighborhoodCol: string,
  googleKey: string,
): Promise<{ id: string; status: string; url?: string }> {
  const id     = String(row.id);
  const name   = row[nameCol] as string;
  const bairro = (row[neighborhoodCol] as string) ?? "";

  // 1. Check place_photos cache — avoids any Google call if already enriched.
  const { data: cached } = await supabase
    .from("place_photos")
    .select("photo_url")
    .eq("item_id", id)
    .eq("item_type", table)
    .maybeSingle();

  if (cached?.photo_url) {
    await supabase
      .from(table)
      .update({ photo_url: cached.photo_url })
      .eq("id", id);
    return { id, status: "from_cache", url: cached.photo_url };
  }

  // 2. Find via Google Places — called ONCE per place.
  const query = `${name} ${bairro}`;
  const found = await findPlace(query, googleKey);
  if (!found) return { id, status: "not_found" };

  let photoRef = found.photoRef;
  if (!photoRef) {
    photoRef = await getPhotoRef(found.placeId, googleKey);
  }
  if (!photoRef) return { id, status: "no_photo_reference" };

  // 3. Resolve photo_reference → stable CDN URL.
  const cdnUrl = await resolvePhotoCdnUrl(photoRef, googleKey);
  if (!cdnUrl) return { id, status: "cdn_resolve_failed" };

  // 4. Write photo_url to entity table — permanently set, skipped on future runs.
  await supabase
    .from(table)
    .update({ photo_url: cdnUrl })
    .eq("id", id);

  // 5. Cache in place_photos — guards against entity table resets.
  await supabase
    .from("place_photos")
    .upsert(
      {
        item_id:               id,
        item_type:             table,
        place_query:           query,
        place_id:              found.placeId,
        photo_url:             cdnUrl,
        photo_source:          "google_places",
        photo_last_fetched_at: new Date().toISOString(),
        updated_at:            new Date().toISOString(),
      },
      { onConflict: "item_id,item_type" },
    );

  return { id, status: "enriched", url: cdnUrl };
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // ── DISABLED — Supabase-only photo policy. ────────────────────────────────
  // This function injected lh3.googleusercontent.com URLs into photo_url.
  // It is permanently disabled. photo_url must only come from Supabase storage.
  return new Response(
    JSON.stringify({ disabled: true, message: "enrich-entity-photos is disabled — Supabase-only photo policy enforced." }),
    { status: 403, headers: { ...CORS, "Content-Type": "application/json" } },
  );
  // ─────────────────────────────────────────────────────────────────────────

  const googleKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!googleKey) {
    return new Response(
      JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not set" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase    = createClient(supabaseUrl, serviceKey);

  const body       = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const tables     = body.tables     ?? Object.keys(TABLE_CONFIGS);
  const batchSize  = Math.min(Math.max(Number(body.batch_size  ?? 20), 1), 50);
  const force      = Boolean(body.force ?? false);
  const maxBatches = Number(body.max_batches ?? 200); // hard safety cap per table

  const summary: Record<string, unknown> = {};

  for (const table of tables) {
    const cfg = TABLE_CONFIGS[table];
    if (!cfg) { summary[table] = { error: "unknown table" }; continue; }

    const counts = { enriched: 0, from_cache: 0, not_found: 0, failed: 0, batches: 0 };

    // IDs that permanently failed this run — excluded from subsequent batches
    // so the loop always terminates even when Google can't find a place.
    const skipIds: string[] = [];

    for (let batchNum = 0; batchNum < maxBatches; batchNum++) {
      // ── Fetch next batch of rows still missing photo_url ────────────────
      let query = supabase
        .from(table)
        .select(`id, ${cfg.nameCol}, ${cfg.neighborhoodCol}`)
        .limit(batchSize);

      // Only tables with an active column get the active filter.
      if (cfg.activeCol) {
        query = query.eq(cfg.activeCol, true);
      }

      // Skip rows that already have a photo unless force=true.
      if (!force) {
        query = query.or("photo_url.is.null,photo_url.eq.");
      }

      // Exclude IDs that failed permanently earlier in this run.
      if (skipIds.length > 0) {
        query = query.not("id", "in", `(${skipIds.join(",")})`);
      }

      const { data: rows, error } = await query;

      if (error) {
        counts.failed++;
        console.error(`[enrich] ${table} batch ${batchNum} query error:`, error.message);
        break;
      }

      // Stop condition: no more rows with photo_url IS NULL.
      if (!rows?.length) break;

      counts.batches++;

      // ── Enrich all rows in this batch in parallel ────────────────────────
      const results = await Promise.allSettled(
        rows.map((row) =>
          enrichRow(
            supabase,
            table,
            row as Record<string, unknown>,
            cfg.nameCol,
            cfg.neighborhoodCol,
            googleKey,
          )
        ),
      );

      for (const r of results) {
        if (r.status === "rejected") {
          counts.failed++;
          continue;
        }
        const { id, status } = r.value;
        if (status === "enriched") {
          counts.enriched++;
        } else if (status === "from_cache") {
          counts.from_cache++;
        } else {
          // not_found | no_photo_reference | cdn_resolve_failed
          // Mark as permanently skipped so this ID is excluded from the
          // next batch query — prevents an infinite loop on bad rows.
          counts.not_found++;
          skipIds.push(id);
        }
      }
    }

    summary[table] = { ...counts, permanently_skipped: skipIds.length };
  }

  return new Response(
    JSON.stringify({ ok: true, summary }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
