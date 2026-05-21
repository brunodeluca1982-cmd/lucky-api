/**
 * normalizePlace.ts — Frontend data normalization layer.
 *
 * PURPOSE
 * ───────
 * The app uses multiple independent Supabase tables:
 *   • o_que_fazer_rio
 *   • restaurantes
 *   • stay_hotels
 *   • lucky_list_rio
 *
 * UI components (ActionBlock, etc.) must NEVER access raw table fields.
 * Instead, every table row is transformed here into a single NormalizedPlace
 * object before being passed to the UI layer.
 *
 * FLOW
 *   Raw Supabase row
 *     → normalize<TableName>()   (table-specific mapper)
 *       → NormalizedPlace          (standard contract for all UI)
 *         → <ActionBlock />        (renders only what exists)
 *
 * FUTURE
 *   When Supabase is connected, replace the LugarPlace mappers below with
 *   real row types from the generated Supabase types file and call the
 *   corresponding normalize*() function in your data-fetching hooks.
 */

import type { LugarPlace } from "./lugares";

// ── Normalized contract ────────────────────────────────────────────────────────
// This is the ONLY shape the UI layer ever sees.

export type TipoItem = "hotel" | "restaurante" | "experiencia";

export interface NormalizedPlace {
  nome: string;
  tipo_item: TipoItem;
  google_maps_url: string | null;
  instagram_handle: string | null;
  instagram_url: string | null;
  booking_url: string | null;
}

// ── Raw Supabase row types (replace with generated types when connected) ───────
// These mirror the expected column names in each table.

export interface RawHotel {
  nome?: string | null;
  google_maps_url?: string | null;
  instagram_handle?: string | null;
  instagram_url?: string | null;
  booking_url?: string | null;
  [key: string]: unknown;
}

export interface RawRestaurante {
  nome?: string | null;
  google_maps_url?: string | null;
  instagram_handle?: string | null;
  instagram_url?: string | null;
  booking_url?: string | null;
  [key: string]: unknown;
}

export interface RawExperiencia {
  nome?: string | null;
  google_maps_url?: string | null;
  instagram_handle?: string | null;
  instagram_url?: string | null;
  [key: string]: unknown;
}

export interface RawLucky {
  nome?: string | null;
  tipo?: string | null;          // "hotel" | "restaurante" | "experiencia" | …
  google_maps_url?: string | null;
  instagram_handle?: string | null;
  instagram_url?: string | null;
  booking_url?: string | null;
  [key: string]: unknown;
}

// ── Normalizers ────────────────────────────────────────────────────────────────

/** stay_hotels table */
export function normalizeHotel(row: RawHotel): NormalizedPlace {
  return {
    nome: row.nome ?? "",
    tipo_item: "hotel",
    google_maps_url: row.google_maps_url ?? null,
    instagram_handle: row.instagram_handle ?? null,
    instagram_url: row.instagram_url ?? null,
    booking_url: row.booking_url ?? null,
  };
}

/** restaurantes table */
export function normalizeRestaurante(row: RawRestaurante): NormalizedPlace {
  return {
    nome: row.nome ?? "",
    tipo_item: "restaurante",
    google_maps_url: row.google_maps_url ?? null,
    instagram_handle: row.instagram_handle ?? null,
    instagram_url: row.instagram_url ?? null,
    booking_url: row.booking_url ?? null,
  };
}

/** o_que_fazer_rio table */
export function normalizeExperiencia(row: RawExperiencia): NormalizedPlace {
  return {
    nome: row.nome ?? "",
    tipo_item: "experiencia",
    google_maps_url: row.google_maps_url ?? null,
    instagram_handle: row.instagram_handle ?? null,
    instagram_url: row.instagram_url ?? null,
    booking_url: null,           // experiences never have booking
  };
}

/** lucky_list_rio table — tipo_item detected from row.tipo field */
export function normalizeLucky(row: RawLucky): NormalizedPlace {
  const tipo = detectTipoFromString(row.tipo);
  return {
    nome: row.nome ?? "",
    tipo_item: tipo,
    google_maps_url: row.google_maps_url ?? null,
    instagram_handle: row.instagram_handle ?? null,
    instagram_url: row.instagram_url ?? null,
    // booking only relevant if the lucky item is a hotel
    booking_url: tipo === "hotel" ? (row.booking_url ?? null) : null,
  };
}

// ── Current frontend data model (LugarPlace) mapper ───────────────────────────
// Used until Supabase is connected. Maps the local data/lugares.ts shape
// into the same NormalizedPlace contract so the UI is consistent today.

export function normalizeLugarPlace(
  place: LugarPlace,
  fallbackTipo?: TipoItem
): NormalizedPlace {
  return {
    nome: place.titulo,
    tipo_item: place.tipo_item ?? fallbackTipo ?? "experiencia",
    google_maps_url: place.google_maps_url ?? null,
    instagram_handle: place.instagram_handle ?? null,
    instagram_url: place.instagram_url ?? null,
    booking_url: place.booking_url ?? null,
  };
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function detectTipoFromString(raw: string | null | undefined): TipoItem {
  if (!raw) return "experiencia";
  const s = raw.toLowerCase();
  if (s.includes("hotel") || s.includes("hospedagem") || s.includes("pousada")) {
    return "hotel";
  }
  if (
    s.includes("restaurante") ||
    s.includes("bar") ||
    s.includes("café") ||
    s.includes("cafe") ||
    s.includes("gastronomia")
  ) {
    return "restaurante";
  }
  return "experiencia";
}

/** Convenience: derive TipoItem from a placeId string prefix (local IDs). */
export function tipoFromPlaceId(placeId: string, categoria?: string): TipoItem {
  if (categoria === "hotel" || placeId.startsWith("h"))      return "hotel";
  if (categoria === "restaurante" || placeId.startsWith("c")) return "restaurante";
  return "experiencia";
}
