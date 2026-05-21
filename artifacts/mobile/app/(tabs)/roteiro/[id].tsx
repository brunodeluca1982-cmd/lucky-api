/**
 * roteiro/[id].tsx — Prebuilt itinerary detail screen.
 *
 * Renders a curated base roteiro (from mockData.roteiros) using the exact
 * same DiaCard / PeriodoBlock / RoteiroSection model as the generated
 * itinerary in viagem.tsx. Same visual hierarchy, same day cards, same
 * period labels, same design standard.
 *
 * Navigation target: from Home RoteiroCard onPress.
 */

import React, { useRef, useState } from "react";
import {
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import Colors from "@/constants/colors";
import {
  roteiros,
  type RoteiroDia,
  type RoteiroSlot,
  type RoteiroCategory,
} from "@/data/mockData";
import {
  PERIODO_LABEL,
  PERIODO_ICON,
  type DiaRoteiro,
  type DiaPeriodo,
  type PeriodoDia,
} from "@/utils/buildRoteiro";
import type { SavedItem, SavedCategory } from "@/context/GuiaContext";

const C    = Colors.light;
const GOLD = "#1B4F72";

// ── Category mapping: RoteiroCategory → SavedCategory ─────────────────────────
const CAT_MAP: Record<RoteiroCategory, SavedCategory> = {
  passeio:      "oQueFazer",
  gastronomia:  "restaurante",
  cultura:      "oQueFazer",
  "contemplação": "oQueFazer",
  natureza:     "oQueFazer",
  compras:      "oQueFazer",
  noite:        "oQueFazer",
};

// Slot name → periodo key mapping (mockData slot keys → buildRoteiro PeriodoDia)
const SLOT_PERIODO: Record<string, PeriodoDia> = {
  manha:  "manha",
  almoco: "almoco",
  tarde:  "tarde",
  jantar: "jantar",
  noite:  "late_night",
};

// ── Converters ─────────────────────────────────────────────────────────────────

function slotToItem(slot: RoteiroSlot, key: string): SavedItem {
  return {
    id:           key,
    titulo:       slot.name,
    localizacao:  slot.neighborhood,
    image:        require("@/assets/images/hero-rio.png"),
    categoria:    CAT_MAP[slot.category],
  };
}

function toDiaRoteiros(itinerary: RoteiroDia[], roteiroId: string): DiaRoteiro[] {
  return itinerary.map((dia) => {
    const periodos: DiaPeriodo[] = [];
    const SLOTS: [keyof RoteiroDia, string][] = [
      ["manha",  "manha"],
      ["almoco", "almoco"],
      ["tarde",  "tarde"],
      ["jantar", "jantar"],
      ["noite",  "noite"],
    ];
    for (const [field, periodoKey] of SLOTS) {
      const slot = dia[field] as RoteiroSlot | undefined;
      if (!slot) continue;
      periodos.push({
        periodo: SLOT_PERIODO[periodoKey],
        items:   [slotToItem(slot, `${roteiroId}-d${dia.dia}-${periodoKey}`)],
      });
    }
    return { numero: dia.dia, bairro: dia.bairro, periodos };
  });
}

// ── Shared itinerary components — identical model to viagem.tsx ────────────────

function PeriodoBlock({ periodo, items }: DiaPeriodo) {
  const label = PERIODO_LABEL[periodo];
  const icon  = PERIODO_ICON[periodo] as keyof typeof Feather.glyphMap;
  return (
    <View style={rot.periodoWrap}>
      <View style={rot.periodoHeader}>
        <Feather name={icon} size={10} color={GOLD} />
        <Text style={rot.periodoLabel}>{label}</Text>
      </View>
      {items.map((item) => (
        <View key={item.id} style={rot.itemRow}>
          <View style={rot.itemDot} />
          <Text style={rot.itemNome} numberOfLines={1}>{item.titulo}</Text>
        </View>
      ))}
    </View>
  );
}

function DiaCard({ dia }: { dia: DiaRoteiro }) {
  return (
    <View style={rot.diaCard}>
      <View style={rot.diaHeader}>
        <Text style={rot.diaNum}>DIA {dia.numero}</Text>
        <Text style={rot.diaBairro}>{dia.bairro}</Text>
      </View>
      <View style={rot.separator} />
      {dia.periodos.map((p) => (
        <PeriodoBlock key={p.periodo} {...p} />
      ))}
    </View>
  );
}

// ── Day navigation chips ──────────────────────────────────────────────────────

function DayNav({
  dias,
  activeDay,
  onSelect,
}: {
  dias: DiaRoteiro[];
  activeDay: number | null;
  onSelect: (n: number | null) => void;
}) {
  if (dias.length <= 1) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={dn.row}
    >
      {dias.map((d) => {
        const active = activeDay === d.numero;
        return (
          <Pressable
            key={d.numero}
            style={[dn.chip, active && dn.chipActive]}
            onPress={() => onSelect(d.numero)}
          >
            <Text style={[dn.chipText, active && dn.chipTextActive]}>
              Dia {d.numero}
            </Text>
            {active && (
              <Text style={dn.bairroText} numberOfLines={1}>{d.bairro}</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const dn = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 4,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  chipActive: {
    backgroundColor: `${GOLD}18`,
    borderColor: `${GOLD}50`,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
  },
  chipTextActive: {
    color: GOLD,
  },
  bairroText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: `${GOLD}80`,
    maxWidth: 90,
  },
});

// ── Main screen ────────────────────────────────────────────────────────────────

export default function RoteiroDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets    = useSafeAreaInsets();
  const topPad    = Platform.OS === "web" ? 67 : insets.top + 12;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [activeDay, setActiveDay] = useState<number | null>(1);

  // Overlay starts invisible — fades in once expo-image displays the background.
  const overlayAnim = useRef(new Animated.Value(0)).current;

  function handleBgDisplay() {
    Animated.timing(overlayAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }

  const roteiro = roteiros.find((r) => r.id === id);
  if (!roteiro) return null;

  const dias = toDiaRoteiros(roteiro.itinerary, roteiro.id);

  return (
    <View style={s.root}>

      {/* ── Warm amber base — renders in the same frame as mount, zero wait ── */}
      <LinearGradient
        colors={["#2D1A08", "#1A0E04"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── expo-image: backgroundColor shows immediately; crossfades to hero ── */}
      <ExpoImage
        source={roteiro.image}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#1A0E04" }]}
        contentFit="cover"
        blurRadius={Platform.OS === "ios" ? 28 : 16}
        transition={{ duration: 600, effect: "cross-dissolve" }}
        onDisplay={handleBgDisplay}
      />

      {/* ── Dark overlay fades in only after the image is displayed ── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: overlayAnim }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            "rgba(0,0,0,0.10)",
            "rgba(0,0,0,0.38)",
            "rgba(0,0,0,0.66)",
            "rgba(0,0,0,0.82)",
          ]}
          locations={[0, 0.25, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.content,
          { paddingTop: topPad + 8, paddingBottom: bottomPad + 90 },
        ]}
      >

        {/* ── Back button ── */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.65 }]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={18} color="rgba(255,255,255,0.80)" />
        </Pressable>

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.eyebrow}>ROTEIRO</Text>
          <Text style={s.title}>{roteiro.titulo}</Text>
          <View style={s.metaRow}>
            <View style={s.metaPill}>
              <Feather name="clock" size={11} color={GOLD} />
              <Text style={s.metaText}>{roteiro.dias}</Text>
            </View>
            {roteiro.tags.map((tag) => (
              <View key={tag} style={s.metaPill}>
                <Text style={s.metaText}>{tag}</Text>
              </View>
            ))}
            <View style={s.metaPill}>
              <Text style={s.metaText}>{roteiro.numLugares} lugares</Text>
            </View>
          </View>
        </View>

        {/* ── Thin rule ── */}
        <View style={s.rule} />

        {/* ── Day navigation chips ── */}
        <View style={s.dayNavWrap}>
          <DayNav
            dias={dias}
            activeDay={activeDay}
            onSelect={setActiveDay}
          />
        </View>

        {/* ── Itinerary — same day cards as generated roteiro ── */}
        <View style={rot.wrap}>
          <View style={rot.titleRow}>
            <Text style={rot.sectionLabel}>Roteiro completo</Text>
            <View style={rot.pill}>
              <Text style={rot.pillText}>
                {dias.length} {dias.length === 1 ? "dia" : "dias"}
              </Text>
            </View>
          </View>
          {dias
            .filter((d) => activeDay === null || d.numero === activeDay)
            .map((dia) => (
              <DiaCard key={dia.numero} dia={dia} />
            ))}
          {dias.length > 1 && (
            <Pressable
              style={({ pressed }) => [s.verTodosDias, pressed && { opacity: 0.65 }]}
              onPress={() => setActiveDay(activeDay === null ? 1 : null)}
            >
              <Text style={s.verTodosDiasText}>
                {activeDay === null ? "Ver um dia por vez" : "Ver todos os dias"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── WhatsApp refine button ── */}
        <Pressable
          style={({ pressed }) => [s.whatsapp, pressed && { opacity: 0.82 }]}
          onPress={() => {
            const msg = encodeURIComponent(
              `Olá! Quero refinar meu roteiro "${roteiro.titulo}" no The Lucky Trip.`
            );
            Linking.openURL(`https://wa.me/5521999999999?text=${msg}`);
          }}
        >
          <Feather name="message-circle" size={18} color="#FFFFFF" />
          <Text style={s.whatsappText}>Refinar no WhatsApp</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}

// ── Screen styles ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1A0E04",
  },
  content: {
    paddingHorizontal: 24,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.32)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  header: {
    gap: 10,
    marginBottom: 18,
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
    color: C.cream,
    lineHeight: 42,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: `${GOLD}12`,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: `${GOLD}28`,
  },
  metaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: GOLD,
  },
  rule: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 16,
  },
  dayNavWrap: {
    marginBottom: 20,
  },
  verTodosDias: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  verTodosDiasText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.38)",
  },
  whatsapp: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 24,
    marginBottom: 8,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: "#25D366",
  },
  whatsappText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
});

// ── Itinerary styles — pixel-identical to viagem.tsx rot stylesheet ────────────

const rot = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 2,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  pill: {
    backgroundColor: `${GOLD}10`,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `${GOLD}24`,
  },
  pillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: GOLD,
  },
  diaCard: {
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: `${GOLD}18`,
    paddingHorizontal: 18,
    paddingVertical: 16,
    boxShadow: `0px 2px 12px rgba(0,0,0,0.20)`,
  },
  diaHeader: {
    marginBottom: 10,
    gap: 1,
  },
  diaNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: GOLD,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  diaBairro: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 20,
    color: C.cream,
    lineHeight: 26,
  },
  separator: {
    height: 1,
    backgroundColor: `${GOLD}14`,
    marginBottom: 12,
  },
  periodoWrap: {
    marginBottom: 10,
  },
  periodoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 5,
  },
  periodoLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: GOLD,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  itemDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    flexShrink: 0,
  },
  itemNome: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    flex: 1,
  },
});
