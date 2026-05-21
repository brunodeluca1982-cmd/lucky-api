/**
 * POST /api/friend/generate-itinerary
 *
 * Generates a curated day-by-day itinerary for a friend guide using Gemini.
 * Reads exclusively from Supabase (no invented data). Saves results to
 * public.friend_guide_itinerary_items.
 *
 * Body: { guide_slug: string }
 */

import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import { ai } from "@workspace/integrations-gemini-ai";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ── Supabase admin client (service role — bypasses RLS for writes) ────────────

function makeSupabaseAdmin() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface GuidePlace {
  id: string;
  nome: string;
  categoria: string | null;
  bairro: string | null;
  meu_olhar: string | null;
  is_highlight: boolean;
  ordem: number;
  curation_dimension: string | null;
}

interface ItineraryPeriodItem {
  place_id: string;
  reason: string;
}

interface ItineraryDay {
  day_number: number;
  area_focus: string;
  morning: ItineraryPeriodItem[];
  lunch: ItineraryPeriodItem[];
  afternoon: ItineraryPeriodItem[];
  dinner: ItineraryPeriodItem[];
  night: ItineraryPeriodItem[];
}

interface GeminiItinerary {
  guide_slug: string;
  days: ItineraryDay[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPrompt(guideSlug: string, places: GuidePlace[]): string {
  const placesJson = JSON.stringify(
    places.map((p) => ({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      bairro: p.bairro,
      meu_olhar: p.meu_olhar,
      is_highlight: p.is_highlight,
      ordem: p.ordem,
      curation_dimension: p.curation_dimension,
    })),
    null,
    2
  );

  return `Você é um assistente de curadoria de viagens premium. Você receberá uma lista de lugares reais e deve organizar um roteiro estruturado de 3 dias.

REGRAS ABSOLUTAS:
- Use APENAS os lugares da lista abaixo. Não invente lugares, restaurantes, hotéis ou experiências.
- Não repita o mesmo lugar em dias diferentes.
- Hotéis são sugestão de hospedagem, não precisam aparecer no roteiro diário.
- Se não houver dado suficiente para uma faixa do dia, deixe o array vazio ([]).
- Responda APENAS com JSON puro. Sem texto antes ou depois. Sem markdown. Sem código fence.

REGRAS DO ROTEIRO:
- Manhã: passeio leve, bairro, praia, café — prefira lugares com curation_dimension != "gastronomy" e != "nightlife"
- Almoço: restaurantes (categoria = "restaurante")
- Tarde: passeio, bairro, experiência
- Jantar: restaurantes e lugares especiais (categoria = "restaurante")
- Noite: bares, restaurantes mais especiais (categoria = "bar" ou nightlife)
- Agrupe por proximidade de bairro quando fizer sentido
- Priorize is_highlight = true

GUIDE SLUG: ${guideSlug}

LUGARES DISPONÍVEIS:
${placesJson}

FORMATO DE SAÍDA EXATO:
{
  "guide_slug": "${guideSlug}",
  "days": [
    {
      "day_number": 1,
      "area_focus": "Nome do bairro principal do dia",
      "morning": [{ "place_id": "uuid", "reason": "motivo breve em português" }],
      "lunch": [{ "place_id": "uuid", "reason": "motivo breve em português" }],
      "afternoon": [],
      "dinner": [{ "place_id": "uuid", "reason": "motivo breve em português" }],
      "night": []
    }
  ]
}

Responda agora com o JSON puro:`;
}

function validateItinerary(
  data: unknown,
  validPlaceIds: Set<string>
): GeminiItinerary {
  if (!data || typeof data !== "object") throw new Error("Resposta não é objeto");
  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.days)) throw new Error("Campo 'days' ausente ou inválido");

  const days = obj.days as ItineraryDay[];
  for (const day of days) {
    for (const period of ["morning", "lunch", "afternoon", "dinner", "night"] as const) {
      const items = day[period];
      if (!Array.isArray(items)) {
        day[period] = [];
        continue;
      }
      day[period] = items.filter((item) => {
        if (!item?.place_id) return false;
        if (!validPlaceIds.has(item.place_id)) {
          logger.warn({ place_id: item.place_id }, "Gemini returned unknown place_id — skipping");
          return false;
        }
        return true;
      });
    }
  }

