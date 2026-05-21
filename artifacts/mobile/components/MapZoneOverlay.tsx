/**
 * MapZoneOverlay
 *
 * Editorial aerial-photo map with editorial labels and invisible hotspot touch areas.
 *
 * Interaction model:
 *   • Tap a hotspot → fake-zoom (scale + translate + dim) + parent receives onHotspotPress
 *   • Tap another  → update zoom to new hotspot + update card
 *   • Tap outside  → reset zoom + onHotspotPress(null)
 *
 * Labels:
 *   • Neighborhood + landmark labels visible in overview state
 *   • All labels live inside the zoomable Animated.View so they zoom with the map
 *   • Non-active labels render BEFORE the dim overlay → get dimmed
 *   • Active neighborhood label renders AFTER the dim overlay → stays bright
 *   • Touch events are blocked on labels (pointerEvents: none)
 *
 * The floating NeighborhoodCard is rendered at SCREEN level (also exported here)
 * so it can overlap between the map and the scrollable content below.
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const MAP_ZONE_W = SCREEN_WIDTH;
export const MAP_ZONE_H = Math.round(SCREEN_HEIGHT * 0.58);

const HIT_SIZE     = 52;
const ZOOM_SCALE   = 1.38;
const NATIVE_DRIVER = Platform.OS !== "web";
const SPRING_CFG   = { tension: 45, friction: 9, useNativeDriver: NATIVE_DRIVER } as const;
const TIMING_CFG   = { duration: 280, easing: Easing.out(Easing.ease), useNativeDriver: NATIVE_DRIVER } as const;

// ── Hotspot data ────────────────────────────────────────────────────────────────

export interface Hotspot {
  id: string;
  name: string;
  description: string;
  tagline: string;
  xPct: number;
  yPct: number;
  bairros: string[];
}

export const RIO_HOTSPOTS: Hotspot[] = [
  {
    id: "barra",
    name: "Barra da Tijuca",
    description: "Praias extensas, natureza preservada e modernidade à beira-mar — o Rio além do cartão postal.",
    tagline: "Espaço, natureza e tranquilidade",
    xPct: 20, yPct: 16,
    bairros: ["Barra da Tijuca", "São Conrado"],
  },
  {
    id: "cristoredentor",
    name: "Cristo Redentor",
    description: "O símbolo maior do Rio — de lá em cima, a cidade toda se revela de uma vez ao pé da floresta.",
    tagline: "Vista que para o tempo",
    xPct: 34, yPct: 43,
    bairros: ["Corcovado", "Urca"],
  },
  {
    id: "lagoa",
    name: "Lagoa",
    description: "Espelho d'água entre as montanhas e os bairros nobres. Restaurantes flutuantes, pistas de corrida e pôr do sol irreal.",
    tagline: "Para quem prefere o Rio escondido",
    xPct: 50, yPct: 59,
    bairros: ["Lagoa", "Jardim Botânico", "Gávea"],
  },
  {
    id: "leblon",
    name: "Leblon",
    description: "O bairro mais exclusivo do Rio — restaurantes premiados, livrarias e a melhor vista para o Dois Irmãos.",
    tagline: "Ideal para uma estadia sofisticada",
    xPct: 32, yPct: 67,
    bairros: ["Leblon"],
  },
  {
    id: "ipanema",
    name: "Ipanema",
    description: "Boemia, moda e a praia que inspirou a bossa nova. Vibrante de manhã à noite.",
    tagline: "Clássico e imprescindível",
    xPct: 45, yPct: 70,
    bairros: ["Ipanema", "Arpoador"],
  },
  {
    id: "copacabana",
    name: "Copacabana",
    description: "Energia 24 horas, frente de mar icônica e uma mistura única de história e modernidade.",
    tagline: "A experiência carioca completa",
    xPct: 59, yPct: 72,
    bairros: ["Copacabana"],
  },
  {
    id: "centro",
    name: "Centro",
    description: "O coração histórico do Rio — igrejas centenárias, o porto revitalizado e a memória viva da cidade.",
    tagline: "Rio além da praia",
    xPct: 76, yPct: 80,
    bairros: ["Centro", "Lapa", "Santa Teresa", "Botafogo", "Flamengo"],
  },
];

// ── Editorial label data ────────────────────────────────────────────────────────
//
// Positions are % of the map container (portrait aerial photo, SW→NE orientation).
// Manually placed to align with the image geography.

interface MapLabel {
  id: string;
  name: string;
  type: "neighborhood" | "landmark";
  xPct: number;
  yPct: number;
  hotspotId: string | null;   // null → no associated hotspot (landmark without its own card)
  labelW?: number;             // override container width if needed
  align?: "left" | "center" | "right";
}

const RIO_LABELS: MapLabel[] = [
  // ── Neighborhood labels ──
  // Barra: the long beach upper-left; nudged right/down to clear the Voltar pill
  { id: "l-barra",      name: "Barra da Tijuca",          type: "neighborhood", xPct: 20,  yPct: 23,  hotspotId: "barra"                    },
  { id: "l-saoconrado", name: "São Conrado",               type: "neighborhood", xPct: 30,  yPct: 36,  hotspotId: "barra"                    },
  { id: "l-leblon",     name: "Leblon",                    type: "neighborhood", xPct: 25,  yPct: 68,  hotspotId: "leblon"                   },
  { id: "l-ipanema",    name: "Ipanema",                   type: "neighborhood", xPct: 41,  yPct: 71,  hotspotId: "ipanema"                  },
  { id: "l-copa",       name: "Copacabana",                type: "neighborhood", xPct: 57,  yPct: 73,  hotspotId: "copacabana"               },
  { id: "l-botafogo",   name: "Botafogo",                  type: "neighborhood", xPct: 67,  yPct: 76,  hotspotId: "centro"                   },
  { id: "l-centro",     name: "Centro",                    type: "neighborhood", xPct: 80,  yPct: 80,  hotspotId: "centro"                   },
  // ── Landmark labels ──
  { id: "l-cristo",     name: "Cristo Redentor",           type: "landmark",     xPct: 37,  yPct: 38,  hotspotId: "cristoredentor", labelW: 88 },
  { id: "l-lagoa",      name: "Lagoa Rodrigo\nde Freitas", type: "landmark",     xPct: 50,  yPct: 55,  hotspotId: "lagoa",          labelW: 102 },
  { id: "l-maracana",   name: "Maracanã",                  type: "landmark",     xPct: 79,  yPct: 26,  hotspotId: null                       },
];

// ── Zoom helper ─────────────────────────────────────────────────────────────────

function calcTranslate(hotspot: Hotspot) {
  const cx = MAP_ZONE_W / 2;
  const cy = MAP_ZONE_H / 2;
  const hx = (hotspot.xPct / 100) * MAP_ZONE_W;
  const hy = (hotspot.yPct / 100) * MAP_ZONE_H;
  const factor = 1 - 1 / ZOOM_SCALE;
  return {
    tx: (cx - hx) * factor,
    ty: (cy - hy) * factor,
  };
}

// ── Label item (renders inside the zoomable Animated.View) ────────────────────

function MapLabelItem({ label, isActive }: { label: MapLabel; isActive: boolean }) {
  const isNeighborhood = label.type === "neighborhood";
  const containerW     = label.labelW ?? (isNeighborhood ? 88 : 100);
  const leftPx         = (label.xPct / 100) * MAP_ZONE_W;
  const topPx          = (label.yPct / 100) * MAP_ZONE_H;

  return (
    <View
      style={[
        lbl.container,
        {
          left: leftPx - containerW / 2,
          top:  topPx,
          width: containerW,
          pointerEvents: "none",
        },
      ]}
    >
      {/* Tiny dot for neighborhoods */}
      {isNeighborhood && (
        <View
          style={[
            lbl.dot,
            isActive && lbl.dotActive,
          ]}
        />
      )}
      {/* Label text */}
      <Text
        style={[
          isNeighborhood ? lbl.neighborhood : lbl.landmark,
          isActive && lbl.textActive,
        ]}
      >
        {label.name}
      </Text>
    </View>
  );
}

