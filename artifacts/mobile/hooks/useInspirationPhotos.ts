import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildMediaUrl } from "@/lib/mediaUrl";
import type { Inspiration } from "@/utils/buildItinerary";

export type InspirationPhotoMap = Partial<Record<Inspiration, string>>;

async function fetchPhoto(
  table: "o_que_fazer_rio_v2" | "restaurantes",
  filters: { column: string; value: string }[],
  tagFilter?: string,
): Promise<string | null> {
  try {
    let q = supabase.from(table).select("photo_url").not("photo_url", "is", null).eq("ativo", true);

    for (const f of filters) {
      q = (q as any).eq(f.column, f.value);
    }

    if (tagFilter) {
      q = (q as any).contains("tags_ia", [tagFilter]);
    }

    const { data, error } = await (q as any).limit(1).maybeSingle();

    if (error || !data) return null;
    return buildMediaUrl((data as { photo_url: string }).photo_url) || null;
  } catch {
    return null;
  }
}

export function useInspirationPhotos(): InspirationPhotoMap {
  const [photos, setPhotos] = useState<InspirationPhotoMap>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [gastro, natureza, culture, adventure, beach, festa] = await Promise.all([
        fetchPhoto("restaurantes", []),
        fetchPhoto("o_que_fazer_rio_v2", [{ column: "categoria", value: "natureza" }]),
        fetchPhoto("o_que_fazer_rio_v2", [{ column: "categoria", value: "cultura" }]),
        fetchPhoto("o_que_fazer_rio_v2", [{ column: "categoria", value: "trilha" }]),
        fetchPhoto("o_que_fazer_rio_v2", [{ column: "categoria", value: "praia" }]),
        fetchPhoto("o_que_fazer_rio_v2", [], "samba"),
      ]);

      if (!cancelled) {
        const next: InspirationPhotoMap = {};
        if (gastro)   next.gastronomy = gastro;
        if (natureza) next.natureza   = natureza;
        if (culture)  next.culture    = culture;
        if (adventure) next.adventure = adventure;
        if (beach)    next.beach      = beach;
        if (festa)    next.festa      = festa;
        setPhotos(next);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return photos;
}
