/**
 * useRestaurantes.ts — Fetches restaurants, bars, and cafes from Supabase.
 * Filters: categoria IN ('restaurante', 'bar', 'cafe'), destino_id = Rio, ativo = true
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildMediaUrl } from "@/lib/mediaUrl";

const RIO_DESTINO_ID = "7f047742-427f-4b11-8286-781af899c57d";

export type Restaurante = {
  id: string;
  nome: string;
  slug: string;
  categoria: string;
  meu_olhar: string | null;
  como_aproveitar: string[];
  preco_nivel: number | null;
  instagram: string | null;
  google_maps_url: string | null;
  energia: string | null;
  hero_image_url: string | null;
  bairro_id: string | null;
  bairro_nome: string | null;
  ordem_bairro: number | null;
};

type State = {
  restaurantes: Restaurante[];
  loading: boolean;
  error: string | null;
};

export function useRestaurantes(destinoId: string = RIO_DESTINO_ID): State {
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from("lugares")
        .select(`
          id,
          nome,
          slug,
          categoria,
          meu_olhar,
          como_aproveitar,
          preco_nivel,
          instagram,
          google_maps_url,
          energia,
          hero_image_url,
          bairro_id,
          ordem_bairro,
          bairros (
            nome
          )
        `)
        .eq("destino_id", destinoId)
        .in("categoria", ["restaurante", "bar", "cafe"])
        .eq("ativo", true)
        .not("nome", "ilike", "%v2%")
        .order("categoria")
        .order("ordem_bairro");

      if (cancelled) return;

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      const mapped: Restaurante[] = (data ?? []).map((row: any) => ({
        id: row.id,
        nome: row.nome,
        slug: row.slug,
        categoria: row.categoria,
        meu_olhar: row.meu_olhar,
        como_aproveitar: row.como_aproveitar ?? [],
        preco_nivel: row.preco_nivel,
        instagram: row.instagram,
        google_maps_url: row.google_maps_url,
        energia: row.energia,
        hero_image_url: buildMediaUrl(row.hero_image_url),
        bairro_id: row.bairro_id,
        bairro_nome: row.bairros?.nome ?? null,
        ordem_bairro: row.ordem_bairro,
      }));

      setRestaurantes(mapped);
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, [destinoId]);

  return { restaurantes, loading, error };
}
