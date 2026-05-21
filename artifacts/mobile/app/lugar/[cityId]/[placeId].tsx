// app/lugar/[cityId]/[placeId].tsx — Tela de detalhe do lugar (entidade)
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Animated,
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
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { supabase } from "@/lib/supabase";
import { useLugar } from "@/hooks/useLugar";
import { useLugarFotos } from "@/hooks/useLugarFotos";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const FALLBACK_IMG = require("../../../assets/images/ipanema.png");

const GOLD = "#1B4F72";

// ── Badge labels por tipo ────────────────────────────────────────────────────
const TIPO_LABELS: Record<string, string> = {
  restaurante: "RESTAURANTE",
  bar: "BAR",
  hotel: "HOTEL",
  atividade: "ATIVIDADE",
  passeio: "PASSEIO",
  luckylist: "LUCKY LIST",
};

// ══════════════════════════════════════════════════════════════════════════════
// ── COMPONENTS ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── Hero Background com carrossel de fotos ───────────────────────────────────
function HeroCarousel({
  fotos,
  currentIdx,
  prevIdx,
  fadeAnim,
}: {
  fotos: string[];
  currentIdx: number;
  prevIdx: number;
  fadeAnim: Animated.Value;
}) {
  if (fotos.length === 0) {
    return (
      <View style={styles.heroContainer}>
        <Image source={FALLBACK_IMG} style={styles.heroImage} resizeMode="cover" />
        <LinearGradient
          colors={["rgba(0,0,0,0.35)", "transparent", "rgba(0,0,0,0.65)"]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  return (
    <View style={styles.heroContainer}>
      {/* Imagem anterior (saindo) */}
      <Animated.Image
        source={{ uri: fotos[prevIdx] || fotos[0] }}
        style={[
          styles.heroImage,
          {
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
          },
        ]}
        resizeMode="cover"
      />
      {/* Imagem atual (entrando) */}
      <Animated.Image
        source={{ uri: fotos[currentIdx] || fotos[0] }}
        style={[styles.heroImage, { opacity: fadeAnim }]}
        resizeMode="cover"
      />
      {/* Gradientes para legibilidade */}
      <LinearGradient
        colors={["rgba(0,0,0,0.35)", "transparent"]}
        locations={[0, 0.5]}
        style={[StyleSheet.absoluteFill, { height: SCREEN_HEIGHT * 0.2 }]}
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.65)"]}
        locations={[0.3, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Dots indicator */}
      {fotos.length > 1 && (
        <View style={styles.dotsContainer}>
          {fotos.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIdx && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Botão Salvar ─────────────────────────────────────────────────────────────
function SaveButton({ lugarId, initialSaved = false }: { lugarId: string; initialSaved?: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        // Usuário não logado - apenas toggle visual
        setSaved(!saved);
        setLoading(false);
        return;
      }

      if (saved) {
        // Remover
        await supabase
          .from("user_saved_places")
          .delete()
          .eq("user_id", session.user.id)
          .eq("lugar_id", lugarId);
      } else {
        // Adicionar
        await supabase
          .from("user_saved_places")
          .insert({ user_id: session.user.id, lugar_id: lugarId });
      }
      setSaved(!saved);
    } catch (e) {
      console.error("Erro ao salvar lugar:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable style={styles.saveButton} onPress={handleToggle} disabled={loading}>
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Ionicons
          name={saved ? "bookmark" : "bookmark-outline"}
          size={22}
          color={saved ? GOLD : "#FFFFFF"}
        />
      )}
    </Pressable>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export default function LugarDetailScreen() {
  const { placeId } = useLocalSearchParams<{ cityId: string; placeId: string }>();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const bottomInset = Platform.OS === "web" ? 20 : insets.bottom;

  // ── Hooks ──
  const { lugar, loading, error } = useLugar(placeId || null);
  const { fotos, loading: loadingFotos } = useLugarFotos(
    lugar ? { ...lugar, destino_slug: lugar.destino?.slug } : null
  );

  // ── Photo carousel state ──
  const [photoIdx, setPhotoIdx] = useState(0);
  const [prevPhotoIdx, setPrevPhotoIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Auto-rotate photos every 6s ──
  useEffect(() => {
    if (fotos.length <= 1) return;

    const interval = setInterval(() => {
      const nextIdx = (photoIdx + 1) % fotos.length;
      setPrevPhotoIdx(photoIdx);
      fadeAnim.setValue(0);
      setPhotoIdx(nextIdx);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    }, 6000);

    return () => clearInterval(interval);
  }, [photoIdx, fotos.length, fadeAnim]);

  // ── Action handlers ──
  const openMaps = useCallback(() => {
    if (lugar?.google_maps_url) {
      Linking.openURL(lugar.google_maps_url);
    } else if (lugar?.google_place_id) {
      Linking.openURL(`https://www.google.com/maps/place/?q=place_id:${lugar.google_place_id}`);
    } else if (lugar?.lat && lugar?.lng) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lugar.lat},${lugar.lng}`);
    }
  }, [lugar]);

  const openInstagram = useCallback(() => {
    if (lugar?.instagram) {
      const handle = lugar.instagram.replace("@", "").trim();
      Linking.openURL(`https://instagram.com/${handle}`);
    }
  }, [lugar]);

  const openReservation = useCallback(() => {
    if (lugar?.url_reserva) {
      Linking.openURL(lugar.url_reserva);
    }
  }, [lugar]);

  // ── Loading state ──
  if (loading || loadingFotos) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={GOLD} />
      </View>
    );
  }

  // ── Not found ──
  if (!lugar || error) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <Image source={FALLBACK_IMG} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={20} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.7)" }]} />
        <Pressable style={[styles.backButton, { top: topInset + 12 }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.notFoundContent}>
          <Text style={styles.notFoundTitle}>Lugar não encontrado</Text>
          <Text style={styles.notFoundText}>Este lugar ainda não está disponível.</Text>
        </View>
      </View>
    );
  }

  const tipoLabel = TIPO_LABELS[lugar.tipo || lugar.categoria] || lugar.categoria?.toUpperCase() || "LUGAR";
  const hasMaps = lugar.google_maps_url || lugar.google_place_id || (lugar.lat && lugar.lng);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ══════════════════════════════════════════════════════════════════════
          Hero — Carrossel de fotos nítidas
          ══════════════════════════════════════════════════════════════════════ */}
      <HeroCarousel
        fotos={fotos}
        currentIdx={photoIdx}
        prevIdx={prevPhotoIdx}
        fadeAnim={fadeAnim}
      />

      {/* ── Back Button ── */}
      <Pressable
        style={[styles.backButton, { top: topInset + 12 }]}
        onPress={() => router.back()}
      >
        <Feather name="arrow-left" size={20} color="#FFFFFF" />
      </Pressable>

      {/* ── Save Button ── */}
      <View style={[styles.saveButtonWrapper, { top: topInset + 12 }]}>
        <SaveButton lugarId={lugar.id} />
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          Content Container
          ══════════════════════════════════════════════════════════════════════ */}
      <View style={styles.contentWrapper}>
        <View style={styles.contentContainer}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 40 }]}
          >
            {/* Drag handle */}
            <View style={styles.dragHandle} />

            {/* Badge — Tipo */}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{tipoLabel}</Text>
            </View>

            {/* Title — Nome */}
            <Text style={styles.title}>{lugar.nome}</Text>

            {/* Bairro */}
            {lugar.bairro?.nome && (
              <View style={styles.bairroRow}>
                <Feather name="map-pin" size={12} color="rgba(255,255,255,0.5)" />
                <Text style={styles.bairroText}>{lugar.bairro.nome}</Text>
              </View>
            )}

            {/* Divider */}
            <View style={styles.divider} />

            {/* ══════════════════════════════════════════════════════════════════
                MEU OLHAR — Texto editorial do Bruno
                ══════════════════════════════════════════════════════════════════ */}
            {lugar.meu_olhar && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>MEU OLHAR</Text>
                <Text style={styles.sectionText}>{lugar.meu_olhar}</Text>
              </View>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                COMO APROVEITAR — Dicas em bullet points
                ══════════════════════════════════════════════════════════════════ */}
            {lugar.como_aproveitar && lugar.como_aproveitar.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>COMO APROVEITAR</Text>
                {lugar.como_aproveitar.map((item, index) => (
                  <View key={index} style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                INFO — Momento ideal, Vibe, Preço
                ══════════════════════════════════════════════════════════════════ */}
            {(lugar.momento_ideal || lugar.vibe || lugar.preco_nivel) && (
              <View style={styles.infoGrid}>
                {lugar.momento_ideal && lugar.momento_ideal.length > 0 && (
                  <View style={styles.infoItem}>
                    <Feather name="clock" size={14} color={GOLD} />
                    <Text style={styles.infoText}>{lugar.momento_ideal.join(", ")}</Text>
                  </View>
                )}
                {lugar.vibe && lugar.vibe.length > 0 && (
                  <View style={styles.infoItem}>
                    <Feather name="heart" size={14} color={GOLD} />
                    <Text style={styles.infoText}>{lugar.vibe.join(", ")}</Text>
                  </View>
                )}
                {lugar.preco_nivel && (
                  <View style={styles.infoItem}>
                    <Text style={styles.precoText}>{"$".repeat(lugar.preco_nivel)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                ACTION BUTTONS
                ══════════════════════════════════════════════════════════════════ */}
            <View style={styles.actions}>
              {/* Ver no Maps */}
              {hasMaps && (
                <Pressable style={styles.btnPrimary} onPress={openMaps}>
                  <Feather name="map" size={16} color="#FFFFFF" />
                  <Text style={styles.btnPrimaryText}>Ver no Maps</Text>
                </Pressable>
              )}

              {/* Reservar — para hotéis e restaurantes com reserva */}
              {lugar.url_reserva && (
                <Pressable style={styles.btnGold} onPress={openReservation}>
                  <Feather name="calendar" size={16} color="#000000" />
                  <Text style={styles.btnGoldText}>Reservar</Text>
                </Pressable>
              )}

              {/* Instagram */}
              {lugar.instagram && (
                <Pressable style={styles.btnSecondary} onPress={openInstagram}>
                  <Feather name="instagram" size={16} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.btnSecondaryText}>
                    {lugar.instagram.startsWith("@") ? lugar.instagram : `@${lugar.instagram}`}
                  </Text>
                </Pressable>
              )}

              {/* Website */}
              {lugar.website && (
                <Pressable
                  style={styles.btnSecondary}
                  onPress={() => Linking.openURL(lugar.website!)}
                >
                  <Feather name="globe" size={16} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.btnSecondaryText}>Website</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── STYLES ────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Hero Carousel ──
  heroContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.5,
  },
  heroImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.5,
  },
  dotsContainer: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  dotActive: {
    width: 18,
    backgroundColor: GOLD,
  },

  // ── Back Button ──
  backButton: {
    position: "absolute",
    left: 20,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Save Button ──
  saveButtonWrapper: {
    position: "absolute",
    right: 20,
    zIndex: 20,
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Content Container ──
  contentWrapper: {
    flex: 1,
    marginTop: SCREEN_HEIGHT * 0.38,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: "rgba(10,10,10,0.95)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 24,
  },

  // ── Badge ──
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(27,79,114,0.15)",
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.35)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 2,
    color: GOLD,
  },

  // ── Content ──
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: "#FFFFFF",
    lineHeight: 40,
    marginBottom: 12,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bairroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  bairroText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 24,
  },

  // ── Sections ──
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    color: GOLD,
    marginBottom: 12,
  },
  sectionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 24,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  bullet: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: GOLD,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 22,
  },

  // ── Info Grid ──
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  infoText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  precoText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: GOLD,
  },

  // ── Actions ──
  actions: {
    marginTop: 8,
    gap: 12,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#2C5F6E",
    borderRadius: 14,
    paddingVertical: 16,
  },
  btnPrimaryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  btnGold: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
  },
  btnGoldText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#000000",
  },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  btnSecondaryText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },

  // ── Not Found ──
  notFoundContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  notFoundTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  notFoundText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
});
