// hooks/useLugarFotos.ts — Busca fotos de uma entidade com fallbacks
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { buildMediaUrl } from "@/lib/mediaUrl";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://bkwlximkadmlnbgjcrdp.supabase.co";

export interface Lugar {
  id: string;
  nome: string;
  destino_slug?: string;
  destino_id?: string;
  hero_image_url?: string | null;
  fotos?: string[] | null;
  foto_cache_url?: string | null;
  google_place_id?: string | null;
}

export function useLugarFotos(lugar: Lugar | null) {
  const [fotos, setFotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lugar) {
      setFotos([]);
      setLoading(false);
      return;
    }

    // Copy to local const to satisfy TypeScript
    const currentLugar = lugar;
    let cancelled = false;

    async function load() {
      setLoading(true);

      // 1. Verificar se tem fotos no array fotos[] do banco
      if (currentLugar.fotos && currentLugar.fotos.length > 0) {
        const urls = currentLugar.fotos
          .map((f) => (f.startsWith("http") ? f : buildMediaUrl(f)))
          .filter(Boolean);
        if (urls.length > 0 && !cancelled) {
          setFotos(urls);
          setLoading(false);
          return;
        }
      }

      // 2. Verificar se tem hero_image_url
      if (currentLugar.hero_image_url) {
        const url = currentLugar.hero_image_url.startsWith("http")
          ? currentLugar.hero_image_url
          : buildMediaUrl(currentLugar.hero_image_url);
        if (!cancelled) {
          setFotos([url]);
          setLoading(false);
          return;
        }
      }

      // 3. Verificar se tem foto em cache do Google Places
      if (currentLugar.foto_cache_url) {
        if (!cancelled) {
          setFotos([currentLugar.foto_cache_url]);
          setLoading(false);
          return;
        }
      }

      // 4. Buscar no storage do Supabase: media/{destino_slug}/entidades/{lugar_id}/
      const destinoSlug = currentLugar.destino_slug || "rio-de-janeiro";
      try {
        const { data, error } = await supabase.storage
          .from("media")
          .list(`${destinoSlug}/entidades/${currentLugar.id}`);

        if (!error && data && data.length > 0) {
          const urls = data
            .filter((f) => f.name.match(/\.(jpg|jpeg|png|webp)$/i))
            .map(
              (f) =>
                `${SUPABASE_URL}/storage/v1/object/public/media/${destinoSlug}/entidades/${currentLugar.id}/${f.name}`
            );
          if (urls.length > 0 && !cancelled) {
            setFotos(urls);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn("Erro ao buscar fotos no storage:", e);
      }

      // 5. Fallback: foto genérica do destino
      if (!cancelled) {
        setFotos([
          `${SUPABASE_URL}/storage/v1/object/public/media/${destinoSlug}/hero/foto/imagehero01.jpg`,
        ]);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [lugar?.id, lugar?.fotos, lugar?.hero_image_url, lugar?.foto_cache_url]);

  return { fotos, loading };
}
