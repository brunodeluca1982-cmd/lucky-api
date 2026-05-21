import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type SavedCategory = "oQueFazer" | "restaurante" | "hotel" | "lucky";
type PeriodoDia    = "manha" | "almoco" | "tarde" | "noite";
type Vibe          = "tranquilo" | "moderado" | "intenso";
type Inspiration   = "gastronomy" | "culture" | "beach" | "adventure" | "lucky";

interface SerializableItem {
  id:          string;
  titulo:      string;
  categoria:   SavedCategory;
  localizacao: string;
}

interface Preferences {
  inspirations: Inspiration[];
  vibe:         Vibe | null;
}

interface RequestBody {
  savedItems:    SerializableItem[];
  destination:   string;
  preferences:   Preferences;
  requestedDays?: number;
  startDate?:    string;
  endDate?:      string;
}

interface DiaPeriodo {
  periodo: PeriodoDia;
  items:   SerializableItem[];
}

interface DiaRoteiro {
  numero:   number;
  bairro:   string;
  periodos: DiaPeriodo[];
}

interface ItineraryResult {
  destination: string;
  source:      "trip_saved_places";
  preferences: Preferences;
  summary: {
    totalDays:  number;
    totalItems: number;
  };
  days: DiaRoteiro[];
}

// ── Rio de Janeiro geographic zone map ────────────────────────────────────────
// Each bairro is assigned a zone number so nearby neighborhoods cluster together.
// Zones 1–6 run roughly South → Center → North/West.

const RIO_ZONE: Record<string, number> = {
  // 1 — Zona Sul praias (South Zone beaches)
  "Ipanema":          1,
  "Leblon":           1,
  "Arpoador":         1,
  "Copacabana":       1,
  "Leme":             1,
  "Vieira Souto":     1,
  "Delfim Moreira":   1,
  // 2 — Lagoa / Jardim Botânico / Gávea
  "Lagoa":            2,
  "Jardim Botânico":  2,
  "Gávea":            2,
  "Humaitá":          2,
  "Cosme Velho":      2,
  "Alto da Boa Vista":2,
  // 3 — Botafogo / Urca / Flamengo / Glória
  "Botafogo":         3,
  "Urca":             3,
  "Flamengo":         3,
  "Catete":           3,
  "Glória":           3,
  "Laranjeiras":      3,
  // 4 — Centro / Santa Teresa / Lapa / Praça XV
  "Centro":           4,
  "Santa Teresa":     4,
  "Lapa":             4,
  "Cinelândia":       4,
  "Praça XV":         4,
  "Saúde":            4,
  "Gamboa":           4,
  "Porto Maravilha":  4,
  // 5 — Barra / Recreio / West Zone
  "Barra da Tijuca":  5,
  "Barra":            5,
  "Recreio":          5,
  "Prainha":          5,
  "Grumari":          5,
  "Joá":              5,
  // 6 — North Zone / Tijuca
  "Tijuca":           6,
  "Maracanã":         6,
  "São Cristóvão":    6,
  "Cristó":           6, // shorthand that appears in data
  "Ramos":            6,
  "Penha":            6,
  "Méier":            6,
  "Ilha do Governador": 6,
  "Ilha":             6,
};

