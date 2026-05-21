/**
 * IllustratedMap
 *
 * Reusable curated map component. Uses a hand-crafted illustrated image as
 * the base layer with interactive brand-styled pins on top.
 *
 * Works for: "O que fazer", "Onde comer", "Onde ficar".
 * The parent controls which pin is selected via selectedId / onPinPress.
 */

import React from "react";
import {
  Dimensions,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// The illustrated map image is 512 × 288 px (≈ 16:9)
const MAP_IMAGE_ASPECT = 512 / 288;
export const ILLUSTRATED_MAP_W = SCREEN_WIDTH;
export const ILLUSTRATED_MAP_H = Math.round(ILLUSTRATED_MAP_W / MAP_IMAGE_ASPECT);

const POPUP_H = 72;
const POPUP_GAP = 8;
const PIN_HEAD = 12;
const PIN_TAIL = 8;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MapPlace {
  id: string;
  titulo: string;
  localizacao: string;
  categoria: string;
  /** Pin X as % of image width  (0–100) */
  xPct: number;
  /** Pin Y as % of image height (0–100) */
  yPct: number;
}

interface IllustratedMapProps {
  /** Illustrated map image (city-specific) */
  mapImage: ImageSourcePropType;
  /** Places to pin — each carries xPct / yPct coordinates */
  places: MapPlace[];
  /** Controlled: which pin is currently highlighted */
  selectedId?: string | null;
  /** Called when a pin or the popup close button is pressed */
  onPinPress?: (id: string | null) => void;
  /** Called when the popup card is tapped (e.g. scroll to that card) */
  onPopupPress?: (id: string) => void;
  /** Called when "Voltar" is pressed */
  onBack?: () => void;
  /** Safe-area top inset so controls clear the status bar */
  topInset?: number;
  /** Label for the pin count badge, e.g. "5 locais" */
  locaisLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function IllustratedMap({
  mapImage,
  places,
  selectedId,
  onPinPress,
  onPopupPress,
  onBack,
  topInset = 14,
  locaisLabel,
}: IllustratedMapProps) {
  const selectedPlace = places.find((p) => p.id === selectedId) ?? null;
  const controlTop = topInset + 10;

  function handlePinPress(id: string) {
    // Toggle: pressing the same pin again deselects it
    onPinPress?.(selectedId === id ? null : id);
  }

  return (
    <View style={s.root}>
      {/* ── Base: illustrated map image ── */}
      <View style={s.mapFrame}>
        <Image source={mapImage} style={s.mapImage} />

        {/* Very light dark wash — lifts contrast of pins without obscuring illustration */}
        <View style={s.overlay} />

        {/* Interactive pins */}
        {places.map((place) => {
          const isSelected = place.id === selectedId;
          const left = (place.xPct / 100) * ILLUSTRATED_MAP_W;
          const top = (place.yPct / 100) * ILLUSTRATED_MAP_H;

          return (
            <Pressable
              key={place.id}
              onPress={() => handlePinPress(place.id)}
              style={[s.pinWrap, { left, top }]}
              hitSlop={14}
            >
              {/* Selection glow ring */}
              {isSelected && <View style={s.pinRing} />}

              {/* Pin head */}
              <View style={[s.pinHead, isSelected && s.pinHeadSelected]} />

              {/* Pin tail */}
              <View style={[s.pinTail, isSelected && s.pinTailSelected]} />

              {/* Floating label — only when selected */}
              {isSelected && (
                <View style={s.pinLabel}>
                  <Text style={s.pinLabelText} numberOfLines={1}>
                    {place.titulo}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}

        {/* ── Back / Voltar ── */}
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

        {/* ── Locais count badge ── */}
        {locaisLabel && (
          <View style={[s.controlPill, { top: controlTop, right: 16 }]}>
            <View style={s.badgeDot} />
            <Text style={s.controlPillText}>{locaisLabel}</Text>
          </View>
        )}

        {/* ── Zoom controls (visual only) ── */}
        <View style={s.zoomControls}>
          <Pressable style={s.zoomBtn}>
            <Feather name="plus" size={13} color={C.white} />
          </Pressable>
          <View style={s.zoomDivider} />
          <Pressable style={s.zoomBtn}>
            <Feather name="minus" size={13} color={C.white} />
          </Pressable>
        </View>
      </View>

      {/* ── Popup — slides in below the map when a pin is selected ──
          Tapping the popup scrolls the parent to that card. ── */}
      {selectedPlace && (
        <Pressable
          style={s.popup}
          onPress={() => onPopupPress?.(selectedPlace.id)}
        >
          <View style={s.popupLeft}>
            <Text style={s.popupCategory}>{selectedPlace.categoria}</Text>
            <Text style={s.popupTitle} numberOfLines={1}>
              {selectedPlace.titulo}
            </Text>
            <Text style={s.popupLocation}>{selectedPlace.localizacao}</Text>
          </View>

          {/* Scroll-to-card cue */}
          <View style={s.popupCue}>
            <Feather name="chevron-down" size={15} color={C.terracotta} />
          </View>

          {/* Dismiss */}
          <Pressable
            onPress={() => onPinPress?.(null)}
            style={s.popupDismiss}
            hitSlop={8}
          >
            <Feather name="x" size={13} color="rgba(255,255,255,0.45)" />
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    width: "100%",
    backgroundColor: "#0D0906",
  },

  mapFrame: {
    width: ILLUSTRATED_MAP_W,
    height: ILLUSTRATED_MAP_H,
    overflow: "hidden",
  },
  mapImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,3,1,0.18)",
  },

  // ── Pins ──
  pinWrap: {
    position: "absolute",
    alignItems: "center",
    transform: [
      { translateX: -(PIN_HEAD / 2) },
      { translateY: -(PIN_HEAD + PIN_TAIL) },
    ],
  },
  pinRing: {
    position: "absolute",
    top: -(PIN_HEAD * 0.45),
    left: -(PIN_HEAD * 0.45),
    width: PIN_HEAD * 1.9,
    height: PIN_HEAD * 1.9,
    borderRadius: PIN_HEAD,
    borderWidth: 1.5,
    borderColor: "rgba(196,112,74,0.60)",
    backgroundColor: "rgba(196,112,74,0.14)",
  },
  pinHead: {
    width: PIN_HEAD,
    height: PIN_HEAD,
    borderRadius: PIN_HEAD / 2,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1.5,
    borderColor: "rgba(196,112,74,0.65)",
  },
  pinHeadSelected: {
    backgroundColor: C.terracotta,
    borderColor: "#FFFFFF",
    borderWidth: 2,
  },
  pinTail: {
    width: 2,
    height: PIN_TAIL,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 1,
  },
  pinTailSelected: {
    backgroundColor: C.terracotta,
  },
  pinLabel: {
    position: "absolute",
    top: -(PIN_HEAD + PIN_TAIL + 28),
    backgroundColor: "rgba(8,4,2,0.88)",
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(196,112,74,0.45)",
    minWidth: 72,
    maxWidth: 140,
    alignItems: "center",
  },
  pinLabelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "#FFFFFF",
    letterSpacing: 0.2,
    textAlign: "center",
  },

  // ── Controls — "Voltar" pill + badge ──
  controlPill: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(8,4,2,0.62)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
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

  // ── Zoom ──
  zoomControls: {
    position: "absolute",
    bottom: 14,
    right: 14,
    backgroundColor: "rgba(8,4,2,0.62)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  zoomBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  // ── Popup ──
  popup: {
    marginHorizontal: 16,
    marginTop: POPUP_GAP,
    height: POPUP_H,
    backgroundColor: "rgba(20,12,6,0.97)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(196,112,74,0.28)",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 18,
    paddingRight: 12,
    gap: 10,
  },
  popupLeft: {
    flex: 1,
    gap: 2,
  },
  popupCategory: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: C.terracotta,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  popupTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
    lineHeight: 22,
  },
  popupLocation: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.48)",
  },
  popupCue: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(196,112,74,0.14)",
    borderWidth: 1,
    borderColor: "rgba(196,112,74,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  popupDismiss: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
