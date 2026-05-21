import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildMediaUrl } from "@/lib/mediaUrl";

export type Lugar = {
  id: string;
  nome: string;
  slug: string;
  categoria: string;
  subcategoria?: string;
  meu_olhar?: string;
  como_aproveitar?: string[];
  momento_ideal?: string[];
  vibe?: string[];
  energia?: string;
  preco_nivel?: number;
  instagram?: string;
  website?: string;
  google_maps_url?: string;
  hero_image_url?: string;
  destino_id: string;
  bairro_id?: string;
  autor_id: string;
  ativo: boolean;
  destaque: boolean;
  ordem_bairro?: number;
};

type State = {
  lugares: Lugar[];
  loading: boolean;
  error: string | null;
};

export function useLugaresByBairro(bairroId?: string | null): State {
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bairroId) {
      setLugares([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from("lugares")
        .select("*")
        .eq("bairro_id", bairroId)
        .eq("ativo", true)
        .not("nome", "ilike", "%v2%")
        .order("ordem_bairro");

      if (cancelled) return;

      if (err) {
        setError(err.message);
      } else {
        const mapped = (data ?? []).map((item: any) => ({
          ...item,
          hero_image_url: buildMediaUrl(item.hero_image_url),
        })) as Lugar[];
        setLugares(mapped);
      }
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, [bairroId]);

  return { lugares, loading, error };
}