/** Return zone 1–6 for a bairro, or 99 for unknown. */
function getZone(localizacao: string): number {
  const s = (localizacao ?? "").trim();
  if (RIO_ZONE[s] !== undefined) return RIO_ZONE[s];
  // partial / case-insensitive fallback
  for (const [key, z] of Object.entries(RIO_ZONE)) {
    if (s.toLowerCase().includes(key.toLowerCase())) return z;
  }
  return 99;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VIBE_ITEMS_PER_DAY: Record<Vibe, number> = {
  tranquilo: 3,
  moderado:  4,
  intenso:   6,
};

// ── Validation helpers ────────────────────────────────────────────────────────

function getSavedPlacesForUser(raw: SerializableItem[]): SerializableItem[] {
  return (raw ?? []).filter(
    (i) =>
      i &&
      typeof i.id          === "string" &&
      typeof i.titulo      === "string" &&
      typeof i.categoria   === "string" &&
      typeof i.localizacao === "string",
  );
}

function computeTripLength(
  items: SerializableItem[],
  vibe:  Vibe | null,
  requested?: number,
): number {
  if (requested && requested > 0) return requested;
  const perDay = VIBE_ITEMS_PER_DAY[vibe ?? "moderado"];
  return Math.max(1, Math.ceil(items.length / perDay));
}

// ── Zone-based day builder ─────────────────────────────────────────────────────
// Implements the full generation logic described in the spec:
//   1. Group items by geographic zone
//   2. Assign zone-groups to days evenly so no day is overloaded
//   3. Match restaurants to days by zone proximity
//   4. Assign time-of-day periods by category

function buildDraft(
  items:      SerializableItem[],
  preferences: Preferences,
  tripLength:  number,
): DiaRoteiro[] {
  const perDay = VIBE_ITEMS_PER_DAY[preferences.vibe ?? "moderado"];

  // 1. Split activities (manha/tarde) from restaurants (almoco/noite)
  const activities   = items.filter((i) => i.categoria !== "restaurante");
  const restaurants  = items.filter((i) => i.categoria === "restaurante");

  // 2. Sort each pool by zone so geographic clusters emerge naturally
  const sortByZone = (a: SerializableItem, b: SerializableItem) =>
    getZone(a.localizacao) - getZone(b.localizacao);

  const sortedAct  = [...activities].sort(sortByZone);
  const sortedRest = [...restaurants].sort(sortByZone);

  // 3. Allocate activities to days using sequential chunking (NOT round-robin).
  //    Because sortedAct is sorted by zone, consecutive chunks stay in the
  //    same geographic area — this is what gives each day geographic coherence.
  const dayAct: SerializableItem[][] = Array.from({ length: tripLength }, () => []);
  const actChunk = Math.ceil(sortedAct.length / Math.max(1, tripLength));
  for (let d = 0; d < tripLength; d++) {
    dayAct[d] = sortedAct.slice(d * actChunk, (d + 1) * actChunk);
  }

  // 4. Assign each restaurant to the day whose first activity is in the nearest zone.
  const dayRest: SerializableItem[][] = Array.from({ length: tripLength }, () => []);

  // For each restaurant find the best day (closest zone, fewest restaurants)
  for (const rest of sortedRest) {
    const rZone = getZone(rest.localizacao);
    let   best  = 0;
    let   bestScore = Infinity;

    for (let d = 0; d < tripLength; d++) {
      const repItem  = dayAct[d][0]; // representative activity for the day
      const dayZone  = repItem ? getZone(repItem.localizacao) : 99;
      const zoneDiff = Math.abs(rZone - dayZone);
      const restLoad = dayRest[d].length;
      // Prefer zone proximity first, then lighter days
      const score = zoneDiff * 10 + restLoad;
      if (score < bestScore) { bestScore = score; best = d; }
    }

    dayRest[best].push(rest);
  }

  // 5. Enforce per-day item cap (vibe) — spill excess into later days.
  for (let d = 0; d < tripLength; d++) {
    const total = dayAct[d].length + dayRest[d].length;
    if (total <= perDay) continue;

    const excess = total - perDay;
    // Spill excess activities to the next day
    const spilled = dayAct[d].splice(dayAct[d].length - excess, excess);
    spilled.forEach((item, i) => {
      const target = (d + 1 + i) % tripLength;
      dayAct[target].unshift(item);
    });
  }

  // 6. Build DiaRoteiro[] with proper period assignment per category.
  //    Period rules:
  //      manha  → activities (first half)
  //      almoco → first restaurant of the day
  //      tarde  → activities (second half) + lucky items
  //      noite  → remaining restaurants

  const days: DiaRoteiro[] = [];

  for (let d = 0; d < tripLength; d++) {
    const acts = dayAct[d];
    const rest = dayRest[d];

    // Skip fully-empty days (shouldn't happen but guard anyway)
    if (!acts.length && !rest.length) continue;

    // Determine representative bairro: most-common localizacao in this day
    const allForDay = [...acts, ...rest];
    const bairroCnt = new Map<string, number>();
    for (const item of allForDay) {
      const b = item.localizacao.trim() || "Rio de Janeiro";
      bairroCnt.set(b, (bairroCnt.get(b) ?? 0) + 1);
    }
    const bairro = [...bairroCnt.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      ?? "Rio de Janeiro";

    // Split activities into manha (morning) and tarde (afternoon)
    const half  = Math.ceil(acts.length / 2);
    const manha = acts.slice(0, Math.max(1, half));
    const tarde = acts.slice(Math.max(1, half));

    // Restaurants → almoco (first), noite (rest)
    const almoco = rest.slice(0, 1);
    const noite  = rest.slice(1);

    const periodos: DiaPeriodo[] = [];
    if (manha.length)  periodos.push({ periodo: "manha",  items: manha  });
    if (almoco.length) periodos.push({ periodo: "almoco", items: almoco });
    if (tarde.length)  periodos.push({ periodo: "tarde",  items: tarde  });
    if (noite.length)  periodos.push({ periodo: "noite",  items: noite  });

    if (periodos.length) {
      days.push({ numero: d + 1, bairro, periodos });
    }
  }

  // 7. Renumber sequentially (some empty days may have been skipped)
  return days.map((day, i) => ({ ...day, numero: i + 1 }));
}

// ── Best-time → PeriodoDia mapping ────────────────────────────────────────────

const BEST_TIME_TO_PERIODO: Record<string, PeriodoDia> = {
  morning:   "manha",
  lunch:     "almoco",
  afternoon: "tarde",
  evening:   "noite",
  night:     "noite",
  // Portuguese aliases
  manha:     "manha",
  almoco:    "almoco",
  tarde:     "tarde",
  noite:     "noite",
};

function bestTimeToPeriodo(bestTime: string, categoria: SavedCategory): PeriodoDia {
  const mapped = BEST_TIME_TO_PERIODO[bestTime?.toLowerCase?.() ?? ""];
  if (mapped) return mapped;
  // Fallback by category when best_time is missing or unknown
  if (categoria === "restaurante") return "almoco";
  return "manha";
}

// ── Gemini skeleton-fill (secondary step) ────────────────────────────────────
// Architecture: the number of days is PRE-DEFINED (the skeleton).
// Gemini can ONLY assign places into those pre-built slots.
// It cannot invent days, merge days, or change the total count.
//
// If Gemini fails or returns an invalid structure, buildDraft() result is used.

async function fillSkeletonWithGemini(
  items:       SerializableItem[],
  tripLength:  number,
  destination: string,
  preferences: Preferences,
  fallback:    DiaRoteiro[],
): Promise<DiaRoteiro[]> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey || !items.length) return fallback;

  // 1. Build the empty skeleton — day count is locked
  const skeleton = Array.from({ length: tripLength }, (_, i) => ({
    day:   i + 1,
    items: [] as unknown[],
  }));

  const totalPlaces = items.length;
  const itemsPerDay = Math.ceil(totalPlaces / tripLength);

  // 2. Compact place list for the prompt (only what Gemini needs)
  const places = items.map((i) => ({
    place_id:  i.id,
    name:      i.titulo,
    category:  i.categoria,
    area:      i.localizacao || "Rio de Janeiro",
    zone:      getZone(i.localizacao),
    best_time: i.categoria === "restaurante" ? "lunch" : "morning",
  }));

  const prompt =
`You are refining a pre-structured itinerary for ${destination}.

The number of days is already defined and MUST NOT be changed.

You MUST fill each day with places.
You MUST NOT remove or merge days.
You MUST distribute places across ALL days.
Each day should contain around ${itemsPerDay} items.

INPUT STRUCTURE:
${JSON.stringify(skeleton)}

PLACES:
${JSON.stringify(places)}

RULES:
- Assign places to each day
- Balance distribution evenly (around ${itemsPerDay} per day)
- Group by proximity — prefer same or adjacent zone numbers on the same day
- Respect best_time and category (restaurants → lunch, attractions → morning, beaches → afternoon, bars → evening)
- Do not leave any day empty
- Do not put all places in one day
- Do not invent new places — only use the places listed above
- User vibe: ${preferences.vibe ?? "moderado"}, inspirations: ${preferences.inspirations.join(",") || "any"}

Return JSON in this EXACT structure (no other text):
[
  {
    "day": 1,
    "area": "main area name",
    "items": [
      { "place_id": "id", "name": "name", "best_time": "morning|lunch|afternoon|evening" }
    ]
  }
]

VALIDATION BEFORE RETURN:
- Total days must equal ${tripLength}
- Every day must have at least 1 item
- All ${totalPlaces} places must appear exactly once
- If any rule is broken, fix it before returning`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
      },
    );

    if (!res.ok) return fallback;

    const data  = await res.json();
    const raw   = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const clean = raw
      .replace(/```json\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(clean) as Array<{
      day:   number;
      area:  string;
      items: Array<{ place_id: string; name: string; best_time: string }>;
    }>;

    // Validate day count matches skeleton
    if (!Array.isArray(parsed) || parsed.length !== tripLength) return fallback;

    // Build item lookup so we re-attach full SerializableItem by place_id
    const itemMap = new Map(items.map((i) => [i.id, i]));

    const days: DiaRoteiro[] = parsed
      .map((gDay, idx) => {
        if (!gDay.items?.length) return null;

        // Group items by best_time → periodo
        const byPeriodo = new Map<PeriodoDia, SerializableItem[]>();

        for (const gi of gDay.items) {
          const full = itemMap.get(gi.place_id);
          if (!full) continue; // Gemini cannot invent places

          const periodo = bestTimeToPeriodo(gi.best_time, full.categoria);
          if (!byPeriodo.has(periodo)) byPeriodo.set(periodo, []);
          byPeriodo.get(periodo)!.push(full);
        }

        // Build periodos in canonical order
        const ORDER: PeriodoDia[] = ["manha", "almoco", "tarde", "noite"];
        const periodos: DiaPeriodo[] = ORDER
          .filter((p) => byPeriodo.has(p) && byPeriodo.get(p)!.length > 0)
          .map((p) => ({ periodo: p, items: byPeriodo.get(p)! }));

        if (!periodos.length) return null;

        return {
          numero:   idx + 1,
          bairro:   gDay.area || "Rio de Janeiro",
          periodos,
        } as DiaRoteiro;
      })
      .filter(Boolean) as DiaRoteiro[];

    // Require that the filled result has exactly tripLength valid days
    if (days.length !== tripLength) return fallback;

    return days;
  } catch (_) {
    return fallback;
  }
}

// ── Validation pass ───────────────────────────────────────────────────────────
// Ensures the output satisfies all hard constraints before returning.

function validateAndFix(
  days:       DiaRoteiro[],
  tripLength: number,
  allItems:   SerializableItem[],
): DiaRoteiro[] {
  // 1. Remove genuinely empty days
  let result = days.filter((d) => d.periodos.length > 0);

  // 2. Collect all item IDs that made it into the output
  const usedIds = new Set<string>();
  for (const day of result) {
    for (const p of day.periodos) {
      for (const item of p.items) usedIds.add(item.id);
    }
  }

  // 3. If any saved items were lost (Gemini hallucinated IDs or dropped them),
  //    append them to the last day's tarde or noite period.
  const lost = allItems.filter((i) => !usedIds.has(i.id));
  if (lost.length > 0 && result.length > 0) {
    const lastDay = result[result.length - 1];
    const tardePeriod = lastDay.periodos.find((p) => p.periodo === "tarde");
    if (tardePeriod) {
      tardePeriod.items.push(...lost);
    } else {
      lastDay.periodos.push({ periodo: "tarde", items: lost });
    }
  }

  // 4. Renumber
  return result.map((d, i) => ({ ...d, numero: i + 1 }));
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const {
      savedItems    = [],
      destination   = "Rio de Janeiro",
      preferences   = { inspirations: [], vibe: "moderado" },
      requestedDays,
    } = body;

    // 1. Validate + clean incoming items
    const allItems   = getSavedPlacesForUser(savedItems);
    const actionable = allItems.filter((i) => i.categoria !== "hotel");
    const dest       = destination || "Rio de Janeiro";
    const tripLength = computeTripLength(
      actionable,
      preferences.vibe ?? "moderado",
      requestedDays,
    );

    // 2. Build a deterministic draft — this is the guaranteed fallback
    const deterministicDraft = buildDraft(actionable, preferences, tripLength);

    // 3. Skeleton-fill with Gemini:
    //    - Pre-builds empty day slots (count locked to tripLength)
    //    - Gemini assigns places into those slots only
    //    - Falls back to deterministicDraft on any failure
    let days = await fillSkeletonWithGemini(
      actionable,
      tripLength,
      dest,
      preferences,
      deterministicDraft,
    );

    // 4. Validate — fix any items dropped by Gemini
    days = validateAndFix(days, tripLength, actionable);

    const result: ItineraryResult = {
      destination: dest,
      source:      "trip_saved_places",
      preferences,
      summary: {
        totalDays:  days.length,
        totalItems: actionable.length,
      },
      days,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status:  200,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status:  400,
      },
    );
  }
});
