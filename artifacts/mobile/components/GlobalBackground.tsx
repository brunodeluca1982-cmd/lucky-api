// components/GlobalBackground.tsx
// Background com fotos do Rio em loop (13s, Fisher-Yates shuffle, fade 400ms)
// Usado em todas as telas do app

import React, { useState, useRef, useEffect } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/lib/supabase";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SUPABASE_URL = "https://bkwlximkadmlnbgjcrdp.supabase.co";
const FALLBACK_HERO = `${SUPABASE_URL}/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg`;

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Hook para buscar fotos do bucket
function useHeroFotosFromBucket(destinoSlug: string) {
  const [fotos, setFotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabase.storage
          .from("media")
          .list(`${destinoSlug}/hero/foto`);

        if (error || !data) {
          setFotos([FALLBACK_HERO]);
          return;
        }

        const urls = data
          .filter(f => f.name.match(/\.(jpg|jpeg|png|webp)$/i) && !f.name.startsWith("."))
          .map(f => `${SUPABASE_URL}/storage/v1/object/public/media/${destinoSlug}/hero/foto/${f.name}`);

        if (!cancelled) {
          setFotos(urls.length > 0 ? shuffleArray(urls) : [FALLBACK_HERO]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [destinoSlug]);

  return { fotos, loading };
}

interface GlobalBackgroundProps {
  // Slug do destino para buscar fotos (default: rio-de-janeiro)
  destinoSlug?: string;
  // Overlay extra para contraste (default: 0.15)
  overlayOpacity?: number;
  // Gradiente inferior para leitura (default: true)
  showGradient?: boolean;
  children?: React.ReactNode;
}

export function GlobalBackground({
  destinoSlug = "rio-de-janeiro",
  overlayOpacity = 0.15,
  showGradient = true,
  children,
}: GlobalBackgroundProps) {
  const [bgPhotoIdx, setBgPhotoIdx] = useState(0);
  const [prevBgPhotoIdx, setPrevBgPhotoIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const bgPhotoIdxRef = useRef(bgPhotoIdx);

  useEffect(() => {
    bgPhotoIdxRef.current = bgPhotoIdx;
  }, [bgPhotoIdx]);

  const { fotos: heroFotos } = useHeroFotosFromBucket(destinoSlug);

  // Auto-rotate every 13s with 400ms fade
  useEffect(() => {
    if (heroFotos.length <= 1) return;

    const interval = setInterval(() => {
      const currentIdx = bgPhotoIdxRef.current;
      const nextIdx = (currentIdx + 1) % heroFotos.length;

      setPrevBgPhotoIdx(currentIdx);
      fadeAnim.setValue(0);
      setBgPhotoIdx(nextIdx);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 13000);

    return () => clearInterval(interval);
  }, [heroFotos.length, fadeAnim]);

  const safeHeroFotos = heroFotos.length > 0 ? heroFotos : [FALLBACK_HERO];
  const currentBgPhoto = safeHeroFotos[bgPhotoIdx % safeHeroFotos.length];
  const prevBgPhoto = safeHeroFotos[prevBgPhotoIdx % safeHeroFotos.length];

  return (
    <View style={styles.container}>
      {/* Background photos with crossfade */}
      <View style={styles.bgContainer}>
        <Animated.Image
          source={{ uri: prevBgPhoto }}
          style={[
            styles.bgImage,
            { opacity: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
          ]}
          resizeMode="cover"
        />
        <Animated.Image
          source={{ uri: currentBgPhoto }}
          style={[styles.bgImage, { opacity: fadeAnim }]}
          resizeMode="cover"
        />

        {/* Overlay for contrast */}
        <View style={[styles.overlay, { backgroundColor: `rgba(0,0,0,${overlayOpacity})` }]} />

        {/* Gradient for text readability */}
        {showGradient && (
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.55)"]}
            locations={[0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
        )}
      </View>

      {/* Content */}
      {children}
    </View>
  );
}

// Componente para telas "Em breve"
interface ComingSoonScreenProps {
  destinoNome: string;
  destinoSlug: string;
}

export function ComingSoonScreen({ destinoNome, destinoSlug }: ComingSoonScreenProps) {
  return (
    <GlobalBackground destinoSlug={destinoSlug} overlayOpacity={0.3}>
      <View style={styles.comingSoonContent}>
        <View style={styles.comingSoonTextContainer}>
          <View style={styles.comingSoonPill}>
            <Text style={styles.comingSoonPillText}>EM BREVE</Text>
          </View>
          <Text style={styles.comingSoonTitle}>{destinoNome}</Text>
          <Text style={styles.comingSoonSubtitle}>Em breve no The Lucky Trip</Text>
          <Text style={styles.comingSoonDescription}>
            Estamos preparando uma curadoria especial para você
          </Text>
        </View>
      </View>
    </GlobalBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  bgContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bgImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },

  // Coming Soon styles
  comingSoonContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  comingSoonTextContainer: {
    alignItems: "center",
  },
  comingSoonPill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  comingSoonPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  comingSoonTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 42,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  comingSoonSubtitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: 8,
  },
  comingSoonDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    maxWidth: 280,
  },
});

export default GlobalBackground;