  return {
    guide_slug: String(obj.guide_slug ?? ""),
    days,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post("/friend/generate-itinerary", async (req, res) => {
  const { guide_slug } = req.body as { guide_slug?: string };

  if (!guide_slug || typeof guide_slug !== "string") {
    res.status(400).json({ error: "guide_slug is required" });
    return;
  }

  const supabase = makeSupabaseAdmin();
  const log = logger.child({ guide_slug });

  try {
    // ── 1. Load guide ──
    log.info("Loading guide from Supabase");
    const { data: guide, error: guideErr } = await supabase
      .from("friend_guides")
      .select("id, slug, intro_text")
      .eq("slug", guide_slug)
      .single();

    if (guideErr || !guide) {
      log.error({ error: guideErr?.message }, "Guide not found");
      res.status(404).json({ error: `Guide '${guide_slug}' not found` });
      return;
    }

    // ── 2. Load places ──
    log.info({ guide_id: guide.id }, "Loading places");
    const { data: places, error: placesErr } = await supabase
      .from("friend_guide_places")
      .select("id, nome, categoria, bairro, meu_olhar, is_highlight, is_locked, ordem, curation_dimension")
      .eq("guide_id", guide.id)
      .order("ordem");

    if (placesErr) {
      log.error({ error: placesErr.message }, "Failed to load places");
      res.status(500).json({ error: "Failed to load places" });
      return;
    }

    if (!places || places.length === 0) {
      res.status(404).json({ error: "No places found for this guide" });
      return;
    }

    log.info({ count: places.length }, "Places loaded");

    // ── 3. Call Gemini ──
    const prompt = buildPrompt(guide_slug, places as GuidePlace[]);
    log.info("Calling Gemini");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    const rawText = response.text ?? "";
    log.info({ chars: rawText.length }, "Gemini response received");

    // ── 4. Parse + validate ──
    let parsed: unknown;
    try {
      const cleaned = rawText.replace(/^```(?:json)?|```$/gm, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      log.error({ rawText: rawText.slice(0, 500) }, "Failed to parse Gemini JSON");
      res.status(500).json({ error: "Gemini returned invalid JSON", raw: rawText.slice(0, 500) });
      return;
    }

    const validPlaceIds = new Set((places as GuidePlace[]).map((p) => p.id));
    const itinerary = validateItinerary(parsed, validPlaceIds);

    log.info({ days: itinerary.days.length }, "Itinerary validated");

    // ── 5. Clear existing itinerary for this guide ──
    log.info("Deleting existing itinerary items");
    const { error: deleteErr } = await supabase
      .from("friend_guide_itinerary_items")
      .delete()
      .eq("guide_id", guide.id);

    if (deleteErr) {
      log.error({ error: deleteErr.message }, "Failed to delete existing items");
      res.status(500).json({ error: "Failed to clear existing itinerary" });
      return;
    }

    // ── 6. Insert new itinerary items ──
    type InsertRow = {
      guide_id: string;
      place_id: string;
      day_number: number;
      period: string;
      item_order: number;
      note: string | null;
      title_override: null;
    };

    const rows: InsertRow[] = [];
    for (const day of itinerary.days) {
      const periods = ["morning", "lunch", "afternoon", "dinner", "night"] as const;
      for (const period of periods) {
        const items = day[period];
        items.forEach((item, idx) => {
          rows.push({
            guide_id: guide.id,
            place_id: item.place_id,
            day_number: day.day_number,
            period,
            item_order: idx + 1,
            note: item.reason ?? null,
            title_override: null,
          });
        });
      }
    }

    log.info({ rows: rows.length }, "Inserting itinerary items");

    if (rows.length > 0) {
      const { error: insertErr } = await supabase
        .from("friend_guide_itinerary_items")
        .insert(rows);

      if (insertErr) {
        log.error({ error: insertErr.message }, "Failed to insert itinerary items");
        res.status(500).json({ error: "Failed to save itinerary", detail: insertErr.message });
        return;
      }
    }

    log.info({ rows: rows.length }, "Itinerary saved successfully");

    res.json({
      ok: true,
      guide_slug,
      guide_id: guide.id,
      days_generated: itinerary.days.length,
      items_saved: rows.length,
      itinerary,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ error: msg }, "Unexpected error generating itinerary");
    res.status(500).json({ error: "Internal server error", detail: msg });
  }
});

export default router;
