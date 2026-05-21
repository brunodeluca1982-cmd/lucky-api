/**
 * useHoteisByBairro.ts — Fetch hotels from lugares table by bairro
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildMediaUrl } from "@/lib/mediaUrl";

export type HotelCard = {
  id: string;
  nome: string;
  slug: string;
  subcategoria: string | null;
  meu_olhar: string | null;
  preco_nivel: number | null;
  hero_image_url: string | null;
  instagram: string | null;
  google_maps_url: string | null;
  bairro_nome: string;
  rating: number | null;
};

type State = {
  hoteis: HotelCard[];
  loading: boolean;
  error: string | null;
};

export function useHoteisByBairro(bairroId: string | null): State {
  const [hoteis, setHoteis] = useState<HotelCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bairroId) {
      setHoteis([]);
      setLoading(false);
      return;
    }

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
          subcategoria,
          meu_olhar,
          preco_nivel,
          hero_image_url,
          instagram,
          google_maps_url,
          bairros (
            nome
          )
        `)
        .eq("bairro_id", bairroId)
        .eq("categoria", "hotel")
        .eq("ativo", true)
        .not("nome", "ilike", "%v2%")
        .order("ordem_bairro");

      if (cancelled) return;

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      const mapped: HotelCard[] = (data ?? []).map((row: any) => ({
        id: row.id,
        nome: row.nome,
        slug: row.slug,
        subcategoria: row.subcategoria,
        meu_olhar: row.meu_olhar,
        preco_nivel: row.preco_nivel,
        hero_image_url: buildMediaUrl(row.hero_image_url),
        instagram: row.instagram,
        google_maps_url: row.google_maps_url,
        bairro_nome: row.bairros?.nome ?? "",
        rating: 4.5 + Math.random() * 0.4, // Placeholder rating
      }));

      setHoteis(mapped);
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, [bairroId]);

  return { hoteis, loading, error };
}
