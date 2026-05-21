/**
 * BackgroundMedia.tsx — Dynamic background with looping photos from Supabase Storage.
 *
 * MVP: Rio de Janeiro is always the active destination.
 * Fetches photos from media/{slug}/hero/foto/ bucket on mount.
 * Cross-fade transitions every 14 seconds.
 * Exposes currentIndex and currentUrl via onPhotoChange callback.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  View,
  ImageSourcePropType,
} from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Storage config (media bucket)
// ─────────────────────────────────────────────────────────────────────────────
const BASE_STORAGE = "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrd2x4aW1rYWRtbG5iZ2pjcmRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODE0NDgsImV4cCI6MjA5MjE1NzQ0OH0.PWFvL65vANVtBjlDtSCNnq0Rs7RdEVAKcJSgtL4JqMI";

const DESTINO_ATIVO = "rio-de-janeiro"; // MVP: fixed, changeable later

// ─────────────────────────────────────────────────────────────────────────────
// Fetch photos from Supabase Storage bucket
// ─────────────────────────────────────────────────────────────────────────────
async function fetchDestinoBucket(destinoSlug: string): Promise<string[]> {
  try {
    const res = await fetch(`${BASE_STORAGE}/object/list/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ prefix: `${destinoSlug}/hero/foto/`, limit: 100 }),
    });
    const files = await res.json();
    if (!Array.isArray(files)) return [];
    return files
      .filter((f: any) => f.name && !f.name.endsWith("/"))
      .map((f: any) => `${BASE_STORAGE}/object/public/media/${f.name}`);
  } catch (err) {
    console.warn("[BackgroundMedia] fetchDestinoBucket error:", err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Props = {
  /** Override the active destination slug (default: rio-de-janeiro) */
  destinoSlug?: string;
  /** Interval between photo changes in ms (default: 14000) */
  interval?: number;
  /** Cross-fade duration in ms (default: 800) */
  fadeDuration?: number;
  /** Base blur radius (default: 18) */
  blurRadius?: number;
  /** Animated blur value — pass Animated.Value to control blur externally */
  animatedBlur?: Animated.Value;
  /** Callback when photo changes */
  onPhotoChange?: (index: number, url: string) => void;
  /** Callback when photos are loaded */
  onPhotosLoaded?: (urls: string[]) => void;
  /** Fallback image while loading */
  fallbackSource?: ImageSourcePropType;
  /** Overlay color (default: rgba(0,0,0,0.42)) */
  overlayColor?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function BackgroundMedia({
  destinoSlug = DESTINO_ATIVO,
  interval = 14_000,
  fadeDuration = 800,
  blurRadius = 18,
  animatedBlur,
  onPhotoChange,
  onPhotosLoaded,
  fallbackSource,
  overlayColor = "rgba(0,0,0,0.42)",
}: Props) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [nextIdx, setNextIdx] = useState(1);
  const [loading, setLoading] = useState(true);

  const nextOpacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch photos on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const urls = await fetchDestinoBucket(destinoSlug);
      if (cancelled) return;

      if (urls.length > 0) {
        setPhotos(urls);
        setCurrentIdx(0);
        setNextIdx(urls.length > 1 ? 1 : 0);
        onPhotosLoaded?.(urls);
        onPhotoChange?.(0, urls[0]);
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [destinoSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start rotation interval when photos are loaded
  useEffect(() => {
    if (photos.length < 2) return;

    timerRef.current = setInterval(() => {
      Animated.timing(nextOpacity, {
        toValue: 1,
        duration: fadeDuration,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;

        setCurrentIdx((c) => {
          const newCurrent = (c + 1) % photos.length;
          const newNext = (newCurrent + 1) % photos.length;
          setNextIdx(newNext);
          onPhotoChange?.(newCurrent, photos[newCurrent]);
          return newCurrent;
        });
        nextOpacity.setValue(0);
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [photos, interval, fadeDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine blur — use animated value if provided, otherwise static
  const effectiveBlur = animatedBlur ?? blurRadius;

  // Show fallback while loading or if no photos
  if (loading || photos.length === 0) {
    return (
      <View style={styles.container}>
        {fallbackSource && (
          <Animated.Image
            source={fallbackSource}
            style={styles.image}
            resizeMode="cover"
            blurRadius={blurRadius}
          />
        )}
        <View style={[styles.overlay, { backgroundColor: overlayColor }]} />
      </View>
    );
  }

  // Current and next photo sources
  const currentSource = { uri: photos[currentIdx] };
  const nextSource = photos.length > 1 ? { uri: photos[nextIdx] } : currentSource;

  return (
    <View style={styles.container}>
      {/* Current photo */}
      <Animated.Image
        source={currentSource}
        style={styles.image}
        resizeMode="cover"
        blurRadius={typeof effectiveBlur === "number" ? effectiveBlur : blurRadius}
      />

      {/* Next photo (cross-fade) */}
      {photos.length > 1 && (
        <Animated.Image
          source={nextSource}
          style={[styles.image, { opacity: nextOpacity }]}
          resizeMode="cover"
          blurRadius={typeof effectiveBlur === "number" ? effectiveBlur : blurRadius}
        />
      )}

      {/* Overlay for legibility */}
      <View style={[styles.overlay, { backgroundColor: overlayColor }]} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default BackgroundMedia;
