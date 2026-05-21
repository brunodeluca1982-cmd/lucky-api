/**
 * useHomeHero.ts
 *
 * Fetches Hero Carousel items for the Home screen.
 *
 * Priority:
 *   1. Supabase: o_que_fazer_rio_v2 (ativo = true, limit 8)
 *   2. Canonical fallback — 5 curated Rio landmarks (never empty)
 *
 * IMAGE PIPELINE NOTE:
 *   photo_url is passed as-is from Supabase (including cached Google URLs).
 *   HeroSlide uses BackgroundContext.pool for cityId="rio" items, so
 *   photo_url is a secondary fallback only for non-Rio destinations.
 *
 * RULE: NEVER return an empty array.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { sanitizePhotoUrl } from "@/utils/getImageForEntity";

export interface HomeHeroItem {
  id: string;
  titulo: string;
  localizacao: string;
  badge: string;
  photo_url: string | null;
  cityId: "rio";
  source: "supabase" | "fallback";
}

// ── Canonical curated fallback ─────────────────────────────────────────────
// Used when Supabase returns 0 items. These are real Rio landmarks.
// photo_url is null — HeroSlide uses BackgroundContext.pool instead.
const CANONICAL_FALLBACK: HomeHeroItem[] = [
  { id: "fallback-1", titulo: "Cristo Redentor",     localizacao: "Cosme Velho",    badge: "Ícone", photo_url: null, cityId: "rio", source: "fallback" },
  { id: "fallback-2", titulo: "Pão de Açúcar",       localizacao: "Urca",           badge: "Vista", photo_url: null, cityId: "rio", source: "fallback" },
  { id: "fallback-3", titulo: "Praia de Ipanema",    localizacao: "Ipanema",        badge: "Praia", photo_url: null, cityId: "rio", source: "fallback" },
  { id: "fallback-4", titulo: "Arpoador",             localizacao: "Ipanema",        badge: "Pôr do sol", photo_url: null, cityId: "rio", source: "fallback" },
  { id: "fallback-5", titulo: "Maracanã",             localizacao: "Maracanã",       badge: "Cultura", photo_url: null, cityId: "rio", source: "fallback" },
];

type State = {
  items: HomeHeroItem[];
  loading: boolean;
};

export function useHomeHero(): State {
  const [state, setState] = useState<State>({ items: CANONICAL_FALLBACK, loading: true });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data, error } = await supabase
          .from("o_que_fazer_rio_v2")
          .select("id,nome,bairro,categoria,photo_url")
          .eq("ativo", true)
          .not("nome", "is", null)
          .order("id", { ascending: false })
          .limit(8);

        if (cancelled) return;

        if (error) {
          console.error("[HOME HERO] Supabase error:", error.message);
          setState({ items: CANONICAL_FALLBACK, loading: false });
          return;
        }

        const rows = data ?? [];

        if (rows.length === 0) {
          console.log("[HERO] items: 5 source: fallback (Supabase returned 0 items)");
          setState({ items: CANONICAL_FALLBACK, loading: false });
          return;
        }

        const items: HomeHeroItem[] = rows.map((row) => {
          const rawUrl = (row as any).photo_url as string | null ?? null;
          const safeUrl = sanitizePhotoUrl(rawUrl);
          return {
            id:          String((row as any).id),
            titulo:      ((row as any).nome as string) || "Rio de Janeiro",
            localizacao: ((row as any).bairro as string) || "Rio de Janeiro",
            badge:       ((row as any).categoria as string) || "Experiência",
            photo_url:   safeUrl,
            cityId:      "rio",
            source:      "supabase",
          };
        });

        console.log(`[HERO] items: ${items.length} source: supabase`);
        setState({ items, loading: false });
      } catch (err) {
        if (!cancelled) {
          console.error("[HOME HERO] Unexpected error:", err);
          setState({ items: CANONICAL_FALLBACK, loading: false });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return state;
}
