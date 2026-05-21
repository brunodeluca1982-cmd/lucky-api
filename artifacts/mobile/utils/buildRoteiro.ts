/**
 * buildRoteiro.ts
 *
 * Pure deterministic function that converts a flat list of SavedItems
 * into a structured day-by-day itinerary (roteiro base).
 *
 * Slot rules (enforced strictly):
 *   morning    — 1 activity only
 *   lunch      — 1 restaurant only
 *   afternoon  — 1 activity only
 *   dinner     — 1 restaurant only
 *   late_night — 1 nightlife/bar item (optional)
 *
 * Never allows:
 *   - 2 restaurants in dinner/night
 *   - 2 restaurants in lunch
 *   - 2 activities in the same slot
 *   - Cross-slot bleed (restaurants taking activity slots or vice versa)
 *
 * Nightlife detection:
 *   Items are flagged as nightlife if their title contains common bar/nightlife
 *   keywords. Nightlife items are routed to late_night, never to lunch/dinner.
 */

import type { SavedItem, SavedCategory } from "@/context/GuiaContext";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PeriodoDia =
  | "manha"
  | "almoco"
  | "tarde"
  | "jantar"
  | "late_night"
  | "noite";

export const PERIODO_LABEL: Record<PeriodoDia, string> = {
  manha:      "Manhã",
  almoco:     "Almoço",
  tarde:      "Tarde",
  jantar:     "Jantar",
  late_night: "Noite",
  noite:      "Noite",
};

export const PERIODO_ICON: Record<PeriodoDia, string> = {
  manha:      "sun",
  almoco:     "coffee",
  tarde:      "cloud",
  jantar:     "moon",
  late_night: "star",
  noite:      "moon",
};

export interface DiaPeriodo {
  periodo: PeriodoDia;
  items: SavedItem[];
}

/** Minimal hotel info attached per-day by the Edge Function (Step 7b).
 *  Not part of the experience flow — displayed as a fixed header block. */
export interface HotelBlock {
  id: string;
  titulo: string;
  localizacao: string;
  source_table: "stay_hotels";
  categoria: "hotel";
  photo_url?: string | null;
  image?: { uri: string } | null | unknown;
}

export interface DiaRoteiro {
  numero: number;
  bairro: string;
  periodos: DiaPeriodo[];
  /** Injected by Edge Function after validation. Present when user saved a hotel. */
  hotel?: HotelBlock;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

type TipoInterno = "atividade" | "restaurante" | "nightlife" | "hotel";

/**
 * Detect nightlife/bar items by title keywords.
 * Nightlife goes to late_night slot — never lunch or dinner.
 */
const NIGHTLIFE_KEYWORDS = [
  "bar", "pub", "club", "clube", "lounge", "noite", "night",
  "drinks", "cocktail", "caipirinha", "boteco", "balada", "dj",
  "cervejaria", "taproom", "speakeasy",
];

function isNightlife(titulo: string): boolean {
  const lower = titulo.toLowerCase();
  return NIGHTLIFE_KEYWORDS.some((kw) => lower.includes(kw));
}

function tipoFromItem(item: SavedItem): TipoInterno {
  if (item.categoria === "hotel") return "hotel";
  if (item.categoria === "restaurante") {
    return isNightlife(item.titulo) ? "nightlife" : "restaurante";
  }
  // oQueFazer + lucky → atividade
  return "atividade";
}

// ── Main export ────────────────────────────────────────────────────────────────

export function buildRoteiro(items: SavedItem[]): DiaRoteiro[] {
  // 1. Group by localizacao (= bairro), preserving insertion order
  const byBairro = new Map<string, SavedItem[]>();
  for (const item of items) {
    const bairro = item.localizacao.trim() || "Sem bairro";
    if (!byBairro.has(bairro)) byBairro.set(bairro, []);
    byBairro.get(bairro)!.push(item);
  }

  const dias: DiaRoteiro[] = [];
  let diaNum = 1;

  for (const [bairro, bairroItems] of byBairro) {
    // 2. Classify each item into its tipo bucket
    const atividades  = bairroItems.filter(i => tipoFromItem(i) === "atividade");
    const restaurantes = bairroItems.filter(i => tipoFromItem(i) === "restaurante");
    const nightlife   = bairroItems.filter(i => tipoFromItem(i) === "nightlife");
    // hotels excluded from timetable

    // 3. Compose slots — strictly 1 item per slot, no exceptions
    //
    //   morning   : 1 activity
    //   lunch     : 1 restaurant
    //   afternoon : 1 activity (next available, not the morning one)
    //   dinner    : 1 restaurant (next available, not the lunch one)
    //   late_night: 1 nightlife item (optional)

    const manha      = atividades.slice(0, 1);   // exactly 1 activity → morning
    const tarde      = atividades.slice(1, 2);   // exactly 1 activity → afternoon
    const almoco     = restaurantes.slice(0, 1); // exactly 1 restaurant → lunch
    const jantar     = restaurantes.slice(1, 2); // exactly 1 restaurant → dinner
    const lateNight  = nightlife.slice(0, 1);    // exactly 1 nightlife → late_night

    // 4. Build ordered periodo list (slot order reflects real day flow)
    const periodos: DiaPeriodo[] = [];
    if (manha.length     > 0) periodos.push({ periodo: "manha",      items: manha      });
    if (almoco.length    > 0) periodos.push({ periodo: "almoco",     items: almoco     });
    if (tarde.length     > 0) periodos.push({ periodo: "tarde",      items: tarde      });
    if (jantar.length    > 0) periodos.push({ periodo: "jantar",     items: jantar     });
    if (lateNight.length > 0) periodos.push({ periodo: "late_night", items: lateNight  });

    // 5. Skip bairros with no actionable periodos (hotel-only bairros)
    if (periodos.length === 0) continue;

    dias.push({ numero: diaNum++, bairro, periodos });
  }

  return dias;
}