// ── MapZoneOverlay (main component) ────────────────────────────────────────────

interface MapZoneOverlayProps {
  onBack?: () => void;
  topInset?: number;
  locaisLabel?: string;
  selectedHotspot?: string | null;
  onHotspotPress?: (id: string | null) => void;
  filteredCount?: number;
}

export function MapZoneOverlay({
  onBack,
  topInset = 14,
  locaisLabel,
  selectedHotspot,
  onHotspotPress,
  filteredCount,
}: MapZoneOverlayProps) {
  const controlTop = topInset + 10;

  const mapScale      = useRef(new Animated.Value(1)).current;
  const mapTranslateX = useRef(new Animated.Value(0)).current;
  const mapTranslateY = useRef(new Animated.Value(0)).current;
  const dimOpacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selectedHotspot) {
      const hs = RIO_HOTSPOTS.find((h) => h.id === selectedHotspot);
      if (!hs) return;
      const { tx, ty } = calcTranslate(hs);
      Animated.parallel([
        Animated.spring(mapScale,      { toValue: ZOOM_SCALE, ...SPRING_CFG }),
        Animated.spring(mapTranslateX, { toValue: tx,         ...SPRING_CFG }),
        Animated.spring(mapTranslateY, { toValue: ty,         ...SPRING_CFG }),
        Animated.timing(dimOpacity,    { toValue: 0.32,       ...TIMING_CFG }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(mapScale,      { toValue: 1, ...SPRING_CFG }),
        Animated.spring(mapTranslateX, { toValue: 0, ...SPRING_CFG }),
        Animated.spring(mapTranslateY, { toValue: 0, ...SPRING_CFG }),
        Animated.timing(dimOpacity,    { toValue: 0, ...TIMING_CFG }),
      ]).start();
    }
  }, [selectedHotspot]);

  const activeHotspot = RIO_HOTSPOTS.find((h) => h.id === selectedHotspot) ?? null;

  // Which labels are associated with the active hotspot
  const activeHotspotId = activeHotspot?.id ?? null;
  const activeLabels    = RIO_LABELS.filter((l) => l.hotspotId === activeHotspotId);
  const nonActiveLabels = RIO_LABELS.filter((l) => l.hotspotId !== activeHotspotId);

  const badgeLabel =
    activeHotspot && filteredCount !== undefined
      ? `${filteredCount} local${filteredCount !== 1 ? "is" : ""}`
      : locaisLabel;

  return (
    <View style={s.root}>

      {/* ── Zoomable layer ── */}
      <Animated.View
        style={[
          s.mapInner,
          {
            transform: [
              { translateX: mapTranslateX },
              { translateY: mapTranslateY },
              { scale: mapScale },
            ],
          },
        ]}
      >
        {/* Editorial aerial photo */}
        <Animated.Image
          source={require("../assets/images/map-rio-portrait.png")}
          // @ts-ignore
          resizeMode="cover"
          style={s.mapImage}
        />

        {/* ── Layer 1: Non-active labels (sit below dim → get softened) ── */}
        {nonActiveLabels.map((label) => (
          <MapLabelItem
            key={label.id}
            label={label}
            isActive={false}
          />
        ))}

        {/* ── Layer 2: Dim overlay ── */}
        <Animated.View
          style={[s.dimOverlay, { opacity: dimOpacity, pointerEvents: "none" }]}
        />

        {/* ── Layer 3: Active labels (above dim → always legible) ── */}
        {activeHotspotId !== null && activeLabels.map((label) => (
          <MapLabelItem
            key={label.id}
            label={label}
            isActive={true}
          />
        ))}

        {/* Background Pressable — tap outside hotspot to dismiss */}
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => onHotspotPress?.(null)}
          accessibilityLabel="Fechar bairro"
        />

        {/* Invisible hotspot touch areas */}
        {RIO_HOTSPOTS.map((hotspot) => {
          const left = (hotspot.xPct / 100) * MAP_ZONE_W - HIT_SIZE / 2;
          const top  = (hotspot.yPct / 100) * MAP_ZONE_H - HIT_SIZE / 2;
          return (
            <Pressable
              key={hotspot.id}
              style={[s.hotspotHit, { left, top }]}
              onPress={() =>
                onHotspotPress?.(
                  hotspot.id === selectedHotspot ? null : hotspot.id
                )
              }
              accessibilityLabel={hotspot.name}
              accessibilityRole="button"
            />
          );
        })}
      </Animated.View>

      {/* ── Fixed controls (outside zoomable layer) ── */}

      {onBack && (
        <Pressable
          onPress={onBack}
          style={[s.controlPill, { top: controlTop, left: 16 }]}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={15} color={C.white} />
          <Text style={s.controlPillText}>Voltar</Text>
        </Pressable>
      )}

      <View style={[s.controlPill, { top: controlTop, right: 16 }]}>
        <View style={[s.badgeDot, activeHotspot && s.badgeDotActive]} />
        <Text style={s.controlPillText}>{badgeLabel}</Text>
      </View>

      {!activeHotspot && (
        <View style={s.hintStrip}>
          <Feather name="map-pin" size={10} color="rgba(255,255,255,0.28)" />
          <Text style={s.hintText}>Toque num bairro para explorar</Text>
        </View>
      )}
    </View>
  );
}

