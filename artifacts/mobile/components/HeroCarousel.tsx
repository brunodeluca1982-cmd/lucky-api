import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const C = Colors.light;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = Math.round(SCREEN_WIDTH * 1.1);

export type HeroCardType = "destino" | "em_breve" | "guia" | "dica";

export interface HeroItem {
  id: string;
  cidade: string;         // city name OR friend name
  pais: string;           // country OR city (for guides)
  badge: string;          // "DESTINO" | "EM BREVE" | "GUIA EXCLUSIVO" | category label
  image: ImageSourcePropType;
  type?: HeroCardType;    // determines tap behaviour
  cityId?: string;        // for destino/em_breve
  friendSlug?: string;    // for guia
  route?: string;         // custom route override
  comingSoonCopy?: string; // shown in Alert for EM BREVE cards
}

interface HeroCarouselProps {
  items: HeroItem[];
  onIndexChange?: (index: number) => void;
}

function handleSlidePress(item: HeroItem) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const type = item.type ?? (item.cityId === "rio" ? "destino" : item.cityId ? "em_breve" : undefined);

  if (type === "guia" && item.friendSlug) {
    router.push({ pathname: "/friend/[slug]", params: { slug: item.friendSlug } });
    return;
  }

  if (type === "em_breve") {
    Alert.alert(
      item.cidade,
      item.comingSoonCopy ?? "Estamos preparando esse destino com o cuidado do The Lucky Trip.",
      [{ text: "OK" }]
    );
    return;
  }

  if (type === "destino" || item.cityId === "rio") {
    if (item.route) {
      router.push(item.route as any);
    } else if (item.cityId) {
      router.push({ pathname: "/(tabs)/cidade/[id]", params: { id: item.cityId } });
    }
    return;
  }

  if (item.route) {
    router.push(item.route as any);
  }
}

function getAdaptiveFontSize(text: string): number {
  const len = text.length;
  if (len <= 8) return 44;
  if (len <= 14) return 36;
  if (len <= 22) return 28;
  return 24;
}

function HeroSlide({ item }: { item: HeroItem }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.slide, pressed && { opacity: 0.94 }]}
      onPress={() => handleSlidePress(item)}
    >
      <Image source={item.image} style={styles.image} resizeMode="cover" />
      <View style={styles.dimOverlay} />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.50)", "rgba(0,0,0,0.88)"]}
        style={styles.gradient}
        locations={[0.20, 0.58, 1]}
      />
      <View style={styles.content}>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
        <Text style={[styles.cidade, { fontSize: getAdaptiveFontSize(item.cidade) }]}>{item.cidade}</Text>
        <Text style={styles.pais}>{item.pais}</Text>
        {/* "Conferir agora" CTA — shown for actionable cards only */}
        {(item.type === "destino" || item.type === "guia") && (
          <View style={styles.ctaBtn}>
            <Text style={styles.ctaBtnText}>Conferir agora</Text>
            <Feather name="arrow-right" size={12} color="#000" style={{ marginLeft: 4 }} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

export function HeroCarousel({ items, onIndexChange }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        const idx = viewableItems[0].index;
        setActiveIndex(idx);
        onIndexChange?.(idx);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  useEffect(() => {
    autoplayRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % items.length;
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        onIndexChange?.(next);
        return next;
      });
    }, 11000);
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [items.length]);

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => <HeroSlide item={item} />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />
      <View style={styles.dots}>
        {items.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  slide: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  image: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_HEIGHT * 0.80,
  },
  content: {
    position: "absolute",
    bottom: 72,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  badgeContainer: {
    backgroundColor: "rgba(27,79,114,0.14)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.35)",
  },
  badgeText: {
    color: "#1B4F72",
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  cidade: {
    fontFamily: "PlayfairDisplay_700Bold",
    // fontSize dinâmico via getAdaptiveFontSize()
    color: C.white,
    textAlign: "center",
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.90)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  pais: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.80)",
    marginTop: 6,
    marginBottom: 18,
    letterSpacing: 3,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.70)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1B4F72",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  ctaBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#000000",
    letterSpacing: 0.3,
  },
  dots: {
    position: "absolute",
    bottom: 38,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.38)",
  },
  dotActive: {
    backgroundColor: "#1B4F72",
    width: 26,
    height: 5,
    borderRadius: 2.5,
  },
});
