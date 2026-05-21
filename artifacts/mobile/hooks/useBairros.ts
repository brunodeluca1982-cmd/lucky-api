import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Bairro = {
  id: string;
  nome: string;
  slug: string;
  lat: number | null;
  lng: number | null;
  destino_id: string;
  ativo: boolean;
  ordem: number;
  descricao_curta?: string;
  identidade?: string;
  melhor_para?: string[];
  caminhavel?: string;
  vida_noturna?: string;
  gastronomia?: string;
  hero_image_url?: string;
};

type State = {
  bairros: Bairro[];
  loading: boolean;
  error: string | null;
};

export function useBairros(destinoId?: string): State {
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("bairros")
        .select("*")
        .eq("ativo", true)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .order("ordem");

      if (destinoId) {
        query = query.eq("destino_id", destinoId);
      }

      const { data, error: err } = await query;

      if (cancelled) return;

      if (err) {
        setError(err.message);
      } else {
        setBairros((data as Bairro[]) ?? []);
      }
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, [destinoId]);

  return { bairros, loading, error };
}