// ── NeighborhoodCard ────────────────────────────────────────────────────────────

export interface NeighborhoodCardProps {
  hotspot: Hotspot;
  filteredCount?: number;
  onVerHoteis?: () => void;
  onPorDentro?: () => void;
  onDismiss?: () => void;
}

export function NeighborhoodCard({
  hotspot,
  filteredCount,
  onVerHoteis,
  onPorDentro,
  onDismiss,
}: NeighborhoodCardProps) {
  return (
    <BlurView
      intensity={Platform.OS === "web" ? 58 : 70}
      tint="light"
      style={nc.card}
    >
      <View style={nc.header}>
        <Text style={nc.name}>{hotspot.name}</Text>
        <Pressable
          onPress={onDismiss}
          style={nc.dismiss}
          hitSlop={10}
          accessibilityLabel="Fechar"
        >
          <Feather name="x" size={15} color="rgba(24,18,12,0.45)" />
        </Pressable>
      </View>

      <Text style={nc.desc} numberOfLines={2}>
        {hotspot.description}
      </Text>

      <Text style={nc.tagline}>→ {hotspot.tagline}</Text>

      <View style={nc.buttons}>
        <Pressable
          style={({ pressed }) => [nc.btnSolid, pressed && nc.btnSolidPressed]}
          onPress={onVerHoteis}
        >
          <Text style={nc.btnSolidText}>Ver hotéis</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [nc.btnGhost, pressed && nc.btnGhostPressed]}
          onPress={onPorDentro}
        >
          <Text style={nc.btnGhostText}>Por dentro do bairro</Text>
        </Pressable>
      </View>

      {filteredCount !== undefined && (
        <Text style={nc.count}>
          {filteredCount === 0
            ? "Sem locais nesta categoria"
            : `${filteredCount} ${filteredCount === 1 ? "local" : "locais"} selecionado${filteredCount === 1 ? "" : "s"}`}
        </Text>
      )}
    </BlurView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

// textShadow shorthand (RN web) — fallback to long-form on native
const TEXT_SHADOW: Record<string, unknown> =
  Platform.OS === "web"
    ? { textShadow: "0px 1px 7px rgba(0,0,0,0.82), 0px 0px 3px rgba(0,0,0,0.60)" }
    : {
        textShadowColor: "rgba(0,0,0,0.72)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
      };

const s = StyleSheet.create({
  root: {
    width: MAP_ZONE_W,
    height: MAP_ZONE_H,
    backgroundColor: "#060810",
    overflow: "hidden",
  },
  mapInner: {
    ...StyleSheet.absoluteFillObject,
  },
  mapImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  hotspotHit: {
    position: "absolute",
    width: HIT_SIZE,
    height: HIT_SIZE,
    borderRadius: HIT_SIZE / 2,
    backgroundColor: "transparent",
  },
  hintStrip: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    pointerEvents: "none",
  },
  hintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.28)",
    letterSpacing: 0.3,
  },
  controlPill: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(6,3,1,0.58)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  controlPillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.90)",
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.terracotta,
  },
  badgeDotActive: {
    backgroundColor: "#1B4F72",
  },
});

