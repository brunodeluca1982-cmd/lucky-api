// hooks/useHeroFotos.ts — Load hero photos from Supabase storage (media bucket)
import { useState, useEffect } from "react";

// Media storage is in a separate Supabase project
const MEDIA_STORAGE_URL = "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1";

// Known hero photos per destination (bucket listing is disabled, so we use direct URLs)
const HERO_PHOTOS: Record<string, string[]> = {
  "rio-de-janeiro": [
    `${MEDIA_STORAGE_URL}/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg`,
    `${MEDIA_STORAGE_URL}/object/public/media/rio-de-janeiro/hero/foto/imagehero02.jpg`,
    `${MEDIA_STORAGE_URL}/object/public/media/rio-de-janeiro/hero/foto/imagehero03.jpg`,
    `${MEDIA_STORAGE_URL}/object/public/media/rio-de-janeiro/hero/foto/imagehero04.jpg`,
    `${MEDIA_STORAGE_URL}/object/public/media/rio-de-janeiro/hero/foto/imagehero05.jpg`,
  ],
};

/**
 * Returns hero photos from Supabase storage for a given destination slug.
 * Uses hardcoded URLs since bucket listing is disabled.
 */
export function useHeroFotos(slug: string) {
  const [fotos, setFotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    // Use known photos for this destination
    const photos = HERO_PHOTOS[slug] ?? [];
    setFotos(photos);
    setLoading(false);
  }, [slug]);

  return { fotos, loading };
}
