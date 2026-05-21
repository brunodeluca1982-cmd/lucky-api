/**
 * oQueFazer/categorias/[id].tsx
 *
 * Intermediate category-selection screen before the activity list/map.
 * Shown when user taps "O que fazer" on a city page.
 *
 * Layout:
 *  - Fullscreen blurred Rio photo background
 *  - Back button (top-left)
 *  - Header: eyebrow "O QUE FAZER" + city title
 *  - Subtitle: "Escolha uma categoria"
 *  - 3×2 grid of category glass buttons with icon + label
 *  - "Ver todos" shortcut at the bottom
 */

import React from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { RotatingBackground } from "@/components/RotatingBackground";
import { useRioHeroMedia } from "@/hooks/useHeroMedia";
import { destinos } from "@/data/mockData";

const { width: W } = Dimensions.get("window");
const GOLD = "#1B4F72";

const BG_POOL = [
  require("@/assets/images/rio-aerial-clean.png"),
  require("@/assets/images/ipanema.png"),
  require("@/assets/images/lapa.png"),
  require("@/assets/images/secret1.png"),
];

// ─── Categories ───────────────────────────────────────────────────────────────

interface Categoria {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  desc: string;
}

const CATEGORIAS: Categoria[] = [
  { id: "praias",     label: "Praias",      icon: "sun",       desc: "Orla e natureza" },
  { id: "museus",     label: "Museus",      icon: "book-open", desc: "Arte e história" },
  { id: "parques",    label: "Parques",     icon: "map-pin",   desc: "Natureza e vistas" },
  { id: "baladas",    label: "Baladas",     icon: "music",     desc: "Noite e festas" },
  { id: "aventuras",  label: "Aventuras",   icon: "zap",       desc: "Adrenalina e esporte" },
  { id: "exposicoes", label: "Exposições",  icon: "image",     desc: "Cultura e arte" },
];

// Two columns
const GAP   = 10;
const COLS  = 2;
const CARD_W = (W - 48 - GAP) / COLS;

// ─── Card ─────────────────────────────────────────────────────────────────────

function CatCard({
  cat,
  cityId,
}: {
  cat: Categoria;
  cityId: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        c.card,
        { width: CARD_W },
        pressed && { opacity: 0.80, transform: [{ scale: 0.96 }] },
      ]}
      onPress={() =>
        router.push({
          pathname: "/oQueFazer/[id]",
          params: { id: cityId, categoria: cat.id },
        })
      }
    >
      {/* Icon ring */}
      <View style={c.iconRing}>
        <Feather name={cat.icon} size={20} color={GOLD} />
      </View>
      <Text style={c.label}>{cat.label}</Text>
      <Text style={c.desc}>{cat.desc}</Text>
    </Pressable>
  );
}

const c = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "flex-start",
    gap: 8,
  },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${GOLD}14`,
    borderWidth: 1,
    borderColor: `${GOLD}28`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  label: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 17,
    color: "#FFFFFF",
    lineHeight: 22,
  },
  desc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11.5,
    color: "rgba(255,255,255,0.50)",
    lineHeight: 16,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OQueFazerCategoriasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 67 : insets.top + 12;
  const botPad  = Platform.OS === "web" ? 34 : insets.bottom;

  const rioHero = useRioHeroMedia("image");
  const destino = destinos.find((d) => d.id === id) ?? destinos[0];

  return (
    <View style={s.root}>
      {/* Background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <RotatingBackground
          pool={
            rioHero && rioHero.length > 0
              ? rioHero.map((item) => ({ uri: item.public_url }))
              : BG_POOL
          }
          blurRadius={20}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.60)", "rgba(0,0,0,0.50)", "rgba(0,0,0,0.78)"]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Back button */}
      <Pressable
        style={[s.back, { top: topPad }]}
        onPress={() => router.back()}
        hitSlop={12}
      >
        <Feather name="arrow-left" size={18} color="rgba(255,255,255,0.80)" />
      </Pressable>

      {/* Content */}
      <View style={[s.content, { paddingTop: topPad + 56, paddingBottom: botPad + 90 }]}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.eyebrow}>O QUE FAZER</Text>
          <Text style={s.title}>{destino.cidade}</Text>
          <Text style={s.subtitle}>Escolha uma categoria</Text>
        </View>

        {/* 3×2 grid */}
        <View style={s.grid}>
          {[0, 1, 2].map((row) => (
            <View key={row} style={s.row}>
              {CATEGORIAS.slice(row * 2, row * 2 + 2).map((cat) => (
                <CatCard key={cat.id} cat={cat} cityId={id ?? "rio"} />
              ))}
            </View>
          ))}
        </View>

        {/* "Ver todos" shortcut */}
        <Pressable
          style={({ pressed }) => [s.verTodos, pressed && { opacity: 0.65 }]}
          onPress={() =>
            router.push({ pathname: "/oQueFazer/[id]", params: { id: id ?? "rio" } })
          }
        >
          <Text style={s.verTodosText}>Ver todas as experiências</Text>
          <Feather name="arrow-right" size={14} color="rgba(255,255,255,0.42)" />
        </Pressable>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  back: {
    position: "absolute",
    left: 20,
    zIndex: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.36)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 28,
    gap: 6,
  },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: GOLD,
    letterSpacing: 2.5,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 36,
    color: "#FFFFFF",
    lineHeight: 42,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.52)",
    lineHeight: 20,
  },
  grid: {
    gap: GAP,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    gap: GAP,
  },
  verTodos: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },
  verTodosText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13.5,
    color: "rgba(255,255,255,0.42)",
  },
});
