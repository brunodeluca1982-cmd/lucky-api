/**
 * useBairro.ts — Fetch a single bairro by slug with full details
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type BairroDetalhado = {
  id: string;
  nome: string;
  slug: string;
  hero_image_url: string | null;
  identidade: string | null;
  descricao_curta: string | null;
  meu_olhar: string | null;
  melhor_para: string[];
  caminhavel: string | null;
  vida_noturna: string | null;
  gastronomia: string | null;
  seguranca: string | null;
  lat: number | null;
  lng: number | null;
  google_maps_url: string | null;
  destino_nome: string;
};

type State = {
  bairro: BairroDetalhado | null;
  loading: boolean;
  error: string | null;
};

export function useBairro(slug: string | null): State {
  const [bairro, setBairro] = useState<BairroDetalhado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setBairro(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from("bairros")
        .select(`
          id,
          nome,
          slug,
          hero_image_url,
          identidade,
          descricao_curta,
          meu_olhar,
          melhor_para,
          caminhavel,
          vida_noturna,
          gastronomia,
          seguranca,
          lat,
          lng,
          google_maps_url,
          destinos (
            nome
          )
        `)
        .eq("slug", slug)
        .single();

      if (cancelled) return;

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      if (data) {
        setBairro({
          id: data.id,
          nome: data.nome,
          slug: data.slug,
          hero_image_url: data.hero_image_url,
          identidade: data.identidade,
          descricao_curta: data.descricao_curta,
          meu_olhar: (data as any).meu_olhar ?? null,
          melhor_para: data.melhor_para ?? [],
          caminhavel: data.caminhavel,
          vida_noturna: data.vida_noturna,
          gastronomia: data.gastronomia,
          seguranca: (data as any).seguranca ?? null,
          lat: data.lat,
          lng: data.lng,
          google_maps_url: (data as any).google_maps_url ?? null,
          destino_nome: (data as any).destinos?.nome ?? "Rio de Janeiro",
        });
      }

      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, [slug]);

  return { bairro, loading, error };
}
