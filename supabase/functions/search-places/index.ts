/**
 * search-places/index.ts
 *
 * Google Places Autocomplete + optional Place Details for the mobile app.
 *
 * POST body:
 *   action:    "autocomplete" | "details"
 *   query?:    string        (required for autocomplete)
 *   place_id?: string        (required for details)
 *   language?: string        (default "pt-BR")
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://maps.googleapis.com/maps/api/place";
const RIO_LATLNG = "-22.9068,-43.1729";

async function autocomplete(query: string, language: string, key: string) {
  const url =
    `${BASE}/autocomplete/json` +
    `?input=${encodeURIComponent(query)}` +
    `&location=${RIO_LATLNG}&radius=80000` +
    `&language=${language}` +
    `&key=${key}`;

  const res = await fetch(url);
  if (!res.ok) return { predictions: [] };
  const data = await res.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("Places autocomplete error:", data.status);
    return { predictions: [] };
  }

  const predictions = (data.predictions ?? []).slice(0, 6).map((p: any) => ({
    place_id:       p.place_id,
    description:    p.description,
    main_text:      p.structured_formatting?.main_text    ?? p.description,
    secondary_text: p.structured_formatting?.secondary_text ?? "",
  }));

  return { predictions };
}

async function details(placeId: string, language: string, key: string) {
  const url =
    `${BASE}/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    "&fields=geometry,formatted_address,name,url,types" +
    `&language=${language}` +
    `&key=${key}`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== "OK" || !data.result) return null;

  const r = data.result;
  return {
    place_id:          placeId,
    name:              r.name,
    formatted_address: r.formatted_address,
    lat:               r.geometry.location.lat,
    lng:               r.geometry.location.lng,
    google_maps_url:   r.url ?? `https://www.google.com/maps/place/?q=place_id:${placeId}`,
    types:             r.types ?? [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const GOOGLE_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
  if (!GOOGLE_KEY) {
    return new Response(
      JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const language = body.language ?? "pt-BR";

  if (body.action === "details") {
    if (!body.place_id) {
      return new Response(
        JSON.stringify({ error: "place_id required for details action" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
    const result = await details(body.place_id, language, GOOGLE_KEY);
    return new Response(
      JSON.stringify(result ?? { error: "Place not found" }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  // Default: autocomplete
  if (!body.query?.trim()) {
    return new Response(
      JSON.stringify({ predictions: [] }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const result = await autocomplete(body.query.trim(), language, GOOGLE_KEY);
  return new Response(
    JSON.stringify(result),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
