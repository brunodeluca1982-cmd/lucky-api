import React from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
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
import { useHotel } from "@/hooks/useHotel";
import { getImageForEntity } from "@/utils/getImageForEntity";
import { useGuia } from "@/context/GuiaContext";

const C = Colors.light;
const GOLD = "#1B4F72";

const CATEGORY_LABEL: Record<string, string> = {
  luxo:     "LUXO",
  boutique: "BOUTIQUE",
  design:   "DESIGN",
  ícone:    "ÍCONE",
  icone:    "ÍCONE",
  pousada:  "POUSADA",
  budget:   "ECONÔMICO",
};

function categoryLabel(raw: string): string {
  return CATEGORY_LABEL[raw?.toLowerCase()] ?? raw?.toUpperCase() ?? "HOTEL";
}

export default function HotelDetailScreen() {
  const { hotelId } = useLocalSearchParams<{ hotelId: string }>();
  const insets      = useSafeAreaInsets();
  const topInset    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad   = Platform.OS === "web" ? 34 : insets.bottom;

  const { hotel, loading, error } = useHotel(hotelId ?? "");
  const { save, unsave, isSaved } = useGuia();

  // Hero image — Supabase photo_url first, then neighborhood fallback
  const heroImage = hotel
    ? getImageForEntity("hotel", hotel.hotel_name, hotel.neighborhood.neighborhood_name, hotel.photo_url ?? null)
    : getImageForEntity("neighborhood", "Ipanema");

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Back bar ── */}
      <View style={[s.topBar, { paddingTop: topInset + 12 }]}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={16} color={C.white} />
          <Text style={s.backText}>Voltar</Text>
        </Pressable>
        {hotel && (
          <Text style={s.topCategory}>{categoryLabel(hotel.hotel_category)}</Text>
        )}
      </View>

      {/* ── Loading ── */}
      {loading && (
        <View style={s.centerWrap}>
          <ActivityIndicator size="large" color={C.terracotta} />
          <Text style={s.loadingText}>Carregando hospedagem…</Text>
        </View>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <View style={s.centerWrap}>
          <Feather name="alert-circle" size={28} color="rgba(196,112,74,0.5)" />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* ── Not found ── */}
      {!loading && !error && !hotel && (
        <View style={s.centerWrap}>
          <Text style={s.errorText}>Hospedagem não encontrada.</Text>
        </View>
      )}

      {/* ── Content ── */}
      {!loading && !error && hotel && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad + 48 }}
        >
          {/* Hero header — real destination image with gradient overlay */}
          <View style={s.hero}>
            <Image
              source={heroImage}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            <LinearGradient
              colors={["rgba(0,0,0,0.06)", "rgba(0,0,0,0.60)", "#000000"]}
              locations={[0.10, 0.52, 0.90]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* Feature badges */}
            <View style={s.heroBadges}>
              {hotel.front_beach && (
                <View style={s.featureBadge}>
                  <Text style={s.featureBadgeText}>Frente ao mar</Text>
                </View>
              )}
              {hotel.rooftop && (
                <View style={s.featureBadge}>
                  <Text style={s.featureBadgeText}>Terraço</Text>
                </View>
              )}
            </View>

            {/* Neighborhood watermark */}
            <Text style={s.neighborhoodWatermark} numberOfLines={1}>
              {hotel.neighborhood.neighborhood_name}
            </Text>

            {/* Hotel name */}
            <View style={s.heroBottom}>
              <Text style={s.heroLocation}>
                {hotel.neighborhood.neighborhood_name} · Rio de Janeiro
              </Text>
              <Text style={s.heroName}>{hotel.hotel_name}</Text>
              {hotel.featured_restaurant && (
                <View style={s.restaurantBadge}>
                  <Feather name="coffee" size={10} color="rgba(27,79,114,0.7)" />
                  <Text style={s.restaurantText}>{hotel.featured_restaurant}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Divider */}
          <View style={s.divider} />

          {/* My view editorial text */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Por dentro</Text>
            {hotel.my_view
              .replace(/\r\n/g, "\n")
              .split("\n")
              .map((p, i) =>
                p.trim() ? (
                  <Text key={`para-${i}`} style={s.bodyText}>{p.trim()}</Text>
                ) : null,
              )}
          </View>

          {/* How to enjoy */}
          {hotel.how_to_enjoy && hotel.how_to_enjoy.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Como aproveitar</Text>
              {hotel.how_to_enjoy.map((tip, i) => (
                <View key={`tip-${i}`} style={s.tipRow}>
                  <View style={s.tipDot} />
                  <Text style={s.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Details grid */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Detalhes</Text>
            <View style={s.detailGrid}>
              <DetailPill label="Categoria" value={categoryLabel(hotel.hotel_category)} />
              <DetailPill
                label="Segurança solo"
                value={hotel.safety_solo_woman === "alto" ? "Alta" : "Média"}
              />
              <DetailPill
                label="Público"
                value={hotel.audience === "turismo" ? "Turismo" : "Luxo"}
              />
              {hotel.instagram && (
                <DetailPill label="Instagram" value={`@${hotel.instagram}`} />
              )}
            </View>
          </View>

          {/* CTA */}
          <View style={s.ctaSection}>
            {hotel.reserve_url ? (
              <Pressable
                style={s.reservarBtn}
                onPress={() => Linking.openURL(hotel.reserve_url)}
              >
                <Feather name="external-link" size={15} color="#000000" />
                <Text style={s.reservarText}>Reservar agora</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[s.salvarBtn, isSaved(hotel.id) && s.salvarBtnSaved]}
              onPress={() => {
                if (isSaved(hotel.id)) {
                  unsave(hotel.id);
                } else {
                  save({
                    id:           hotel.id,
                    categoria:    "hotel",
                    source_table: "stay_hotels",
                    titulo:       hotel.hotel_name,
                    localizacao:  hotel.neighborhood.neighborhood_name,
                    image:        heroImage,
                  });
                }
              }}
            >
              <Feather
                name="bookmark"
                size={14}
                color={isSaved(hotel.id) ? GOLD : "rgba(255,255,255,0.68)"}
              />
              <Text style={[s.salvarText, isSaved(hotel.id) && s.salvarTextSaved]}>
                {isSaved(hotel.id) ? "Salvo na viagem" : "Salvar na viagem"}
              </Text>
            </Pressable>

            {hotel.google_maps && (
              <Pressable
                style={s.mapsBtn}
                onPress={() => Linking.openURL(hotel.google_maps!)}
              >
                <Feather name="map-pin" size={14} color={C.terracotta} />
                <Text style={s.mapsBtnText}>Ver no mapa</Text>
              </Pressable>
            )}
          </View>

          {/* Footer */}
          <View style={s.footer}>
            <Text style={s.footerL}>L.</Text>
            <Text style={s.footerText}>
              {hotel.neighborhood.identity_phrase}
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detailPill}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#000000",
    zIndex: 10,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  backText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.white,
  },
  topCategory: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: C.terracotta,
    letterSpacing: 1.4,
  },

  // Loading / error
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 32,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.35)",
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
  },

  // Hero
  hero: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
    minHeight: 200,
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
  },
  heroBadges: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  featureBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  featureBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.4,
  },
  neighborhoodWatermark: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 68,
    color: "rgba(255,255,255,0.05)",
    letterSpacing: -2,
    position: "absolute",
    bottom: 54,
    left: 20,
    right: 20,
  },
  heroBottom: {
    gap: 6,
  },
  heroLocation: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.40)",
    letterSpacing: 0.5,
  },
  heroName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: C.white,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  restaurantBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(27,79,114,0.10)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.22)",
    alignSelf: "flex-start",
    marginTop: 4,
  },
  restaurantText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(27,79,114,0.80)",
    letterSpacing: 0.2,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  // Sections
  section: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 4,
  },
  sectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: C.warmGray,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 18,
  },
  bodyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 26,
    letterSpacing: 0.1,
    marginBottom: 14,
  },

  // Tips
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  tipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(27,79,114,0.55)",
    marginTop: 9,
    flexShrink: 0,
  },
  tipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 22,
    flex: 1,
  },

  // Detail grid
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  detailPill: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    minWidth: 120,
  },
  detailLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  detailValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.80)",
  },

  // CTAs
  ctaSection: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 12,
  },
  reservarBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: C.cream,
    borderRadius: 14,
    paddingVertical: 16,
  },
  reservarText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.darkBrown,
    letterSpacing: 0.2,
  },
  mapsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  mapsBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.68)",
    letterSpacing: 0.1,
  },
  salvarBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  salvarBtnSaved: {
    backgroundColor: "rgba(27,79,114,0.12)",
    borderColor: "rgba(27,79,114,0.30)",
  },
  salvarText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.68)",
    letterSpacing: 0.1,
  },
  salvarTextSaved: {
    color: GOLD,
  },

  // Footer
  footer: {
    marginTop: 36,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    gap: 8,
  },
  footerL: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: C.terracotta,
  },
  footerText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 14,
    color: C.warmGray,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 260,
    fontStyle: "italic",
  },
});
