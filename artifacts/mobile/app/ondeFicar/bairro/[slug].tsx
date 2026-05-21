/**
 * ondeFicar/bairro/[slug].tsx — Bairro detail page for "Onde ficar"
 *
 * Layout matching mockup:
 *   Hero image with back/play/save buttons
 *   Zone label + bairro name
 *   Tags (Gastronômico, Vida noturna, Caminhável)
 *   "ONDE FICAR" section with horizontal hotel cards
 *   Description
 *   "Quero saber mais" button
 *   "Sobre o bairro" expandable section
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import { Feather, Ionicons } from "@expo/vector-icons";
import { useBairro } from "@/hooks/useBairro";
import { useHoteisByBairro } from "@/hooks/useHoteisByBairro";

const { width: W, height: H } = Dimensions.get("window");
const HERO_H = Math.round(H * 0.42);
const HOTEL_CARD_W = 140;
const HOTEL_CARD_H = 180;

const PETROL = "#1B4F72";
const FALLBACK_IMAGE = "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg";

// Build attribute tags from bairro data
function buildTags(bairro: any): string[] {
  const tags: string[] = [];
  if (bairro.gastronomia === "excelente" || bairro.gastronomia === "boa") {
    tags.push("Gastronômico");
  }
  if (bairro.vida_noturna === "intensa" || bairro.vida_noturna === "moderada") {
    tags.push("Vida noturna");
  }
  if (bairro.caminhavel === "muito" || bairro.caminhavel === "razoavel") {
    tags.push("Caminhável");
  }
  return tags;
}

// Rating text
function ratingText(rating: number): string {
  if (rating >= 4.8) return "Excelente";
  if (rating >= 4.5) return "Muito bom";
  if (rating >= 4.0) return "Bom";
  return "Regular";
}

export default function BairroDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { bairro, loading: loadingBairro, error: errorBairro } = useBairro(slug ?? null);
  const { hoteis, loading: loadingHoteis } = useHoteisByBairro(bairro?.id ?? null);

  const [saved, setSaved] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);

  const tags = bairro ? buildTags(bairro) : [];
  const heroUrl = bairro?.hero_image_url || FALLBACK_IMAGE;

  // Loading state
  if (loadingBairro) {
    return (
      <View style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.30)" />
        </View>
      </View>
    );
  }

  // Error state
  if (errorBairro || !bairro) {
    return (
      <View style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.loadingWrap}>
          <Text style={s.errorText}>Bairro não encontrado</Text>
          <Pressable style={s.backBtnAlt} onPress={() => router.back()}>
            <Text style={s.backBtnAltText}>Voltar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 40 }}
      >
        {/* ── Hero Section ── */}
        <View style={[s.hero, { height: HERO_H }]}>
          <Image
            source={{ uri: heroUrl }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.25)", "rgba(0,0,0,0.10)", "rgba(0,0,0,0.60)", "rgba(0,0,0,0.92)"]}
            locations={[0, 0.3, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Top controls */}
          <View style={[s.heroControls, { top: topInset + 12 }]}>
            <Pressable style={s.controlBtn} onPress={() => router.back()} hitSlop={8}>
              <Feather name="chevron-left" size={22} color="#FFFFFF" />
              <Text style={s.controlBtnText}>Voltar</Text>
            </Pressable>

            <View style={s.controlsRight}>
              <Pressable style={s.iconBtn} hitSlop={8}>
                <Ionicons name="play" size={18} color="#FFFFFF" />
              </Pressable>
              <Pressable
                style={s.iconBtn}
                onPress={() => setSaved(!saved)}
                hitSlop={8}
              >
                <Ionicons
                  name={saved ? "heart" : "heart-outline"}
                  size={20}
                  color={saved ? "#E74C3C" : "#FFFFFF"}
                />
              </Pressable>
            </View>
          </View>

          {/* Hero content */}
          <View style={s.heroContent}>
            {/* Zone label */}
            <View style={s.zoneRow}>
              <Text style={s.zoneDot}>◎</Text>
              <Text style={s.zoneText}>ZONA SUL</Text>
            </View>

            {/* Bairro name */}
            <Text style={s.heroName}>{bairro.nome}</Text>

            {/* Tags */}
            {tags.length > 0 && (
              <View style={s.tagsRow}>
                {tags.map((tag, i) => (
                  <View key={i} style={s.tag}>
                    <Text style={s.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ── ONDE FICAR Section ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>ONDE FICAR</Text>
            {hoteis.length > 3 && (
              <Pressable hitSlop={8}>
                <Text style={s.sectionLink}>Ver todos</Text>
              </Pressable>
            )}
          </View>

          {loadingHoteis ? (
            <ActivityIndicator color="rgba(255,255,255,0.30)" style={{ marginVertical: 40 }} />
          ) : hoteis.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.hotelsScroll}
            >
              {hoteis.map((hotel, index) => (
                <Pressable
                  key={hotel.id}
                  style={s.hotelCard}
                  onPress={() => router.push({
                    pathname: "/lugar/[id]",
                    params: { id: hotel.id },
                  })}
                >
                  {/* Hotel image */}
                  <View style={s.hotelImageWrap}>
                    {hotel.hero_image_url ? (
                      <Image
                        source={{ uri: hotel.hero_image_url }}
                        style={s.hotelImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={s.hotelImagePlaceholder}>
                        <Feather name="home" size={24} color="rgba(255,255,255,0.3)" />
                      </View>
                    )}

                    {/* Lucky Pick badge (first hotel) */}
                    {index === 0 && (
                      <View style={s.luckyBadge}>
                        <Text style={s.luckyBadgeText}>LUCKY PICK</Text>
                      </View>
                    )}

                    {/* Save button */}
                    <Pressable style={s.hotelSaveBtn} hitSlop={6}>
                      <Ionicons name="heart-outline" size={16} color="#FFFFFF" />
                    </Pressable>
                  </View>

                  {/* Hotel info */}
                  <Text style={s.hotelName} numberOfLines={1}>{hotel.nome}</Text>
                  <Text style={s.hotelBairro} numberOfLines={1}>{hotel.bairro_nome}</Text>
                  {hotel.rating && (
                    <View style={s.ratingRow}>
                      <Ionicons name="star" size={11} color="#1B4F72" />
                      <Text style={s.ratingText}>
                        {hotel.rating.toFixed(1)} {ratingText(hotel.rating)}
                      </Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={s.emptyHotels}>
              <Feather name="home" size={28} color="rgba(255,255,255,0.20)" />
              <Text style={s.emptyText}>Nenhum hotel cadastrado ainda</Text>
            </View>
          )}
        </View>

        {/* ── Description ── */}
        {bairro.identidade && (
          <View style={s.descSection}>
            <Text style={s.descText}>{bairro.identidade}</Text>
          </View>
        )}

        {/* ── Learn More Button ── */}
        <View style={s.learnMoreSection}>
          <Pressable
            style={s.learnMoreBtn}
            onPress={() => setAboutExpanded(!aboutExpanded)}
          >
            <Text style={s.learnMoreText}>
              Quero saber mais sobre o {bairro.nome}
            </Text>
            <Feather
              name={aboutExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color="rgba(255,255,255,0.6)"
            />
          </Pressable>
        </View>

        {/* ── About Section (Expandable) ── */}
        {aboutExpanded && (
          <View style={s.aboutSection}>
            <Text style={s.aboutLabel}>Sobre o bairro</Text>

            {bairro.descricao_curta && (
              <Text style={s.aboutText}>{bairro.descricao_curta}</Text>
            )}

            {bairro.meu_olhar && (
              <>
                <Text style={s.aboutSubLabel}>Meu olhar</Text>
                <Text style={s.aboutText}>{bairro.meu_olhar}</Text>
              </>
            )}

            {/* Stats */}
            <View style={s.statsGrid}>
              {bairro.gastronomia && (
                <View style={s.statPill}>
                  <Text style={s.statLabel}>Gastronomia</Text>
                  <Text style={s.statValue}>{bairro.gastronomia}</Text>
                </View>
              )}
              {bairro.vida_noturna && (
                <View style={s.statPill}>
                  <Text style={s.statLabel}>Vida noturna</Text>
                  <Text style={s.statValue}>{bairro.vida_noturna}</Text>
                </View>
              )}
              {bairro.caminhavel && (
                <View style={s.statPill}>
                  <Text style={s.statLabel}>Caminhável</Text>
                  <Text style={s.statValue}>{bairro.caminhavel}</Text>
                </View>
              )}
            </View>

            {/* Google Maps */}
            {bairro.google_maps_url && (
              <Pressable
                style={s.mapsBtn}
                onPress={() => Linking.openURL(bairro.google_maps_url!)}
              >
                <Feather name="map-pin" size={14} color="rgba(255,255,255,0.55)" />
                <Text style={s.mapsBtnText}>Ver no Google Maps</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.5)",
  },
  backBtnAlt: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: PETROL,
    borderRadius: 24,
  },
  backBtnAltText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#FFFFFF",
  },

  // Hero
  hero: {
    width: "100%",
    position: "relative",
    justifyContent: "flex-end",
  },
  heroControls: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  controlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 24,
    paddingVertical: 10,
    paddingLeft: 8,
    paddingRight: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  controlBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#FFFFFF",
  },
  controlsRight: {
    flexDirection: "row",
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  zoneDot: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
  },
  zoneText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 1.5,
  },
  heroName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 42,
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  tagText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },

  // Section
  section: {
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 1.5,
  },
  sectionLink: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },

  // Hotels scroll
  hotelsScroll: {
    paddingHorizontal: 20,
    gap: 14,
  },
  hotelCard: {
    width: HOTEL_CARD_W,
  },
  hotelImageWrap: {
    width: HOTEL_CARD_W,
    height: HOTEL_CARD_W,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    marginBottom: 10,
  },
  hotelImage: {
    width: "100%",
    height: "100%",
  },
  hotelImagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
  },
  luckyBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#1B4F72",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  luckyBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    color: "#000000",
    letterSpacing: 0.5,
  },
  hotelSaveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  hotelName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
    marginBottom: 2,
  },
  hotelBairro: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },

  emptyHotels: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
  },

  // Description
  descSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  descText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 24,
  },

  // Learn more
  learnMoreSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  learnMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  learnMoreText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },

  // About section
  aboutSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    marginTop: 8,
  },
  aboutLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5,
    marginBottom: 16,
    marginTop: 16,
  },
  aboutSubLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginTop: 20,
    marginBottom: 8,
  },
  aboutText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 22,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
  },
  statPill: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    minWidth: 100,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.30)",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.70)",
    textTransform: "capitalize",
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
    backgroundColor: "rgba(255,255,255,0.04)",
    marginTop: 20,
  },
  mapsBtnText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
  },
});
