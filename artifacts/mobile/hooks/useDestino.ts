// hooks/useDestino.ts — Fetch destination data from Supabase
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface Destino {
  id: string;
  nome: string;
  slug: string;
  status: "ativo" | "em_breve" | "inativo";
  pais_id: string;
  descricao?: string;
  descricao_curta?: string;
  hero_image_url?: string;
  pais?: {
    nome: string;
    codigo: string;
  };
}

export interface UseDestinoResult {
  destino: Destino | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetch a destination by ID from Supabase
 */
export function useDestino(destinoId: string): UseDestinoResult {
  const [destino, setDestino] = useState<Destino | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!destinoId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchDestino() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: err } = await supabase
          .from("destinos")
          .select(`
            id,
            nome,
            slug,
            status,
            pais_id,
            descricao,
            descricao_curta,
            hero_image_url,
            paises!pais_id (
              nome,
              codigo
            )
          `)
          .eq("id", destinoId)
          .single();

        if (cancelled) return;

        if (err) {
          console.error("[useDestino] Error fetching:", err);
          setError(err.message);
          setLoading(false);
          return;
        }

        if (data) {
          // Transform paises array to pais object
          const pais = Array.isArray(data.paises) ? data.paises[0] : data.paises;
          setDestino({
            ...data,
            pais: pais || undefined,
          } as Destino);
        }

        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          console.error("[useDestino] Exception:", e);
          setError(e instanceof Error ? e.message : "Unknown error");
          setLoading(false);
        }
      }
    }

    fetchDestino();
    return () => { cancelled = true; };
  }, [destinoId]);

  return { destino, loading, error };
}

/**
 * Fetch a destination by slug from Supabase
 */
export function useDestinoBySlug(slug: string): UseDestinoResult {
  const [destino, setDestino] = useState<Destino | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchDestino() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: err } = await supabase
          .from("destinos")
          .select(`
            id,
            nome,
            slug,
            status,
            pais_id,
            descricao,
            descricao_curta,
            hero_image_url,
            paises!pais_id (
              nome,
              codigo
            )
          `)
          .eq("slug", slug)
          .single();

        if (cancelled) return;

        if (err) {
          console.error("[useDestinoBySlug] Error fetching:", err);
          setError(err.message);
          setLoading(false);
          return;
        }

        if (data) {
          const pais = Array.isArray(data.paises) ? data.paises[0] : data.paises;
          setDestino({
            ...data,
            pais: pais || undefined,
          } as Destino);
        }

        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          console.error("[useDestinoBySlug] Exception:", e);
          setError(e instanceof Error ? e.message : "Unknown error");
          setLoading(false);
        }
      }
    }

    fetchDestino();
    return () => { cancelled = true; };
  }, [slug]);

  return { destino, loading, error };
}
