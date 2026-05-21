/**
 * getImageForEntity.ts — Unified, stable image resolver for all entity types.
 *
 * Priority chain (strict, never skipped):
 *   1. Supabase image_url / photo_url  — if set and non-empty, always wins
 *   2. Curated entity-specific web URI — Wikipedia Commons permalink (NATIVE ONLY)
 *   3. Neighborhood-based image        — via getNeighborhoodImage(localizacao)
 *      On native: Wikipedia Commons URI for the neighborhood zone.
 *      On web:    Local bundled .png (CORS-safe, always visible).
 *   4. Local asset fallback            — bundled .png, always available offline
 *
 * PLATFORM RULE (critical):
 *   Expo web cannot reliably load external image URIs — Wikipedia Commons
 *   Special:FilePath URLs involve redirect chains that trigger CORS failures,
 *   causing the Image component to render nothing (shows card background color).
 *   On web: all external URI tiers are skipped; local bundled assets are used.
 *   On native: external URIs work fine — higher quality images are preferred.
 *
 * Stability guarantee:
 *   All resolutions are cached in a module-level Map keyed by
 *   (type:name:localizacao:platform). Same entity → same image on every
 *   screen, every render, every session.
 */

import { Platform } from "react-native";
import {
  getNeighborhoodImage,
  type NeighborhoodImageSource,
} from "@/data/neighborhoodImages";

export type EntityType = "neighborhood" | "restaurant" | "hotel" | "activity" | "city";

// ─────────────────────────────────────────────────────────────────────────────
// Module-level result cache — keyed by "type:name:localizacao:platform"
// ─────────────────────────────────────────────────────────────────────────────
const _cache = new Map<string, NeighborhoodImageSource>();

