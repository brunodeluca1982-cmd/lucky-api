// app/lugar/[id].tsx — Entity detail page (matches Ciclovia mockup exactly)
import React, { useState, useEffect, useRef } from "react";
import {
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
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";

const { width: W, height: H } = Dimensions.get("window");
const PETROL = "#1B4F72";
const TEAL = "#4ECDC4";
const SUPABASE = "https://bkwlximkadmlnbgjcrdp.supabase.co";
const FALLBACK = `${SUPABASE}/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg`;

type Lugar = {
  id: string;
  nome: string;
  categoria: string;
  subcategoria?: string;
  hero_image_url: string;
  meu_olhar: string;
  como_aproveitar: string[];
  momento_ideal: string[];
  vibe: string[];
  energia?: string;
  duracao_media?: string;
  preco_nivel?: number;
  endereco?: string;
  telefone?: string;
  instagram?: string;
  website?: string;
  google_maps_url?: string;
  lat?: number;
  lng?: number;
  bairros?: { nome: string };
};

// Build full storage URL
function buildMediaUrl(path: string | null | undefined): string {
  if (!path) return FALLBACK;
  if (path.startsWith("http")) return path;
  return `${SUPABASE}/storage/v1/object/public/media/${path}`;
}

// Format categoria for display
function formatCategoria(cat: string): string {
  const map: Record<string, string> = {
    atividade: "APROVADO AO AVESSO",
    praia: "PRAIA",
    restaurante: "ONDE COMER",
    bar: "BAR",
    hotel: "ONDE FICAR",
    cafe: "CAFE",
    luckylist: "LUCKY LIST",
    compras: "COMPRAS",
  };
  return map[cat?.toLowerCase()] || cat?.toUpperCase() || "LUGAR";
}

// ── Metric Item Component ──────────────────────────────────────────────────────
function MetricItem({ icon, valor, label }: { icon: React.ReactNode; valor: string; label: string }) {
  return (
    <View style={s.metricaItem}>
      <View style={s.metricaIconWrap}>{icon}</View>
      <Text style={s.metricaValor}>{valor}</Text>
      <Text style={s.metricaLabel}>{label}</Text>
    </View>
  );
}

export default function LugarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 0 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const [lugar, setLugar] = useState<Lugar | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [sobreVisible, setSobreVisible] = useState(false);

  // Animation for bottom sheet
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!id) return;
    supabase
      .from("lugares")
      .select("*, bairros(nome)")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) setLugar(data as Lugar);
        setLoading(false);
      });
  }, [id]);

  // Animate bottom sheet
  useEffect(() => {
    Animated.timing(sheetAnim, {
      toValue: sobreVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [sobreVisible]);

  // Loading state
  if (loading) {
    return (
      <View style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.loadingContainer}>
          <Text style={s.loadingText}>Carregando...</Text>
        </View>
      </View>
    );
  }

  // Not found state
  if (!lugar) {
    return (
      <View style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.loadingContainer}>
          <Text style={s.loadingText}>Lugar nao encontrado</Text>
          <Pressable style={s.backBtnCenter} onPress={() => router.back()}>
            <Text style={s.backBtnCenterText}>Voltar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const bairroNome = lugar.bairros?.nome || "Rio de Janeiro";
  const heroUrl = buildMediaUrl(lugar.hero_image_url);

  // Format vibe text (for "Ideal para")
  const vibeText = lugar.vibe?.join(", ") || "";

  // Format momento text (for "Quando ir")
  const momentoText = lugar.momento_ideal?.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(" ou ") || "";

  // Build "como aproveitar" description for Sobre sheet
  const comoAproveitar = lugar.como_aproveitar?.length > 0
    ? lugar.como_aproveitar.join(". ") + "."
    : lugar.meu_olhar;

  // Get a tip for "Dica do Lucky"
  const dicaLucky = lugar.como_aproveitar?.length > 0
    ? lugar.como_aproveitar[lugar.como_aproveitar.length - 1]
    : lugar.duracao_media
      ? `Reserve ${lugar.duracao_media} para aproveitar bem`
      : "Va sem pressa e aproveite cada momento";

  // Sheet translate
  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [H * 0.5, 0],
  });

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ═══ HERO (50% of screen) ═══ */}
      <View style={s.heroContainer}>
        <Image source={{ uri: heroUrl }} style={s.heroImage} />
        <LinearGradient
          colors={["rgba(0,0,0,0.25)", "transparent", "rgba(0,0,0,0.7)"]}
          locations={[0, 0.3, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Top Bar */}
        <View style={[s.topBar, { paddingTop: top + 12 }]}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Feather name="chevron-left" size={20} color={PETROL} />
            <Text style={s.backBtnText}>Voltar</Text>
          </Pressable>
        </View>

        {/* Save Button (top right) */}
        <View style={[s.saveBtnContainer, { top: top + 12 }]}>
          <Pressable
            style={[s.saveBtn, saved && s.saveBtnActive]}
            onPress={() => setSaved(!saved)}
          >
            <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={22} color={saved ? PETROL : "#FFF"} />
            <Text style={[s.saveBtnText, saved && s.saveBtnTextActive]}>
              {saved ? "Salvo" : "Salvar"}
            </Text>
          </Pressable>
        </View>

        {/* Hero Content */}
        <View style={s.heroContent}>
          {/* Pills */}
          <View style={s.pillsRow}>
            <View style={s.pill}>
              <Feather name="check-circle" size={10} color="#FFF" />
              <Text style={s.pillText}>{formatCategoria(lugar.categoria)}</Text>
            </View>
            <View style={s.pill}>
              <Feather name="map-pin" size={10} color="#FFF" />
              <Text style={s.pillText}>{bairroNome.toUpperCase()}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={s.heroTitle}>{lugar.nome}</Text>
        </View>
      </View>

      {/* ═══ SCROLLABLE CONTENT ═══ */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ METRICS ROW ═══ */}
        <View style={s.metricasRow}>
          {lugar.duracao_media && (
            <MetricItem
              icon={<MaterialCommunityIcons name="ruler" size={18} color={PETROL} />}
              valor={lugar.duracao_media}
              label="Extensao"
            />
          )}
          {lugar.energia && (
            <MetricItem
              icon={<MaterialCommunityIcons name="gauge" size={18} color={PETROL} />}
              valor={lugar.energia.charAt(0).toUpperCase() + lugar.energia.slice(1)}
              label="Nivel"
            />
          )}
          <MetricItem
            icon={<Feather name="clock" size={16} color={PETROL} />}
            valor="Sempre"
            label="Melhor horario"
          />
          {lugar.momento_ideal?.length > 0 && (
            <MetricItem
              icon={<Feather name="sun" size={16} color={PETROL} />}
              valor={lugar.momento_ideal[0].charAt(0).toUpperCase() + lugar.momento_ideal[0].slice(1)}
              label="Ideal"
            />
          )}
        </View>

        {/* ═══ BODY TEXT ═══ */}
        <View style={s.content}>
          <Text style={s.bodyText}>{lugar.meu_olhar}</Text>

          {/* Quero saber mais link */}
          <Pressable style={s.saberMaisBtn} onPress={() => setSobreVisible(true)}>
            <Text style={s.saberMaisText}>Quero saber mais</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ═══ SOBRE O LUGAR (Bottom Sheet) ═══ */}
      {sobreVisible && (
        <View style={s.sheetOverlay}>
          <Pressable style={s.sheetBackdrop} onPress={() => setSobreVisible(false)} />
          <Animated.View
            style={[
              s.sheetContainer,
              { transform: [{ translateY: sheetTranslate }], paddingBottom: bottom + 20 },
            ]}
          >
            {/* Handle bar */}
            <View style={s.sheetHandle} />

            {/* Header */}
            <View style={s.sheetHeader}>
              <Pressable style={s.sheetClose} onPress={() => setSobreVisible(false)}>
                <Feather name="x" size={20} color="#333" />
              </Pressable>
              <Text style={s.sheetTitle}>Sobre o lugar</Text>
              <View style={{ width: 32 }} />
            </View>

            {/* Description */}
            <ScrollView style={s.sheetScroll} showsVerticalScrollIndicator={false}>
              <Text style={s.sheetText}>{comoAproveitar}</Text>

              {/* List items */}
              <View style={s.sheetList}>
                {/* Ideal para */}
                {vibeText && (
                  <View style={s.sheetListItem}>
                    <View style={[s.sheetIcon, { backgroundColor: "rgba(78, 205, 196, 0.15)" }]}>
                      <Feather name="heart" size={16} color={TEAL} />
                    </View>
                    <View style={s.sheetContent}>
                      <Text style={s.sheetLabel}>Ideal para</Text>
                      <Text style={s.sheetValue}>{vibeText}</Text>
                    </View>
                  </View>
                )}

                {/* Quando ir */}
                {momentoText && (
                  <View style={s.sheetListItem}>
                    <View style={[s.sheetIcon, { backgroundColor: "rgba(78, 205, 196, 0.15)" }]}>
                      <Feather name="clock" size={16} color={TEAL} />
                    </View>
                    <View style={s.sheetContent}>
                      <Text style={s.sheetLabel}>Quando ir</Text>
                      <Text style={s.sheetValue}>{momentoText}</Text>
                    </View>
                  </View>
                )}

                {/* Dica do Lucky */}
                <View style={s.sheetListItem}>
                  <View style={[s.sheetIcon, { backgroundColor: "rgba(78, 205, 196, 0.15)" }]}>
                    <Feather name="star" size={16} color={TEAL} />
                  </View>
                  <View style={s.sheetContent}>
                    <Text style={s.sheetLabel}>Dica do Lucky</Text>
                    <Text style={s.sheetValue}>{dicaLucky}</Text>
                  </View>
                </View>
              </View>

              {/* Contact info in sheet */}
              {(lugar.endereco || lugar.instagram || lugar.google_maps_url) && (
                <View style={s.sheetContact}>
                  {lugar.endereco && (
                    <View style={s.sheetContactRow}>
                      <Feather name="map-pin" size={14} color="#666" />
                      <Text style={s.sheetContactText}>{lugar.endereco}</Text>
                    </View>
                  )}
                  {lugar.google_maps_url && (
                    <Pressable
                      style={s.sheetMapBtn}
                      onPress={() => Linking.openURL(lugar.google_maps_url!)}
                    >
                      <Feather name="map" size={16} color="#FFF" />
                      <Text style={s.sheetMapBtnText}>Ver no mapa</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  scroll: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
  },
  backBtnCenter: {
    marginTop: 20,
    backgroundColor: PETROL,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backBtnCenterText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#FFF",
  },

  // ═══ HERO ═══
  heroContainer: {
    width: W,
    height: H * 0.48,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 16,
    zIndex: 10,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 20,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    gap: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  backBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: PETROL,
  },
  saveBtnContainer: {
    position: "absolute",
    right: 16,
    zIndex: 10,
  },
  saveBtn: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  saveBtnActive: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderColor: "transparent",
  },
  saveBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "#FFF",
  },
  saveBtnTextActive: {
    color: PETROL,
  },
  heroContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  pillsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 5,
  },
  pillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: "#FFF",
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: "#FFF",
    lineHeight: 38,
  },

  // ═══ METRICS ═══
  metricasRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  metricaItem: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 4,
  },
  metricaIconWrap: {
    marginBottom: 8,
  },
  metricaValor: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFF",
    marginBottom: 2,
    textAlign: "center",
  },
  metricaLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },

  // ═══ CONTENT ═══
  content: {
    padding: 20,
  },
  bodyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 24,
    marginBottom: 20,
  },
  saberMaisBtn: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: TEAL,
  },
  saberMaisText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: TEAL,
  },

  // ═══ BOTTOM SHEET ═══
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F5F5F5",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: H * 0.65,
    paddingTop: 12,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CCC",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#222",
  },
  sheetScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sheetText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#444",
    lineHeight: 22,
    marginBottom: 24,
  },
  sheetList: {
    gap: 20,
  },
  sheetListItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  sheetIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetContent: {
    flex: 1,
  },
  sheetLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: TEAL,
    marginBottom: 2,
  },
  sheetValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  sheetContact: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  sheetContactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 16,
  },
  sheetContactText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  sheetMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PETROL,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 10,
  },
  sheetMapBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFF",
  },
});
