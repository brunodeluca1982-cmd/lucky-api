/**
 * OndeFicarMap
 *
 * Premium editorial map for the "Onde Ficar" screen.
 * Uses the clean aerial photograph of Rio de Janeiro as the base layer
 * with invisible hotspot touch areas and animated editorial labels on top.
 *
 * Interaction:
 *   • Tap a hotspot → spring-zoom to center that neighborhood + show dim overlay
 *   • Tap again / background → reset to overview
 *
 * Image: rio-aerial-clean.png (2340 × 1440, landscape)
 * Rendered left-aligned so the coastal Zona Sul neighborhoods are fully visible.
 *
 * Animation:
 *   - Spring scale + translate (Animated, useNativeDriver on native)
 *   - Timing dim overlay opacity
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
import Colors from "@/constants/colors";

const C = Colors.light;

// ── Image dimensions ──────────────────────────────────────────────────────────

const IMG_W = 2340;
const IMG_H = 1440;

const { width: SCREEN_W } = Dimensions.get("window");

// Container: left-aligned crop of the landscape image.
// Height = fills width proportionally (no vertical cropping).
// Width of rendered image = SCREEN_W × (IMG_W / (SCREEN_W × scale)):
//   scale to fill height: MAP_H / IMG_H → img_w = IMG_W × (MAP_H / IMG_H)
// We set MAP_H so img_w slightly exceeds SCREEN_W for a full-bleed look.
// At MAP_H = 280: img_w = 1440×(280/1440) → actually img_w = IMG_W×(280/IMG_H) = 454px > 390px ✓

export const MAP_W  = SCREEN_W;
export const MAP_H  = Math.round(SCREEN_W * (IMG_H / IMG_W)) + 40; // natural height + 40 for premium feel

// img rendered dimensions when object-fit is "left-top fill-height"
const IMG_RENDERED_H = MAP_H;
const IMG_RENDERED_W = Math.round(IMG_H > 0 ? IMG_W * (MAP_H / IMG_H) : SCREEN_W);

// Scale factors from original image % to container pixel
const SCALE_X = IMG_RENDERED_W / 100;  // px per 1% of original image
const SCALE_Y = MAP_H / 100;           // px per 1% of original image (same scale)

const ZOOM_SCALE   = 1.40;
const HIT_SIZE     = 52;
const NATIVE_DRV   = Platform.OS !== "web";
const SPRING_CFG   = { tension: 42, friction: 8, useNativeDriver: NATIVE_DRV } as const;
const TIMING_CFG   = {
  duration: 270,
  easing: Easing.out(Easing.ease),
  useNativeDriver: NATIVE_DRV,
} as const;

// ── Hotspot data ──────────────────────────────────────────────────────────────
// xPct / yPct: percentage of the ORIGINAL IMAGE (2340 × 1440).
// The rendering accounts for left-alignment cropping automatically.

export interface Hotspot {
  id: string;
  name: string;
  xPct: number;
  yPct: number;
}

export const ONDE_FICAR_HOTSPOTS: Hotspot[] = [
  // ── Coastal neighborhoods (west → east, south) ──
  { id: "recreio",   name: "Recreio dos Bandeirantes", xPct:  9.5, yPct:  9  },
  { id: "barra",     name: "Barra da Tijuca",           xPct: 18,   yPct: 20  },
  { id: "saoconrado",name: "São Conrado",                xPct: 22.5, yPct: 33  },
  { id: "leblon",    name: "Leblon",                    xPct: 20.5, yPct: 41  },
  { id: "ipanema",   name: "Ipanema",                   xPct: 26,   yPct: 47  },
  { id: "arpoador",  name: "Arpoador",                  xPct: 21.5, yPct: 52  },
  { id: "copacabana",name: "Copacabana",                xPct: 16.5, yPct: 56  },
  { id: "leme",      name: "Leme",                      xPct:  9.5, yPct: 60  },
  // ── Bay/inner neighborhoods ──
  { id: "botafogo",  name: "Botafogo",                  xPct: 22.5, yPct: 64  },
  { id: "santateresa",name: "Santa Teresa",             xPct: 39,   yPct: 59  },
  { id: "centro",    name: "Centro",                    xPct: 51,   yPct: 68  },
];

// ── Editorial labels ──────────────────────────────────────────────────────────

interface MapLabel {
  id: string;
  name: string;
  type: "neighborhood" | "landmark";
  xPct: number;
  yPct: number;
  hotspotId: string | null;
  w?: number;
}

const RIO_LABELS: MapLabel[] = [
  // Neighborhood labels (aligned to their hotspot)
  { id: "l-recreio",    name: "Recreio",      type: "neighborhood", xPct:  9.5, yPct:  9,  hotspotId: "recreio"    },
  { id: "l-barra",      name: "Barra da Tijuca", type: "neighborhood", xPct: 18,   yPct: 20, hotspotId: "barra"     },
  { id: "l-saoconrado", name: "São Conrado",   type: "neighborhood", xPct: 22.5, yPct: 33, hotspotId: "saoconrado" },
  { id: "l-leblon",     name: "Leblon",        type: "neighborhood", xPct: 20.5, yPct: 41, hotspotId: "leblon"     },
  { id: "l-ipanema",    name: "Ipanema",       type: "neighborhood", xPct: 26,   yPct: 47, hotspotId: "ipanema"    },
  { id: "l-arpoador",   name: "Arpoador",      type: "neighborhood", xPct: 21.5, yPct: 52, hotspotId: "arpoador"   },
  { id: "l-copa",       name: "Copacabana",    type: "neighborhood", xPct: 16.5, yPct: 56, hotspotId: "copacabana" },
  { id: "l-leme",       name: "Leme",          type: "neighborhood", xPct:  9.5, yPct: 60, hotspotId: "leme"       },
  { id: "l-botafogo",   name: "Botafogo",      type: "neighborhood", xPct: 22.5, yPct: 64, hotspotId: "botafogo"   },
  { id: "l-santateresa",name: "Santa Teresa",  type: "neighborhood", xPct: 39,   yPct: 59, hotspotId: "santateresa"},
  { id: "l-centro",     name: "Centro",        type: "neighborhood", xPct: 51,   yPct: 68, hotspotId: "centro"     },
  // Landmark labels (non-interactive)
  { id: "l-cristo",     name: "Cristo Redentor", type: "landmark", xPct: 30, yPct: 43, hotspotId: null, w: 80 },
  { id: "l-lagoa",      name: "Lagoa",          type: "landmark", xPct: 34, yPct: 53, hotspotId: null, w: 52 },
  { id: "l-maracana",   name: "Maracanã",       type: "landmark", xPct: 58, yPct: 43, hotspotId: null, w: 60 },
];

// ── Zoom helper ───────────────────────────────────────────────────────────────

function calcTranslate(hs: Hotspot) {
  const cx = MAP_W / 2;
  const cy = MAP_H / 2;
  // hotspot pixel position in the RENDERED (not original) image coordinates
  const hx = (hs.xPct / 100) * IMG_RENDERED_W;
  const hy = (hs.yPct / 100) * IMG_RENDERED_H;
  const factor = 1 - 1 / ZOOM_SCALE;
  return {
    tx: (cx - hx) * factor,
    ty: (cy - hy) * factor,
  };
}

// ── Label item ─────────────────────────────────────────────────────────────────

const TEXT_SHADOW: Record<string, unknown> =
  Platform.OS === "web"
    ? { textShadow: "0px 1px 8px rgba(0,0,0,0.92), 0px 0px 4px rgba(0,0,0,0.72)" }
    : {
        textShadowColor: "rgba(0,0,0,0.80)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
      };

function LabelItem({ label, isActive }: { label: MapLabel; isActive: boolean }) {
  const isNeighbor = label.type === "neighborhood";
  const containerW = label.w ?? (isNeighbor ? 82 : 68);
  // Position in rendered image space, then clip to container width
  const leftPx = (label.xPct / 100) * IMG_RENDERED_W - containerW / 2;
  const topPx  = (label.yPct / 100) * IMG_RENDERED_H;

  return (
    <View
      style={[
        lbl.wrap,
        { left: leftPx, top: topPx, width: containerW, pointerEvents: "none" },
      ]}
    >
      {isNeighbor && (
        <View style={[lbl.dot, isActive && lbl.dotActive]} />
      )}
      <Text
        style={[
          isNeighbor ? lbl.neighText : lbl.landmarkText,
          isActive && lbl.activeText,
        ]}
        numberOfLines={2}
      >
        {label.name}
      </Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface OndeFicarMapProps {
  selectedNeighborhood: string | null;
  onNeighborhoodPress: (name: string | null) => void;
  onBack?: () => void;
  topInset?: number;
  badgeText?: string;
}

export default function OndeFicarMap({
  selectedNeighborhood,
  onNeighborhoodPress,
  onBack,
  topInset = 14,
  badgeText,
}: OndeFicarMapProps) {
  const controlTop = topInset + 10;

  const mapScale      = useRef(new Animated.Value(1)).current;
  const mapTranslateX = useRef(new Animated.Value(0)).current;
  const mapTranslateY = useRef(new Animated.Value(0)).current;
  const dimOpacity    = useRef(new Animated.Value(0)).current;

  // Find the active hotspot from the neighborhood name
  const activeHotspot = ONDE_FICAR_HOTSPOTS.find(
    (h) => h.name === selectedNeighborhood,
  ) ?? null;

  useEffect(() => {
    if (activeHotspot) {
      const { tx, ty } = calcTranslate(activeHotspot);
      Animated.parallel([
        Animated.spring(mapScale,      { toValue: ZOOM_SCALE, ...SPRING_CFG }),
        Animated.spring(mapTranslateX, { toValue: tx,         ...SPRING_CFG }),
        Animated.spring(mapTranslateY, { toValue: ty,         ...SPRING_CFG }),
        Animated.timing(dimOpacity,    { toValue: 0.28,       ...TIMING_CFG }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(mapScale,      { toValue: 1, ...SPRING_CFG }),
        Animated.spring(mapTranslateX, { toValue: 0, ...SPRING_CFG }),
        Animated.spring(mapTranslateY, { toValue: 0, ...SPRING_CFG }),
        Animated.timing(dimOpacity,    { toValue: 0, ...TIMING_CFG }),
      ]).start();
    }
  }, [selectedNeighborhood]);

  const activeHotspotId   = activeHotspot?.id ?? null;
  const activeLabels      = RIO_LABELS.filter((l) => l.hotspotId === activeHotspotId);
  const nonActiveLabels   = RIO_LABELS.filter((l) => l.hotspotId !== activeHotspotId);

  return (
    <View style={s.root}>
      {/* ── Zoomable layer ── */}
      <Animated.View
        style={[
          s.zoomLayer,
          {
            transform: [
              { translateX: mapTranslateX },
              { translateY: mapTranslateY },
              { scale: mapScale },
            ],
          },
        ]}
      >
        {/* Aerial photo — left-aligned so coastal neighborhoods show fully */}
        <Animated.Image
          source={require("../assets/images/rio-aerial-clean.png")}
          // @ts-ignore resizeMode web compat
          style={s.mapImage}
          resizeMode="cover"
        />

        {/* Very subtle dark wash to lift labels */}
        <View style={[s.wash, { pointerEvents: "none" }]} />

        {/* ── Non-active labels (below dim) ── */}
        {nonActiveLabels.map((lbl) => (
          <LabelItem key={lbl.id} label={lbl} isActive={false} />
        ))}

        {/* ── Dim overlay ── */}
        <Animated.View
          style={[s.dimOverlay, { opacity: dimOpacity, pointerEvents: "none" }]}
        />

        {/* ── Active labels (above dim) ── */}
        {activeHotspotId !== null &&
          activeLabels.map((l) => (
            <LabelItem key={l.id} label={l} isActive={true} />
          ))}

        {/* Background tap target (dismiss) */}
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => onNeighborhoodPress(null)}
          accessibilityLabel="Fechar bairro"
        />

        {/* Invisible hotspot hit areas */}
        {ONDE_FICAR_HOTSPOTS.map((hs) => {
          const left = (hs.xPct / 100) * IMG_RENDERED_W - HIT_SIZE / 2;
          const top  = (hs.yPct / 100) * IMG_RENDERED_H - HIT_SIZE / 2;
          return (
            <Pressable
              key={hs.id}
              style={[s.hotspot, { left, top }]}
              onPress={() =>
                onNeighborhoodPress(
                  hs.name === selectedNeighborhood ? null : hs.name,
                )
              }
              accessibilityLabel={hs.name}
              accessibilityRole="button"
            />
          );
        })}
      </Animated.View>

      {/* ── Fixed controls (outside zoomable layer) ── */}

      {onBack && (
        <Pressable
          style={[s.pill, { top: controlTop, left: 16 }]}
          onPress={onBack}
          hitSlop={8}
        >
          <Text style={s.pillText}>← Voltar</Text>
        </Pressable>
      )}

      {badgeText && (
        <View style={[s.pill, { top: controlTop, right: 16 }]}>
          <View style={[s.badgeDot, activeHotspot && s.badgeDotActive]} />
          <Text style={s.pillText}>{badgeText}</Text>
        </View>
      )}

      {!activeHotspot && (
        <View style={[s.hint, { pointerEvents: "none" }]}>
          <Text style={s.hintText}>Toque num bairro para explorar</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    width: MAP_W,
    height: MAP_H,
    backgroundColor: "#060810",
    overflow: "hidden",
  },
  zoomLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  mapImage: {
    position: "absolute",
    left: 0,
    top: 0,
    width: IMG_RENDERED_W,
    height: IMG_RENDERED_H,
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,2,0,0.14)",
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#050200",
  },
  hotspot: {
    position: "absolute",
    width: HIT_SIZE,
    height: HIT_SIZE,
    borderRadius: HIT_SIZE / 2,
    backgroundColor: "transparent",
  },
  pill: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(5,2,0,0.62)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    boxShadow: "0px 2px 10px rgba(0,0,0,0.40)",
  } as any,
  pillText: {
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
    backgroundColor: C.gold,
  },
  hint: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.32)",
    letterSpacing: 0.3,
    backgroundColor: "rgba(5,2,0,0.48)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
});

// ── Label styles ──────────────────────────────────────────────────────────────

const lbl = StyleSheet.create({
  wrap: {
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
    backgroundColor: "#E0A070",
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  neighText: {
    fontFamily: "Inter_500Medium",
    fontSize: 9.5,
    color: "rgba(255,255,255,0.82)",
    letterSpacing: 0.4,
    textAlign: "center",
    ...TEXT_SHADOW,
  },
  landmarkText: {
    fontFamily: "Inter_400Regular",
    fontSize: 8.5,
    color: "rgba(255,255,255,0.42)",
    letterSpacing: 0.25,
    textAlign: "center",
    ...TEXT_SHADOW,
  },
  activeText: {
    color: "#F0B080",
  },
});