function cacheKey(type: EntityType, name: string, localizacao = ""): string {
  return `${type}:${name.toLowerCase().trim()}:${localizacao.toLowerCase().trim()}:${Platform.OS}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Curated activity images (NATIVE ONLY — tier 2)
// Priority over neighborhood fallback — geographically precise.
// ─────────────────────────────────────────────────────────────────────────────
const ACTIVITY_WEB_IMAGES: Record<string, string> = {
  "academia dos flintstones":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Arpoador_Rocks.jpg",
  "pedra do arpoador":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Arpoador_Rocks.jpg",
  "arpoador":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Arpoador_Rocks.jpg",
  "praia de arpoador":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Arpoador_Rocks.jpg",
  "forte de copacabana":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Forte_de_Copacabana.jpg",
  "pão de açúcar":
    "https://commons.wikimedia.org/wiki/Special:FilePath/P%C3%A3o_de_A%C3%A7%C3%BAcar_(2009).jpg",
  "pao de acucar":
    "https://commons.wikimedia.org/wiki/Special:FilePath/P%C3%A3o_de_A%C3%A7%C3%BAcar_(2009).jpg",
  "morro da urca":
    "https://commons.wikimedia.org/wiki/Special:FilePath/P%C3%A3o_de_A%C3%A7%C3%BAcar_(2009).jpg",
  "cristo redentor":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Cristo_Redentor_-_Rio_de_Janeiro%2C_Brazil.jpg",
  "corcovado":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Cristo_Redentor_-_Rio_de_Janeiro%2C_Brazil.jpg",
  "escadaria selarón":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Escadaria_Seler%C3%B3n_1.jpg",
  "escadaria selaron":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Escadaria_Seler%C3%B3n_1.jpg",
  "jardim botânico":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Jardim_Bot%C3%A2nico_do_Rio_de_Janeiro_07_2009.jpg",
  "jardim botanico":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Jardim_Bot%C3%A2nico_do_Rio_de_Janeiro_07_2009.jpg",
  "lagoa rodrigo de freitas":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Lagoa_Rodrigo_de_Freitas_-_Rio_de_Janeiro%2C_Brazil.jpg",
  "lagoa":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Lagoa_Rodrigo_de_Freitas_-_Rio_de_Janeiro%2C_Brazil.jpg",
  "praia de ipanema":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Ipanema_from_Arpoador.jpg",
  "praia de copacabana":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Copacabana_beach_Aerial_2010.jpg",
  "museu do amanhã":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Museu_do_Amanh%C3%A3.jpg",
  "museu do amanha":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Museu_do_Amanh%C3%A3.jpg",
  "floresta da tijuca":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Floresta_da_Tijuca.jpg",
  "parque lage":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Parque_Lage_-_Rio_de_Janeiro.jpg",
  "mirante dona marta":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Botafogo_from_Dona_Marta.jpg",
  "pedra bonita":
    "https://commons.wikimedia.org/wiki/Special:FilePath/Pedra_Bonita_Rio_de_Janeiro.jpg",
};

const CITY_WEB_IMAGES: Record<string, string> = {
  "rio de janeiro":  "https://commons.wikimedia.org/wiki/Special:FilePath/Ipanema_from_Arpoador.jpg",
  "santorini":       "https://commons.wikimedia.org/wiki/Special:FilePath/Oia_Santorini.jpg",
  "kyoto":           "https://commons.wikimedia.org/wiki/Special:FilePath/Kyoto_-_Fushimi_Inari_-_Torii.jpg",
  "lisboa":          "https://commons.wikimedia.org/wiki/Special:FilePath/Lisboa-Alfama-Church-dsc04453.jpg",
  "buenos aires":    "https://commons.wikimedia.org/wiki/Special:FilePath/Buenos_Aires_Montage_2015.jpg",
  "florianopolis":   "https://commons.wikimedia.org/wiki/Special:FilePath/Florianopolis-SC.jpg",
  "florianópolis":   "https://commons.wikimedia.org/wiki/Special:FilePath/Florianopolis-SC.jpg",
  "paraty":          "https://commons.wikimedia.org/wiki/Special:FilePath/Paraty_-_Igreja_de_Santa_Rita.jpg",
  "gramado":         "https://commons.wikimedia.org/wiki/Special:FilePath/Gramado_RS_Brasil.jpg",
  "miami":           "https://commons.wikimedia.org/wiki/Special:FilePath/South_Beach_20080315.jpg",
  "paris":           "https://commons.wikimedia.org/wiki/Special:FilePath/Paris_-_Eiffelturm_und_Marsfeld2.jpg",
  "bali":            "https://commons.wikimedia.org/wiki/Special:FilePath/Tanah_Lot_Bali.jpg",
};

// ─────────────────────────────────────────────────────────────────────────────
// Local asset fallbacks for non-Rio cities (WEB — CORS-safe, always visible).
// Used on Expo web where external URIs fail. These are bundled at build time.
// ─────────────────────────────────────────────────────────────────────────────
const CITY_LOCAL_ASSETS: Record<string, NeighborhoodImageSource> = {
  "rio de janeiro":  require("../assets/images/hero-rio.png"),
  "santorini":       require("../assets/images/hero-santorini.png"),
  "kyoto":           require("../assets/images/hero-kyoto.png"),
  // Non-Rio cities: best available local asset — contextually adjacent in mood
  "lisboa":          require("../assets/images/lapa.png"),
  "buenos aires":    require("../assets/images/secret2.png"),
  "florianopolis":   require("../assets/images/ipanema.png"),
  "florianópolis":   require("../assets/images/ipanema.png"),
  "paraty":          require("../assets/images/lapa.png"),
  "gramado":         require("../assets/images/secret1.png"),
  "miami":           require("../assets/images/ipanema.png"),
  "paris":           require("../assets/images/secret2.png"),
  "bali":            require("../assets/images/secret1.png"),
  "ilhabela":        require("../assets/images/ipanema.png"),
  "são paulo":       require("../assets/images/rio-aerial-clean.png"),
  "sao paulo":       require("../assets/images/rio-aerial-clean.png"),
  "ibiza":           require("../assets/images/ipanema.png"),
  "nova york":       require("../assets/images/secret2.png"),
  "nova-york":       require("../assets/images/secret2.png"),
  "new york":        require("../assets/images/secret2.png"),
  "jericoacoara":    require("../assets/images/ipanema.png"),
  "amsterdam":       require("../assets/images/lapa.png"),
  "marrakech":       require("../assets/images/secret1.png"),
  "dubai":           require("../assets/images/secret2.png"),
  "maldivas":        require("../assets/images/ipanema.png"),
  "tokyo":           require("../assets/images/hero-kyoto.png"),
  "tóquio":          require("../assets/images/hero-kyoto.png"),
  "barcelona":       require("../assets/images/lapa.png"),
  "london":          require("../assets/images/secret2.png"),
  "londres":         require("../assets/images/secret2.png"),
};

// ─────────────────────────────────────────────────────────────────────────────
// URL upgrade rule — applied at Tier 1 (system-wide)
// ─────────────────────────────────────────────────────────────────────────────

// Ensures any Google Places Photo API URL uses maxwidth=800.
// URLs cached in Supabase may have maxwidth=80 (thumbnail quality).
// Non-Google-Places URLs are returned unchanged.
function upgradePhotoUrl(url: string): string {
  if (!url.includes("maps.googleapis.com/maps/api/place/photo")) return url;
  if (/maxwidth=\d+/i.test(url)) {
    return url.replace(/maxwidth=\d+/i, "maxwidth=800");
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}maxwidth=800`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public resolver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the canonical image for any entity.
 *
 * @param type           - Entity category for correct fallback chain
 * @param name           - Entity name (restaurant, hotel, city name, etc.)
 * @param localizacao    - Neighborhood / bairro (used for neighborhood fallback)
 * @param supabaseImageUrl - Direct Supabase photo_url; overrides everything if set
 */
export function getImageForEntity(
  type: EntityType,
  name: string,
  localizacao?: string,
  supabaseImageUrl?: string | null,
): NeighborhoodImageSource {
  // ── Tier 1: Supabase/Wikipedia image — all platforms.
  // Supabase Storage URLs are direct HTTPS (upload.wikimedia.org too) — no
  // redirect chains, CORS-enabled. Safe to use on web and native alike.
  // Google Places URLs are upgraded to maxwidth=800 here (system-wide rule).
  if (supabaseImageUrl && supabaseImageUrl.trim().length > 0) {
    return { uri: upgradePhotoUrl(supabaseImageUrl.trim()) };
  }

  // ── Check module cache for tiers 2-4 ──────────────────────────────────────
  const key = cacheKey(type, name, localizacao);
  const cached = _cache.get(key);
  if (cached !== undefined) return cached;

  // ── Tiers 2-4: resolve once, then cache ───────────────────────────────────
  const resolved = _resolve(type, name, localizacao);
  _cache.set(key, resolved);
  return resolved;
}

function _resolve(
  type: EntityType,
  name: string,
  localizacao?: string,
): NeighborhoodImageSource {
  const nameLower = name.toLowerCase().trim();
  const loc = localizacao ?? "";
  const isNative = Platform.OS !== "web";

  switch (type) {
    case "neighborhood":
      return getNeighborhoodImage(name);

    case "restaurant":
      // No Supabase photo: show neighborhood image — clearly a placeholder,
      // never another restaurant's photo.
      return getNeighborhoodImage(loc || name);

    case "hotel":
      // No Supabase photo: show neighborhood image.
      return getNeighborhoodImage(loc || name);

    case "city": {
      if (isNative) {
        const uri = CITY_WEB_IMAGES[nameLower];
        if (uri) return { uri };
      }
      // Web: use local bundled city asset (always visible)
      return (
        CITY_LOCAL_ASSETS[nameLower] ??
        require("../assets/images/hero-rio.png")
      );
    }

    case "activity": {
      if (isNative) {
        const uri = ACTIVITY_WEB_IMAGES[nameLower];
        if (uri) return { uri };
      }
      return getNeighborhoodImage(loc || name);
    }
  }
}
