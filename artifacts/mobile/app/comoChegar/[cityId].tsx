/**
 * Como chegar em [cidade] — Transportation guide from Supabase.
 *
 * Data: 100% from `transporte_rio` table — no hardcoded tips.
 * Groups items by `modo` for visual organization.
 */

import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useTransporte, type TransporteItem } from "@/hooks/useTransporte";

const C = Colors.light;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ── Hero background (local asset, always available) ──────────────────────────
const HERO_IMAGE = require("@/assets/images/pao-acucar.png");

// ── Transport mode labels and display config ──────────────────────────────────
const MODO_META: Record<string, { label: string; icon: string; color: string }> = {
  aeroporto: { label: "Aeroportos",          icon: "navigation", color: "#8AB4D4" },
  taxi_app:  { label: "Táxi & Aplicativos",  icon: "smartphone", color: "#1B4F72" },
  onibus:    { label: "Ônibus",              icon: "map",        color: "#82C49D" },
  metro:     { label: "Metrô",              icon: "grid",       color: "#C07C40" },
  vlt:       { label: "VLT",               icon: "navigation", color: "#A07CC0" },
  ferry:     { label: "Barcas",            icon: "anchor",     color: "#6AAFBF" },
  carro:     { label: "Carro",             icon: "key",        color: "#BF8FA0" },
};

// ── Icons (Feather subset) ────────────────────────────────────────────────────
type FeatherIconName =
  | "navigation" | "smartphone" | "map" | "grid"
  | "anchor" | "key" | "bus" | "train" | "coffee" | "info";

function getModoIcon(icone: string | null, modo: string): FeatherIconName {
  const map: Record<string, FeatherIconName> = {
    plane:      "navigation",
    smartphone: "smartphone",
    car:        "navigation",
    bus:        "map",
    train:      "grid",
    "tram-car": "navigation",
    anchor:     "anchor",
    key:        "key",
  };
  return (icone ? map[icone] : undefined) ?? (MODO_META[modo]?.icon as FeatherIconName) ?? "info";
}

// ── Card component ────────────────────────────────────────────────────────────
function TransporteCard({ item, modoColor }: { item: TransporteItem; modoColor: string }) {
  return (
    <View style={s.card}>
      {/* Icon badge */}
      <View style={[s.iconBadge, { backgroundColor: modoColor + "22" }]}>
        <Feather
          name={getModoIcon(item.icone, item.modo)}
          size={22}
          color={modoColor}
        />
      </View>

      <View style={s.cardBody}>
        <Text style={s.cardNome}>{item.nome}</Text>

        {item.descricao ? (
          <Text style={s.cardDescricao}>{item.descricao}</Text>
        ) : null}

        {/* Cost + duration row */}
        {(item.custo_estimado || item.duracao_estimada) ? (
          <View style={s.metaRow}>
            {item.custo_estimado ? (
              <View style={s.metaChip}>
                <Feather name="tag" size={11} color="#1B4F72" style={{ marginRight: 4 }} />
                <Text style={s.metaText}>{item.custo_estimado}</Text>
              </View>
            ) : null}
            {item.duracao_estimada ? (
              <View style={s.metaChip}>
                <Feather name="clock" size={11} color="rgba(255,255,255,0.45)" style={{ marginRight: 4 }} />
                <Text style={[s.metaText, { color: "rgba(255,255,255,0.55)" }]}>{item.duracao_estimada}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Lucky tip */}
        {item.dica_lucky ? (
          <View style={s.tipRow}>
            <Text style={s.tipStar}>✦</Text>
            <Text style={s.tipText}>{item.dica_lucky}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ComoChegar() {
  const insets       = useSafeAreaInsets();
  const { cityId }   = useLocalSearchParams<{ cityId: string }>();
  const { items, loading, error } = useTransporte(cityId ?? "rio");

  // Group by modo, preserving order of first appearance
  const groups = useMemo<{ modo: string; items: TransporteItem[] }[]>(() => {
    const map = new Map<string, TransporteItem[]>();
    for (const item of items) {
      if (!map.has(item.modo)) map.set(item.modo, []);
      map.get(item.modo)!.push(item);
    }
    return Array.from(map.entries()).map(([modo, arr]) => ({ modo, items: arr }));
  }, [items]);

  const HERO_H = 220;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={s.root}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <View style={{ height: HERO_H }}>
          <View style={s.heroBg} />
          <LinearGradient
            colors={["rgba(26,14,4,0)", "rgba(26,14,4,0.55)", "#1A0E04"]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Back button */}
          <Pressable
            style={[s.backBtn, { top: insets.top + 14 }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.85)" />
          </Pressable>

          {/* Hero text */}
          <View style={[s.heroText, { bottom: 28 }]}>
            <Text style={s.eyebrow}>THE LUCKY TRIP</Text>
            <Text style={s.heroTitle}>Como chegar{"\n"}no Rio</Text>
          </View>
        </View>

        {/* ── Intro ──────────────────────────────────────────────────────── */}
        <View style={s.intro}>
          <Text style={s.introText}>
            O Rio tem dois aeroportos e uma malha de transporte que vai do moderno VLT aos bondes históricos. Aqui está tudo que você precisa saber.
          </Text>
        </View>

        {/* ── Groups ─────────────────────────────────────────────────────── */}
        {loading ? (
          <ActivityIndicator color="#1B4F72" style={{ marginTop: 48 }} />
        ) : error ? (
          <Text style={s.errorText}>Erro ao carregar: {error}</Text>
        ) : (
          <View style={s.content}>
            {groups.map(({ modo, items: groupItems }) => {
              const meta     = MODO_META[modo] ?? { label: modo, icon: "info", color: "#1B4F72" };
              const modoColor = meta.color;
              return (
                <View key={modo} style={s.section}>
                  {/* Section header */}
                  <View style={s.sectionHeader}>
                    <View style={[s.sectionDot, { backgroundColor: modoColor }]} />
                    <Text style={[s.sectionLabel, { color: modoColor }]}>{meta.label.toUpperCase()}</Text>
                  </View>

                  {groupItems.map((item) => (
                    <TransporteCard key={item.id} item={item} modoColor={modoColor} />
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Footer CTA ─────────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Pressable
            style={s.footerBtn}
            onPress={() => Linking.openURL("https://maps.app.goo.gl/RioDeJaneiro")}
          >
            <Feather name="map-pin" size={15} color="#1B4F72" />
            <Text style={s.footerBtnText}>Abrir no Google Maps</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1A0E04",
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#2A1A0C",
  },
  backBtn: {
    position: "absolute",
    left: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: {
    position: "absolute",
    left: 24,
    right: 24,
  },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 2.4,
    color: "#1B4F72",
    marginBottom: 6,
  },
  heroTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    lineHeight: 38,
    color: "#F5F0E8",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  intro: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  introText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(245,240,232,0.65)",
  },
  content: {
    paddingHorizontal: 20,
    gap: 32,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  sectionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 2,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
    gap: 14,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    gap: 6,
  },
  cardNome: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 16,
    color: "#F5F0E8",
    lineHeight: 21,
  },
  cardDescricao: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(245,240,232,0.65)",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "#1B4F72",
  },
  tipRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
    padding: 10,
    backgroundColor: "rgba(27,79,114,0.08)",
    borderRadius: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#1B4F72",
  },
  tipStar: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: "#1B4F72",
    marginTop: 1,
  },
  tipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(245,240,232,0.75)",
    flex: 1,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(245,240,232,0.45)",
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: "center",
  },
  footerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.35)",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  footerBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#1B4F72",
  },
});
