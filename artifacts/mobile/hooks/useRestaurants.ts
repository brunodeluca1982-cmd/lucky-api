/**
 * useRestaurants.ts
 *
 * Fetches restaurants from Supabase `restaurantes` table.
 * Image resolution strategy:
 *   1. restaurantes.photo_url  (already present in most rows)
 *   2. place_photos.photo_url  (fallback: item_type='restaurantes', item_id=String(id))
 *   3. null                    (caller renders a neutral placeholder)
 */

import { useEffect, useState } from "react";
import { supabase, type Restaurante } from "@/lib/supabase";
import { buildMediaUrl } from "@/lib/mediaUrl";

type State = {
  restaurantes: Restaurante[];
  loading: boolean;
  error: string | null;
};

export function useRestaurants(cidadeId?: string): State {
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // ── 1. Fetch restaurants ──────────────────────────────────────────────
      const { data: rows, error: rErr } = await supabase
        .from("restaurantes")
        .select(
          "id, nome, bairro, categoria, especialidade, perfil_publico, meu_olhar, preco_nivel, instagram, google_maps_url, photo_url, ativo, ordem_bairro",
        )
        .eq("ativo", true)
        .order("ordem_bairro")
        .order("id");

      if (cancelled) return;

      if (rErr) {
        setError(rErr.message);
        setLoading(false);
        return;
      }

      const rawRows = (rows ?? []) as Omit<Restaurante, "resolvedPhotoUri">[];

      // ── 2. Fetch place_photos fallbacks for rows missing photo_url ────────
      const missingIds = rawRows
        .filter((r) => !r.photo_url)
        .map((r) => String(r.id));

      let photoMap: Record<string, string> = {};

      if (missingIds.length > 0) {
        const { data: photos } = await supabase
          .from("place_photos")
          .select("item_id, photo_url")
          .eq("item_type", "restaurantes")
          .in("item_id", missingIds);

        if (!cancelled && photos) {
          for (const p of photos) {
            if (p.photo_url) photoMap[p.item_id] = p.photo_url;
          }
        }
      }

      if (cancelled) return;

      // ── 3. Render immediately with Supabase / place_photos ────────────────
      const merged: Restaurante[] = rawRows.map((r) => ({
        ...r,
        resolvedPhotoUri: buildMediaUrl(r.photo_url ?? photoMap[String(r.id)]) || null,
      }));

      setRestaurantes(merged);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [cidadeId]);

  return { restaurantes, loading, error };
}