// ── Label styles ────────────────────────────────────────────────────────────────

const lbl = StyleSheet.create({
  container: {
    position: "absolute",
    alignItems: "center",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.55)",
    marginBottom: 2,
  },
  dotActive: {
    backgroundColor: "rgba(255,255,255,0.95)",
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  neighborhood: {
    fontFamily: "Inter_500Medium",
    fontSize: 9.5,
    color: "rgba(255,255,255,0.80)",
    letterSpacing: 0.55,
    textAlign: "center",
    ...TEXT_SHADOW,
  },
  landmark: {
    fontFamily: "Inter_400Regular",
    fontSize: 8,
    color: "rgba(255,255,255,0.58)",
    letterSpacing: 0.3,
    textAlign: "center",
    ...TEXT_SHADOW,
  },
  textActive: {
    color: "rgba(255,255,255,0.96)",
  },
});

// ── NeighborhoodCard styles ─────────────────────────────────────────────────────

const nc = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.60)",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  name: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: "#18120C",
    lineHeight: 30,
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 8,
  },
  dismiss: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(24,18,12,0.08)",
    borderRadius: 14,
    marginTop: 2,
  },
  desc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13.5,
    color: "rgba(24,18,12,0.68)",
    lineHeight: 20,
    marginBottom: 8,
  },
  tagline: {
    fontFamily: "Inter_500Medium",
    fontSize: 12.5,
    color: "rgba(24,18,12,0.45)",
    marginBottom: 16,
    letterSpacing: 0.1,
  },
  buttons: {
    flexDirection: "row",
    gap: 10,
  },
  btnSolid: {
    flex: 1,
    backgroundColor: "rgba(24,18,12,0.88)",
    borderRadius: 50,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSolidPressed: { backgroundColor: "rgba(24,18,12,0.70)" },
  btnSolidText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13.5,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },
  btnGhost: {
    flex: 1,
    backgroundColor: "rgba(24,18,12,0.06)",
    borderRadius: 50,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(24,18,12,0.16)",
  },
  btnGhostPressed: { backgroundColor: "rgba(24,18,12,0.12)" },
  btnGhostText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13.5,
    color: "rgba(24,18,12,0.78)",
    letterSpacing: 0.1,
  },
  count: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(24,18,12,0.35)",
    textAlign: "center",
    marginTop: 10,
    letterSpacing: 0.2,
  },
});
