/**
 * onboarding/index.tsx
 *
 * 4-slide fullscreen onboarding. Only shown on first cold launch.
 * AsyncStorage key: @luckytrip/onboarding_seen
 *
 * Slide 1 — EXCLUSIVIDADE  — A curadoria do Bruno
 * Slide 2 — INSPIRE-SE     — Salve o que inspira
 * Slide 3 — CRIE           — Seu roteiro, do seu jeito
 * Slide 4 — BEM-VINDO      — Rio de Janeiro te espera (+ 3 CTAs)
 */

import React, { useRef, useState } from "react";
import {
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";

const { width: W, height: H } = Dimensions.get("window");
const GOLD  = "#1B4F72";
const KEY   = "@luckytrip/onboarding_seen";

// ─── Data ────────────────────────────────────────────────────────────────────

interface Slide {
  id: string;
  tag: string;
  title: string;
  desc: string;
  image: ImageSourcePropType;
}

const SLIDES: Slide[] = [
  {
    id: "1",
    tag: "EXCLUSIVIDADE",
    title: "A curadoria\ndo Bruno",
    desc: "18 anos. Mais de 200 destinos. Os segredos que nenhum guia vai te contar.",
    image: require("@/assets/images/rio-aerial-clean.png"),
  },
  {
    id: "2",
    tag: "INSPIRE-SE",
    title: "Salve o que\ninspirar você",
    desc: "Viu um lugar lindo no Instagram? Salve no app e transforme inspiração em roteiro real.",
    image: require("@/assets/images/secret1.png"),
  },
  {
    id: "3",
    tag: "CRIE",
    title: "Seu roteiro,\ndo seu jeito",
    desc: "O Lucky AI monta um roteiro personalizado baseado no seu estilo e nos melhores lugares.",
    image: require("@/assets/images/lapa.png"),
  },
  {
    id: "4",
    tag: "BEM-VINDO",
    title: "Rio de Janeiro\nte espera",
    desc: "Explore a cidade como quem mora lá. Curadoria exclusiva do Bruno de Luca.",
    image: require("@/assets/images/pao-acucar.png"),
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function done(dest: "perfil" | "home") {
  await AsyncStorage.setItem(KEY, "1");
  router.replace(dest === "perfil" ? "/(tabs)/perfil" : "/(tabs)");
}

// ─── Slide component ─────────────────────────────────────────────────────────

function SlideView({
  item,
  isLast,
  topInset,
  bottomInset,
  onNext,
}: {
  item: Slide;
  isLast: boolean;
  topInset: number;
  bottomInset: number;
  onNext: () => void;
}) {
  const bottomPad = bottomInset + 40;

  return (
    <View style={sv.root}>
      {/* Full-bleed photo */}
      <Image source={item.image} style={sv.photo} resizeMode="cover" />

      {/* Gradient: subtle at top (skip-button area), heavy at bottom */}
      <LinearGradient
        colors={[
          "rgba(0,0,0,0.22)",
          "transparent",
          "transparent",
          "rgba(0,0,0,0.50)",
          "rgba(0,0,0,0.84)",
          "rgba(0,0,0,0.96)",
        ]}
        locations={[0, 0.08, 0.42, 0.62, 0.82, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Skip — top right (not on last slide) */}
      {!isLast && (
        <Pressable
          style={[sv.skip, { top: topInset + 14 }]}
          onPress={() => done("home")}
          hitSlop={12}
        >
          <Text style={sv.skipText}>Pular</Text>
        </Pressable>
      )}

      {/* Bottom content block */}
      <View style={[sv.bottom, { paddingBottom: isLast ? bottomPad + 24 : bottomPad }]}>

        {/* Badge */}
        <View style={sv.badgeWrap}>
          <Text style={sv.badgeText}>{item.tag}</Text>
        </View>

        {/* Title */}
        <Text style={sv.title}>{item.title}</Text>

        {/* Description */}
        <Text style={sv.desc}>{item.desc}</Text>

        {/* CTAs — last slide only */}
        {isLast && (
          <View style={sv.ctas}>
            <Pressable
              style={({ pressed }) => [sv.ctaPrimary, pressed && { opacity: 0.88 }]}
              onPress={() => done("perfil")}
            >
              <Text style={sv.ctaPrimaryText}>Criar minha conta</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [sv.ctaOutline, pressed && { opacity: 0.75 }]}
              onPress={() => done("perfil")}
            >
              <Text style={sv.ctaOutlineText}>Já tenho conta</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [sv.ctaText, pressed && { opacity: 0.55 }]}
              onPress={() => done("home")}
            >
              <Text style={sv.ctaTextLabel}>Continuar sem conta</Text>
            </Pressable>
          </View>
        )}

        {/* Next arrow — all slides except last */}
        {!isLast && (
          <Pressable
            style={({ pressed }) => [sv.nextBtn, pressed && { opacity: 0.78, transform: [{ scale: 0.95 }] }]}
            onPress={onNext}
          >
            <Feather name="arrow-right" size={20} color="#000" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const sv = StyleSheet.create({
  root: {
    width: W,
    height: H,
    backgroundColor: "#000",
  },
  photo: {
    width: W,
    height: H,
  },
  skip: {
    position: "absolute",
    right: 22,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  skipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.52)",
    letterSpacing: 0.2,
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 28,
    gap: 0,
  },
  badgeWrap: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(27,79,114,0.14)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.32)",
    paddingHorizontal: 13,
    paddingVertical: 5,
    marginBottom: 18,
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: GOLD,
    letterSpacing: 2.0,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 48,
    color: "#FFFFFF",
    lineHeight: 56,
    letterSpacing: -0.5,
    marginBottom: 16,
    textShadowColor: "rgba(0,0,0,0.70)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  desc: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.72)",
    lineHeight: 23,
    marginBottom: 32,
  },
  // Next button — filled gold circle
  nextBtn: {
    alignSelf: "flex-end",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  // CTAs (last slide)
  ctas: {
    gap: 12,
    marginTop: 4,
  },
  ctaPrimary: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  ctaPrimaryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#000000",
    letterSpacing: 0.1,
  },
  ctaOutline: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.50)",
    paddingVertical: 10,
    alignItems: "center",
  },
  ctaOutlineText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: "rgba(255,255,255,0.88)",
  },
  ctaText: {
    paddingVertical: 10,
    alignItems: "center",
  },
  ctaTextLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13.5,
    color: "rgba(255,255,255,0.42)",
  },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const insets  = useSafeAreaInsets();
  const flatRef = useRef<FlatList>(null);
  const [idx, setIdx] = useState(0);

  const onViewable = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) setIdx(viewableItems[0].index);
    }
  ).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const isLast = idx === SLIDES.length - 1;

  function goNext() {
    if (idx < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: idx + 1, animated: true });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={viewConfig}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
        renderItem={({ item, index }) => (
          <SlideView
            item={item}
            isLast={index === SLIDES.length - 1}
            topInset={insets.top}
            bottomInset={insets.bottom}
            onNext={goNext}
          />
        )}
      />

      {/* Dots indicator — positioned above CTAs / next button */}
      <View
        style={[
          od.dots,
          {
            bottom: insets.bottom + (isLast ? 252 : 120),
          },
        ]}
        pointerEvents="none"
      >
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[od.dot, i === idx && od.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const od = StyleSheet.create({
  dots: {
    position: "absolute",
    left: 28,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  dotActive: {
    width: 22,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: GOLD,
  },
});
