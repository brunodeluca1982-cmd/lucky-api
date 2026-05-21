/**
 * useTransporte.ts — Fetches transportation options from Supabase `transporte_rio`.
 * Returns items ordered by `ordem` for display in the Como Chegar screen.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildMediaUrl } from "@/lib/mediaUrl";

export interface TransporteItem {
  id: string;
  modo: string;
  nome: string;
  descricao: string | null;
  custo_estimado: string | null;
  duracao_estimada: string | null;
  dica_lucky: string | null;
  icone: string | null;
  photo_url: string | null;
  ordem: number;
  ativo: boolean;
}

type State = {
  items: TransporteItem[];
  loading: boolean;
  error: string | null;
};

export function useTransporte(cityId = "rio"): State {
  const [items, setItems]   = useState<TransporteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from("transporte_rio")
        .select("*")
        .eq("ativo", true)
        .order("ordem");

      if (cancelled) return;

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      const mapped = (data ?? []).map((item: any) => ({
        ...item,
        photo_url: buildMediaUrl(item.photo_url),
      })) as TransporteItem[];
      setItems(mapped);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [cityId]);

  return { items, loading, error };
}
