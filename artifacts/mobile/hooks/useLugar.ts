// hooks/useLugar.ts — Busca dados completos de um lugar
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface LugarCompleto {
  id: string;
  nome: string;
  slug: string;
  categoria: string;
  subcategoria: string | null;
  tipo: string | null;
  meu_olhar: string | null;
  como_aproveitar: string[] | null;
  momento_ideal: string[] | null;
  vibe: string[] | null;
  energia: string | null;
  duracao_media: string | null;
  preco_nivel: number | null;
  reserva_necessaria: boolean | null;
  horarios: any | null;
  instagram: string | null;
  telefone: string | null;
  website: string | null;
  url_reserva: string | null;
  google_maps_url: string | null;
  google_place_id: string | null;
  endereco: string | null;
  lat: number | null;
  lng: number | null;
  hero_image_url: string | null;
  fotos: string[] | null;
  foto_cache_url: string | null;
  destino_id: string;
  bairro_id: string | null;
  // Joins
  destino?: { slug: string; nome: string } | null;
  bairro?: { nome: string; slug: string } | null;
}

export function useLugar(lugarId: string | null) {
  const [lugar, setLugar] = useState<LugarCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lugarId) {
      setLugar(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: err } = await supabase
          .from("lugares")
          .select(`
            *,
            destino:destinos!destino_id(slug, nome),
            bairro:bairros!bairro_id(nome, slug)
          `)
          .eq("id", lugarId)
          .single();

        if (err) throw err;

        if (!cancelled && data) {
          setLugar({
            ...data,
            destino: data.destino as any,
            bairro: data.bairro as any,
          });
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? "Erro ao carregar lugar");
          setLugar(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [lugarId]);

  return { lugar, loading, error };
}
