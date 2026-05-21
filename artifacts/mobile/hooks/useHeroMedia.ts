/**
 * useHeroMedia.ts — Fetches hero/background media from Supabase.
 *
 * useHomeHeroMedia  → home_hero_items (videos from Supabase Storage)
 * useRioHeroMedia   → v_rio_hero_media_public (images/videos from storage)
 *
 * Both hooks return null on error or empty result — callers must keep their
 * local fallback pool and render it when the hook returns null.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HomeHeroItem {
  video_url: string;
  thumbnail_url: string | null;
}

export interface RioHeroItem {
  public_url: string;
  media_kind: string;
}

// ── useHomeHeroMedia ───────────────────────────────────────────────────────────
// Source: home_hero_items — curated list, all 7 items have video_url.
// Slug: 'rio-de-janeiro' (confirmed in DB).

export function useHomeHeroMedia(): HomeHeroItem[] | null {
  const [items, setItems] = useState<HomeHeroItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("home_hero_items")
        .select("video_url, thumbnail_url")
        .eq("destination_slug", "rio-de-janeiro")
        .eq("is_active", true)
        .eq("show_on_home", true)
        .not("video_url", "is", null)
        .order("sort_order");

      if (cancelled) return;
      if (error || !data || data.length === 0) return; // keep null → caller uses fallback

      setItems(
        data.map((row) => ({
          video_url:     row.video_url as string,
          thumbnail_url: (row.thumbnail_url as string | null) ?? null,
        }))
      );
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return items;
}

// ── useRioHeroMedia ────────────────────────────────────────────────────────────
// Source: v_rio_hero_media_public — storage-based view with public_url + media_kind.
// Pass mediaKind='image' for image-only pool (current default for all tabs).
// Omit mediaKind to receive all media (images + videos).

export function useRioHeroMedia(mediaKind?: "image" | "video"): RioHeroItem[] | null {
  const [items, setItems] = useState<RioHeroItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let query = supabase
        .from("v_rio_hero_media_public")
        .select("public_url, media_kind")
        .order("sort_order");

      if (mediaKind) {
        query = query.eq("media_kind", mediaKind);
      }

      const { data, error } = await query;

      if (cancelled) return;
      if (error || !data || data.length === 0) return; // keep null → caller uses fallback

      setItems(
        data.map((row) => ({
          public_url: row.public_url as string,
          media_kind: row.media_kind as string,
        }))
      );
    }

    load();
    return () => { cancelled = true; };
  }, [mediaKind]);

  return items;
}
