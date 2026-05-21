/**
 * BackgroundContext.tsx
 *
 * Single global source of truth for the app's atmospheric background system.
 *
 * Data source: v_rio_hero_media_public (Supabase view)
 *   - Rows contain: bucket_id, object_path, mimetype, media_kind, sort_order, public_url
 *   - Videos → Cloudinary fetch to extract frame at second 1 (so_1)
 *   - Images → public_url used directly
 *
 * Architecture:
 *   - Pool fetched ONCE per session, sorted by sort_order
 *   - LOCAL_FALLBACK PNGs used if Supabase returns empty / errors
 *   - One global 12-second timer drives rotation for the ENTIRE app
 *   - All screens share the same pool, currentIdx, nextIdx, nextOpacity
 *   - Navigating between screens never resets the index or restarts the timer
 *   - Image.prefetch called on current + next before each transition
 *
 * Screens that use RotatingBackground (all share this pool):
 *   Home · Destinos · Viagem · Lucky · Perfil
 *
 * PART 6: Hero card uses destinos.hero_image_url (unchanged) — NOT this pool.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Animated, Image, ImageSourcePropType } from "react-native";
import { supabase } from "@/lib/supabase";

// ── Local fallback pool — always available, no network required ──────────────
const LOCAL_FALLBACK: ImageSourcePropType[] = [
  {
    uri: "https://lsibzflaaqzvtzjlvrxw.supabase.co/storage/v1/object/public/media/rio-de-janeiro/6Y6A0193.jpg",
  },
  {
    uri: "https://lsibzflaaqzvtzjlvrxw.supabase.co/storage/v1/object/public/media/rio-de-janeiro/6Y6A0200.jpg",
  },
  {
    uri: "https://lsibzflaaqzvtzjlvrxw.supabase.co/storage/v1/object/public/media/rio-de-janeiro/6Y6A0214.jpg",
  },
];

// ── Cloudinary — extract frame at second 1 from a remote video URL ───────────
const CLOUDINARY_FETCH =
  "https://res.cloudinary.com/dufxamwaf/video/fetch/so_1,w_1080,h_1920,c_fill,g_auto,q_80,f_jpg";

const INTERVAL = 12_000; // 12 seconds between transitions
const FADE_DURATION = 1_500; // 1.5-second cross-fade

// ── Context shape ────────────────────────────────────────────────────────────

interface BackgroundCtxValue {
  pool: ImageSourcePropType[];
  currentIdx: number;
  nextIdx: number;
  nextOpacity: Animated.Value;
  onImageLoaded: () => void;
}

const BackgroundContext = createContext<BackgroundCtxValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

interface ProviderProps {
  children: React.ReactNode;
  onFirstImage?: () => void;
}

export function BackgroundProvider({ children, onFirstImage }: ProviderProps) {
  const [pool, setPool] = useState<ImageSourcePropType[]>(LOCAL_FALLBACK);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [nextIdx, setNextIdx] = useState(1);

  const nextOpacity = useRef(new Animated.Value(0)).current;
  const fetchedRef = useRef(false);
  const firstFiredRef = useRef(false);

  // ── One-time fetch from v_rio_hero_media_public ───────────────────────────
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("v_rio_hero_media_public")
          .select("public_url, media_kind, sort_order")
          .order("sort_order", { ascending: true });

        if (cancelled) return;
        if (error || !data || data.length === 0) {
          console.log(
            "[RIO BACKGROUND] Supabase returned empty — using LOCAL_FALLBACK",
          );
          return;
        }

        const remote: ImageSourcePropType[] = [];
        for (const row of data) {
          if (!row.public_url) continue;
          if (row.media_kind === "video") {
            // Cloudinary fetch extracts a frame at second 1
            remote.push({
              uri: `${CLOUDINARY_FETCH}/${encodeURIComponent(row.public_url)}`,
            });
          } else {
            // Image: use public_url directly from Supabase Storage
            remote.push({ uri: row.public_url });
          }
        }

        if (remote.length === 0) {
          console.log(
            "[RIO BACKGROUND] No usable items — using LOCAL_FALLBACK",
          );
          return;
        }

        console.log(
          `[RIO BACKGROUND ACTIVE] items: ${remote.length} | loop: running | interval: ${INTERVAL / 1000}s`,
        );

        setPool(remote);
        setCurrentIdx(0);
        setNextIdx(1 % remote.length);
        prefetchSources(remote, 0, 1 % remote.length);
      } catch (err) {
        console.warn(
          "[RIO BACKGROUND] fetch failed, using LOCAL_FALLBACK:",
          err,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global 12-second rotation timer ──────────────────────────────────────
  useEffect(() => {
    if (pool.length <= 1) return;

    const timer = setInterval(() => {
      Animated.timing(nextOpacity, {
        toValue: 1,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;

        setCurrentIdx((c) => {
          const next = (c + 1) % pool.length;
          const afterNext = (next + 1) % pool.length;
          setNextIdx(afterNext);
          prefetchSources(pool, next, afterNext);
          return next;
        });

        nextOpacity.setValue(0);
      });
    }, INTERVAL);

    return () => clearInterval(timer);
  }, [pool, nextOpacity]); // eslint-disable-line react-hooks/exhaustive-deps

  function onImageLoaded() {
    if (!firstFiredRef.current) {
      firstFiredRef.current = true;
      onFirstImage?.();
    }
  }

  return (
    <BackgroundContext.Provider
      value={{ pool, currentIdx, nextIdx, nextOpacity, onImageLoaded }}
    >
      {children}
    </BackgroundContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useBackground(): BackgroundCtxValue {
  const ctx = useContext(BackgroundContext);
  if (!ctx) {
    throw new Error("useBackground must be used inside <BackgroundProvider>");
  }
  return ctx;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function prefetchSources(pool: ImageSourcePropType[], ...idxs: number[]): void {
  for (const idx of idxs) {
    const src = pool[idx];
    if (src && typeof src === "object" && "uri" in src) {
      Image.prefetch((src as { uri: string }).uri).catch(() => {});
    }
  }
}
