/**
 * ActionBlock — contextual action area for place detail screens.
 *
 * Renders ONLY what exists. Zero empty states, zero placeholders.
 * Hierarchy:
 *   1. Links block  → Maps row + Instagram row (grouped in one card)
 *   2. Booking CTA  → Strong for hotels  /  subtle link for others
 *
 * Future-ready for Supabase props, affiliate links, and click analytics.
 */

import React from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NormalizedPlace } from "@/data/normalizePlace";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActionBlockProps {
  place: NormalizedPlace;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function openURL(url: string) {
  if (Platform.OS === "web") {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

function stripAt(handle: string) {
  return handle.startsWith("@") ? handle.slice(1) : handle;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ActionBlock({ place }: ActionBlockProps) {
  const {
    google_maps_url,
    instagram_handle,
    instagram_url,
    booking_url,
    tipo_item,
  } = place;

  const resolvedInstagramUrl =
    instagram_url ??
    (instagram_handle
      ? `https://instagram.com/${stripAt(instagram_handle)}`
      : null);

  const displayHandle = instagram_handle ? `@${stripAt(instagram_handle)}` : null;

  const hasLinks = !!(google_maps_url || resolvedInstagramUrl);
  const showStrongCTA = !!(booking_url && tipo_item === "hotel");
  const showSubtleBooking = !!(booking_url && tipo_item !== "hotel");

  if (!hasLinks && !booking_url) return null;

  return (
    <View style={s.root}>
      {/* ── Links block — Maps + Instagram in one glass card ── */}
      {hasLinks && (
        <View style={s.linksBlock}>
          {google_maps_url && (
            <Pressable
              style={({ pressed }) => [
                s.linkRow,
                pressed && s.linkRowPressed,
              ]}
              onPress={() => openURL(google_maps_url)}
              accessibilityRole="link"
              accessibilityLabel="Ver no Google Maps"
            >
              <View style={s.linkIconWrap}>
                <Feather name="map-pin" size={14} color="rgba(255,255,255,0.72)" />
              </View>
              <Text style={s.linkLabel}>Ver no Google Maps</Text>
              <Feather
                name="arrow-up-right"
                size={13}
                color="rgba(255,255,255,0.28)"
              />
            </Pressable>
          )}

          {/* Thin separator — only when both rows present */}
          {google_maps_url && resolvedInstagramUrl && (
            <View style={s.sep} />
          )}

          {resolvedInstagramUrl && (
            <Pressable
              style={({ pressed }) => [
                s.linkRow,
                pressed && s.linkRowPressed,
              ]}
              onPress={() => openURL(resolvedInstagramUrl)}
              accessibilityRole="link"
              accessibilityLabel={displayHandle ?? "Ver no Instagram"}
            >
              <View style={s.linkIconWrap}>
                <Feather
                  name="instagram"
                  size={14}
                  color="rgba(255,255,255,0.72)"
                />
              </View>
              <Text style={s.linkLabel}>
                {displayHandle ?? "Ver no Instagram"}
              </Text>
              <Feather
                name="arrow-up-right"
                size={13}
                color="rgba(255,255,255,0.28)"
              />
            </Pressable>
          )}
        </View>
      )}

      {/* ── Strong CTA — hotels only ── */}
      {showStrongCTA && (
        <Pressable
          style={({ pressed }) => [
            s.ctaStrong,
            pressed && s.ctaStrongPressed,
          ]}
          onPress={() => openURL(booking_url!)}
          accessibilityRole="button"
          accessibilityLabel="Reserve aqui"
        >
          <Feather name="calendar" size={15} color="#0A0502" />
          <Text style={s.ctaStrongText}>Reserve aqui</Text>
        </Pressable>
      )}

      {/* ── Subtle booking link — restaurants and experiences ── */}
      {showSubtleBooking && (
        <Pressable
          style={({ pressed }) => [
            s.ctaSubtle,
            pressed && s.ctaSubtlePressed,
          ]}
          onPress={() => openURL(booking_url!)}
          accessibilityRole="link"
          accessibilityLabel="Ver disponibilidade"
        >
          <Feather
            name="external-link"
            size={13}
            color="rgba(255,255,255,0.44)"
          />
          <Text style={s.ctaSubtleText}>Ver disponibilidade</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    gap: 10,
    marginBottom: 24,
  },

  // ── Links group card ──
  linksBlock: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 13,
  },
  linkRowPressed: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  linkIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  linkLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    flex: 1,
    letterSpacing: 0.1,
  },

  // ── Thin row separator ──
  sep: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginHorizontal: 16,
  },

  // ── Hotel CTA — gold, solid, primary weight ──
  ctaStrong: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1B4F72",
    borderRadius: 14,
    paddingVertical: 17,
  },
  ctaStrongPressed: {
    opacity: 0.86,
  },
  ctaStrongText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#0A0502",
    letterSpacing: 0.3,
  },

  // ── Non-hotel booking — ghost link, inline centered ──
  ctaSubtle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
  },
  ctaSubtlePressed: {
    opacity: 0.60,
  },
  ctaSubtleText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.46)",
    letterSpacing: 0.1,
  },
});
