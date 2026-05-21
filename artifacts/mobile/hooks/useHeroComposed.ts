/**
 * useHeroComposed.ts — 100% Dinâmico
 *
 * Composição:
 *   [0]     Rio de Janeiro (sempre primeiro)
 *   [1..N]  Outros destinos com status='ativo' e foto
 *   [N+1..] Amigos com foto_url
 *   [...]   Lugares em destaque (categoria variada)
 *   [...]   Lucky Lists com capa
 *
 * ZERO hardcoded — tudo vem do Supabase
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildMediaUrl } from "@/lib/mediaUrl";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HeroSourceTable =
  | "destinos"
  | "amigos"
  | "lugares"
  | "lucklists";

export interface HeroComposedItem {
  id: string;
  source_table: HeroSourceTable;
  titulo: string;
  localizacao: string;
  badge: string;
  photo_url: string | null;
  route: HeroRoute;
}

export type HeroRoute =
  | { type: "cidade"; slug: string }
  | { type: "amigo"; slug: string }
  | { type: "lugar"; citySlug: string; lugarId: string }
  | { type: "lucklist"; slug: string };

// ── Storage helper ────────────────────────────────────────────────────────────

const STORAGE_BASE = "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media";

async function getHeroPhotoFromStorage(slug: string): Promise<string | null> {
  try {
    // Try media/{slug}/hero/foto/ first
    const { data, error } = await supabase.storage
      .from("media")
      .list(`${slug}/hero/foto`, { limit: 1, sortBy: { column: "name", order: "asc" } });

    if (!error && data && data.length > 0) {
      const file = data.find(f => f.name.match(/\.(jpg|jpeg|png|webp)$/i));
      if (file) {
        return `${STORAGE_BASE}/${slug}/hero/foto/${file.name}`;
      }
    }

    // Fallback: try media/{slug}/hero/ directly
    const { data: d2 } = await supabase.storage
      .from("media")
      .list(`${slug}/hero`, { limit: 5, sortBy: { column: "name", order: "asc" } });

    if (d2 && d2.length > 0) {
      const file = d2.find(f => f.name.match(/\.(jpg|jpeg|png|webp)$/i));
      if (file) {
        return `${STORAGE_BASE}/${slug}/hero/${file.name}`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ── Fetch Destinos ────────────────────────────────────────────────────────────

async function fetchDestinos(): Promise<HeroComposedItem[]> {
  const { data, error } = await supabase
    .from("destinos")
    .select("id, slug, nome, hero_image_url, ordem, pais_id, paises(nome)")
    .eq("status", "ativo")
    .order("ordem", { ascending: true });

  if (error || !data) {
    console.warn("[HERO] destinos fetch failed:", error?.message);
    return [];
  }

  const items: HeroComposedItem[] = [];

  for (const d of data) {
    // Prioridade: storage > hero_image_url
    let photo = await getHeroPhotoFromStorage(d.slug);
    if (!photo && d.hero_image_url) {
      photo = buildMediaUrl(d.hero_image_url);
    }

    // Só incluir se tiver foto
    if (!photo) {
      console.log(`[HERO] destino ${d.slug} sem foto — ignorado`);
      continue;
    }

    const pais = (d as any).paises?.nome ?? "Brasil";

    items.push({
      id: d.id,
      source_table: "destinos",
      titulo: d.nome,
      localizacao: pais,
      badge: "Destino",
      photo_url: photo,
      route: { type: "cidade", slug: d.slug },
    });
  }

  return items;
}

// ── Fetch Amigos ──────────────────────────────────────────────────────────────

async function fetchAmigos(): Promise<HeroComposedItem[]> {
  const { data, error } = await supabase
    .from("amigos")
    .select("id, slug, nome, foto_url, tipo, ordem, cidade")
    .eq("ativo", true)
    .not("foto_url", "is", null)
    .order("ordem", { ascending: true });

  if (error || !data) {
    console.warn("[HERO] amigos fetch failed:", error?.message);
    return [];
  }

  return data.map((a: any) => ({
    id: a.id,
    source_table: "amigos" as const,
    titulo: a.nome,
    localizacao: a.cidade ?? "Guia Exclusivo",
    badge: a.tipo === "fundador" ? "Fundador" : "Amigo de Viagem",
    photo_url: a.foto_url,
    route: { type: "amigo" as const, slug: a.slug },
  }));
}

// ── Fetch Lugares em Destaque ─────────────────────────────────────────────────

async function fetchLugaresDestaque(): Promise<HeroComposedItem[]> {
  const { data, error } = await supabase
    .from("lugares")
    .select(`
      id, nome, categoria, hero_image_url,
      bairros(nome),
      destinos(slug)
    `)
    .eq("ativo", true)
    .eq("destaque", true)
    .not("hero_image_url", "is", null)
    .limit(10);

  if (error || !data) {
    console.warn("[HERO] lugares destaque fetch failed:", error?.message);
    return [];
  }

  const items: HeroComposedItem[] = [];

  for (const l of data as any[]) {
    const photo = buildMediaUrl(l.hero_image_url);

    // Validar se a URL é válida
    if (!photo || !l.hero_image_url) {
      console.log(`[HERO] lugar "${l.nome}" descartado — hero_image_url inválido`);
      continue;
    }

    items.push({
      id: l.id,
      source_table: "lugares" as const,
      titulo: l.nome,
      localizacao: l.bairros?.nome ?? "Rio de Janeiro",
      badge: formatCategoria(l.categoria),
      photo_url: photo,
      route: {
        type: "lugar" as const,
        citySlug: l.destinos?.slug ?? "rio-de-janeiro",
        lugarId: l.id,
      },
    });
  }

  return items;
}

function formatCategoria(cat: string): string {
  const map: Record<string, string> = {
    restaurante: "Onde Comer",
    bar: "Vida Noturna",
    cafe: "Café",
    atracao: "O que Fazer",
    experiencia: "Experiência",
    praia: "Praia",
    parque: "Natureza",
    compras: "Compras",
    cultura: "Cultura",
  };
  return map[cat] || cat;
}

// ── Fetch Lucky Lists ─────────────────────────────────────────────────────────

async function fetchLuckyLists(): Promise<HeroComposedItem[]> {
  const { data, error } = await supabase
    .from("lucklists")
    .select("id, slug, titulo, capa_url")
    .eq("ativo", true)
    .not("capa_url", "is", null)
    .order("ordem", { ascending: true })
    .limit(2);

  if (error || !data) {
    console.warn("[HERO] lucklists fetch failed:", error?.message);
    return [];
  }

  return data.map((l) => ({
    id: l.id,
    source_table: "lucklists" as const,
    titulo: l.titulo,
    localizacao: "Curadoria",
    badge: "Lucky List",
    photo_url: l.capa_url,
    route: { type: "lucklist" as const, slug: l.slug },
  }));
}

// ── Main Hook ─────────────────────────────────────────────────────────────────

type State = {
  items: HeroComposedItem[];
  loading: boolean;
};

export function useHeroComposed(): State {
  const [state, setState] = useState<State>({ items: [], loading: true });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      console.log("[HERO] Iniciando composição dinâmica...");

      // Fetch all in parallel
      const [destinos, amigos, lugares, lucklists] = await Promise.all([
        fetchDestinos(),
        fetchAmigos(),
        fetchLugaresDestaque(),
        fetchLuckyLists(),
      ]);

      if (cancelled) return;

      // ── Ordenar: Rio primeiro, depois outros destinos, amigos, lugares, lucklists
      const rioIndex = destinos.findIndex(
        (d) => d.route.type === "cidade" &&
          (d.route.slug === "rio-de-janeiro" || d.route.slug === "rio")
      );

      let orderedDestinos = [...destinos];
      if (rioIndex > 0) {
        const [rio] = orderedDestinos.splice(rioIndex, 1);
        orderedDestinos.unshift(rio);
        console.log("[HERO] Rio movido para posição 0");
      }

      const items: HeroComposedItem[] = [
        ...orderedDestinos,
        ...amigos,
        ...lugares,
        ...lucklists,
      ];

      console.log(`[HERO] Composição final: ${items.length} items`);
      console.log("[HERO] Breakdown:", {
        destinos: orderedDestinos.length,
        amigos: amigos.length,
        lugares: lugares.length,
        lucklists: lucklists.length,
      });

      items.forEach((item, i) => {
        console.log(`[HERO ${i}] ${item.source_table}: ${item.titulo} | photo: ${item.photo_url ? "✓" : "✗"}`);
      });

      if (!cancelled) {
        setState({ items, loading: false });
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return state;
}
