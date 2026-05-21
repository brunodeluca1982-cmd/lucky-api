/**
 * buildItinerary.ts
 *
 * Thin wrapper over buildRoteiro.ts that accepts user preferences and returns
 * a structured ItineraryResult suitable for display in the itinerary screen.
 *
 * Generation logic:
 *   1. Base grouping:  buildRoteiro(saved) — by bairro, by time slot
 *   2. Preference pass: sort days/items within each period using inspiration + vibe
 *   3. Destination: always inferred as "Rio de Janeiro" (all current saved places)
 *
 * Pure function — no side effects, no async, deterministic.
 */

import type { SavedItem, SavedCategory } from "@/context/GuiaContext";
import { buildRoteiro } from "@/utils/buildRoteiro";
import type { DiaRoteiro } from "@/utils/buildRoteiro";

// ── Preference types ──────────────────────────────────────────────────────────

export type Inspiration =
  | "gastronomy"
  | "culture"
  | "beach"
  | "adventure"
  | "lucky"
  | "natureza"
  | "festa";

export type Vibe = "tranquilo" | "moderado" | "intenso";

export interface ItineraryPreferences {
  inspirations: Inspiration[];
  vibe: Vibe | null;
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface ItineraryResult {
  destination: string;
  source: "trip_saved_places";
  preferences: ItineraryPreferences;
  summary: {
    totalDays: number;
    totalItems: number;
  };
  days: DiaRoteiro[];
}

// ── Inspiration → category affinity map ──────────────────────────────────────
// Higher weight = category scores better for this inspiration

const CATEGORY_AFFINITY: Record<Inspiration, Partial<Record<SavedCategory, number>>> = {
  gastronomy: { restaurante: 2, oQueFazer: 0, lucky: 1, hotel: 0 },
  culture:    { restaurante: 0, oQueFazer: 2, lucky: 1, hotel: 0 },
  beach:      { restaurante: 1, oQueFazer: 2, lucky: 1, hotel: 0 },
  adventure:  { restaurante: 0, oQueFazer: 2, lucky: 2, hotel: 0 },
  lucky:      { restaurante: 1, oQueFazer: 1, lucky: 3, hotel: 0 },
  natureza:   { restaurante: 0, oQueFazer: 2, lucky: 1, hotel: 0 },
  festa:      { restaurante: 2, oQueFazer: 1, lucky: 2, hotel: 0 },
};

// ── Vibe → day density limit ──────────────────────────────────────────────────
// Max items shown per day. Intenso = no cap (show all), Tranquilo = lighter days.

const VIBE_MAX_ITEMS: Record<Vibe, number> = {
  tranquilo: 3,
  moderado:  5,
  intenso:   9, // effectively no limit for any reasonable day
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferDestination(_saved: SavedItem[]): string {
  return "Rio de Janeiro";
}

function itemScore(categoria: SavedCategory, inspirations: Inspiration[]): number {
  if (inspirations.length === 0) return 0;
  return inspirations.reduce((sum, ins) => {
    const weight = CATEGORY_AFFINITY[ins][categoria] ?? 0;
    return sum + weight;
  }, 0);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildItinerary(
  saved: SavedItem[],
  preferences: ItineraryPreferences,
): ItineraryResult {
  const { inspirations, vibe } = preferences;

  // 1. Run base grouping
  let days = buildRoteiro(saved);

  // 2. Preference pass — sort items within each period by affinity score
  if (inspirations.length > 0) {
    days = days.map((dia) => ({
      ...dia,
      periodos: dia.periodos.map((p) => ({
        ...p,
        items: [...p.items].sort(
          (a, b) =>
            itemScore(b.categoria, inspirations) -
            itemScore(a.categoria, inspirations),
        ),
      })),
    }));
  }

  // 3. Vibe pass — cap items per day for a lighter pace
  if (vibe) {
    const maxItems = VIBE_MAX_ITEMS[vibe];
    days = days.map((dia) => {
      let remaining = maxItems;
      const cappedPeriodos = dia.periodos.map((p) => {
        if (remaining <= 0) return null;
        const slicedItems = p.items.slice(0, remaining);
        remaining -= slicedItems.length;
        return { ...p, items: slicedItems };
      }).filter(Boolean) as typeof dia.periodos;

      return { ...dia, periodos: cappedPeriodos };
    }).filter((dia) => dia.periodos.length > 0);
  }

  // 4. Renumber days after potential trimming
  const renumbered = days.map((dia, i) => ({ ...dia, numero: i + 1 }));

  const totalItems = saved.filter((s) => s.categoria !== "hotel").length;

  return {
    destination: inferDestination(saved),
    source: "trip_saved_places",
    preferences,
    summary: {
      totalDays: renumbered.length,
      totalItems,
    },
    days: renumbered,
  };
}
