// cidade/[id].tsx — EXACT copy of reference image
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  ImageSourcePropType,
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
import { supabase } from "@/lib/supabase";
import { useDestinoFotos } from "@/hooks/useDestinoFotos";
import { useDestaquesDestino, type DestaqueDestino } from "@/hooks/useDestaquesDestino";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PETROL_BLUE = "#1B4F72";
const SAND = "#F5F0E8";
const GLASS_BG = "rgba(20,20,20,0.35)";
const SAND_BORDER = "rgba(232,220,200,0.35)"; // Tom areia para bordas

// Status type for screen states
type ScreenStatus = "loading" | "not_found" | "success";

// Hero carousel - 13s interval, 400ms fade
const CROSSFADE_DURATION = 400;
const ROTATION_INTERVAL = 13000;

// Navigation helper - routes to proper entity page based on categoria
function getEntityRoute(destaque: DestaqueDestino, citySlug: string): { pathname: string; params: Record<string, string> } | null {
  if (!destaque.entity_id || !destaque.lugar) return null;

  const { id, slug, categoria } = destaque.lugar;

  // Map categoria to route
  switch (categoria) {
    case "restaurante":
    case "bar":
      return { pathname: "/lugar/[cityId]/[placeId]", params: { cityId: citySlug, placeId: id, source_table: "lugares" } };
    case "atividade":
    case "praia":
    case "dica_secreta":
    case "compras":
      return { pathname: "/lugar/[cityId]/[placeId]", params: { cityId: citySlug, placeId: id, source_table: "lugares" } };
    case "hotel":
      return { pathname: "/hotel/[id]", params: { id } };
    default:
      return { pathname: "/lugar/[cityId]/[placeId]", params: { cityId: citySlug, placeId: id, source_table: "lugares" } };
  }
}

// ── Hero Background ───────────────────────────────────────────────────────────
function HeroBackground({ fotos, fallback }: { fotos: string[]; fallback: ImageSourcePropType }) {
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (fotos.length <= 1) return;
    const timer = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: CROSSFADE_DURATION, useNativeDriver: true }).start(() => {
        setIdx((i) => (i + 1) % fotos.length);
        fade.setValue(1);
      });
    }, ROTATION_INTERVAL);
    return () => clearInterval(timer);
  }, [fotos.length, idx]);

  if (fotos.length === 0) return <Image source={fallback} style={s.bgImg} resizeMode="cover" />;
  if (fotos.length === 1) return <Image source={{ uri: fotos[0] }} style={s.bgImg} resizeMode="cover" />;

  const next = (idx + 1) % fotos.length;
  return (
    <>
      <Image source={{ uri: fotos[next] }} style={s.bgImg} resizeMode="cover" />
      <Animated.Image source={{ uri: fotos[idx] }} style={[s.bgImg, { opacity: fade }]} resizeMode="cover" />
    </>
  );
}

// ── Destino type ──────────────────────────────────────────────────────────────
type DestinoData = {
  id: string;
  slug: string;
  nome: string;
  descricao_curta: string | null;
  hero_image_url: string | null;
  pais: string;
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CidadeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 20 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  // Buscar destino do Supabase pelo slug
  const [destino, setDestino] = useState<DestinoData | null>(null);
  const [status, setStatus] = useState<ScreenStatus>("loading");

  useEffect(() => {
    if (!id) {
      setStatus("not_found");
      return;
    }
    setStatus("loading");
    supabase
      .from("destinos")
      .select("id, slug, nome, descricao_curta, hero_image_url, pais")
      .eq("slug", id)
      .single()
      .then(({ data, error }) => {
        if (data) {
          setDestino(data);
          setStatus("success");
        } else {
          setStatus("not_found");
        }
      });
  }, [id]);

  // ══ TODOS OS HOOKS ANTES DOS EARLY RETURNS (Rules of Hooks) ══
  // Fotos do hero carousel usando slug do destino
  const { fotos, loading: loadingFotos } = useDestinoFotos(destino?.slug || id || "");
  // Destaques usando ID do destino (UUID)
  const { essencial, agora, loading: loadingDestaques } = useDestaquesDestino(destino?.id || "");
  const [dotIdx, setDotIdx] = useState(0);

  useEffect(() => {
    if (fotos.length <= 1) return;
    const t = setInterval(() => setDotIdx((i) => (i + 1) % fotos.length), ROTATION_INTERVAL);
    return () => clearInterval(t);
  }, [fotos.length]);

  // ── LOADING STATE ──
  if (status === "loading") {
    return (
      <View style={s.stateScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={s.stateText}>Buscando destino...</Text>
      </View>
    );
  }

  // ── NOT FOUND STATE ──
  if (status === "not_found") {
    return (
      <View style={s.stateScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.stateContent}>
          <Text style={s.stateHeadline}>Esse destino ainda não está no Lucky Trip</Text>
          <Text style={s.stateSubtext}>Mas em breve a gente chega lá.</Text>
          <Pressable
            style={s.stateCta}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={s.stateCtaText}>Ver destinos disponíveis</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── SUCCESS STATE (destino exists) ──

  // Fallback image
  const fallbackImage = destino?.hero_image_url
    ? { uri: destino.hero_image_url }
    : require("@/assets/images/hero-rio.png");

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ══ FULLSCREEN HERO BACKGROUND ══ */}
      <View style={StyleSheet.absoluteFill}>
        <HeroBackground fotos={fotos} fallback={fallbackImage} />
        <LinearGradient
          colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.1)", "rgba(0,0,0,0.6)"]}
          locations={[0, 0.25, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* ══ TOP BAR ══ */}
      <View style={[s.topBar, { paddingTop: top + 8 }]}>
        <Pressable style={s.topBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={18} color="#fff" />
        </Pressable>
        <View style={s.topCenter}>
          <Image source={require("@/assets/images/logo_symbol_white.png")} style={s.logo} resizeMode="contain" />
          <View style={s.separator} />
        </View>
        <View style={s.topRight}>
          <Pressable style={s.topBtn}><Feather name="music" size={14} color="#fff" /></Pressable>
          <Pressable style={s.topBtn}><Feather name="play" size={14} color="#fff" /></Pressable>
        </View>
      </View>

      {/* ══ SCROLLABLE CONTENT ══ */}
      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: bottom + 90 }} showsVerticalScrollIndicator={false}>

        {/* ── Hero Text ── */}
        <View style={[s.heroText, { paddingTop: top + 60 }]}>
          <Text style={s.label}>DESTINO</Text>
          <Text style={s.title}>{destino?.nome || "Carregando..."}</Text>
          <Text style={s.subtitle}>{destino?.descricao_curta || ""}</Text>
          <Text style={s.country}>{destino?.pais?.toUpperCase() || ""}</Text>
          <View style={s.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[s.dot, dotIdx % 4 === i && s.dotActive]} />
            ))}
          </View>
        </View>

        {/* ── COMECE POR AQUI ── */}
        <View style={s.section}>
          <View style={s.glass}>
            <View style={s.header}>
              <View>
                <Text style={s.eyebrow}>COMECE POR AQUI</Text>
                <Text style={s.headerTitle}>O essencial de {destino?.nome || "..."}</Text>
              </View>
              <Pressable style={s.linkRow} onPress={() => router.push({ pathname: "/oQueFazer/categorias/[id]", params: { id: destino?.slug || id || "" } })}>
                <Text style={s.link}>Ver todos</Text>
                <Feather name="chevron-right" size={12} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
            <View style={s.cardsRow}>
              {essencial.map((item) => {
                const route = getEntityRoute(item, destino?.slug || id || "");
                return (
                  <Pressable
                    key={item.id}
                    style={s.card}
                    onPress={() => route && router.push(route as any)}
                  >
                    <Image source={{ uri: item.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={s.cardGrad} />
                    <Text style={s.cardText}>{item.titulo}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── AGORA NO DESTINO ── */}
        <View style={s.section}>
          <View style={s.glass}>
            <View style={s.header}>
              <View>
                <Text style={s.eyebrow}>AGORA EM {destino?.nome?.toUpperCase() || "..."}</Text>
                <Text style={s.headerSub}>Atualizado agora</Text>
              </View>
              <Pressable style={s.linkRow} onPress={() => router.push({ pathname: "/oQueFazer/categorias/[id]", params: { id: destino?.slug || id || "" } })}>
                <Text style={s.link}>Ver todos</Text>
                <Feather name="chevron-right" size={12} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cards}>
              {/* Weather - not clickable */}
              <View style={s.weather}>
                <View style={s.weatherRow}>
                  <Feather name="sun" size={22} color="#FFB800" />
                  <Text style={s.temp}>28°</Text>
                </View>
                <Text style={s.weatherLabel}>Ensolarado</Text>
                <Text style={s.weatherSub}>Sensação 30°</Text>
              </View>
              {/* Events - clickable, navigate to entity */}
              {agora.map((ev) => {
                const route = getEntityRoute(ev, destino?.slug || id || "");
                const cor = ev.cor || "#4CAF50";
                return (
                  <Pressable
                    key={ev.id}
                    style={s.eventCard}
                    onPress={() => route && router.push(route as any)}
                  >
                    <Image source={{ uri: ev.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={s.cardGrad} />
                    <View style={s.eventContent}>
                      <Text style={s.eventTitle}>{ev.titulo}</Text>
                      <View style={[s.chip, { backgroundColor: cor + "30" }]}>
                        <View style={[s.chipDot, { backgroundColor: cor }]} />
                        <Text style={[s.chipText, { color: cor }]}>{ev.horario}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* ── PLANEJE SUA VIAGEM ── */}
        <View style={s.section}>
          <View style={s.glass}>
            <Text style={s.eyebrow}>PLANEJE SUA VIAGEM</Text>
            <View style={s.planRow}>
              <Pressable style={s.planBtn} onPress={() => router.push({ pathname: "/ondeFicar/[id]", params: { id: destino?.slug || id || "" } })}>
                <View style={s.planIcon}><Feather name="moon" size={24} color="#fff" /></View>
                <Text style={s.planTitle} numberOfLines={2}>ONDE FICAR</Text>
                <Feather name="arrow-right" size={14} color="rgba(255,255,255,0.5)" style={{ marginTop: 8 }} />
              </Pressable>
              <Pressable style={s.planBtn} onPress={() => router.push({ pathname: "/comerBem/[id]", params: { id: destino?.slug || id || "" } })}>
                <View style={s.planIcon}><Feather name="coffee" size={24} color="#fff" /></View>
                <Text style={s.planTitle} numberOfLines={2}>ONDE COMER</Text>
                <Feather name="arrow-right" size={14} color="rgba(255,255,255,0.5)" style={{ marginTop: 8 }} />
              </Pressable>
              <Pressable style={s.planBtn} onPress={() => router.push({ pathname: "/oQueFazer/categorias/[id]", params: { id: destino?.slug || id || "" } })}>
                <View style={s.planIcon}><Feather name="compass" size={24} color="#fff" /></View>
                <Text style={s.planTitle} numberOfLines={2}>O QUE FAZER</Text>
                <Feather name="arrow-right" size={14} color="rgba(255,255,255,0.5)" style={{ marginTop: 8 }} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── LUCKY LIST ── */}
        <View style={s.section}>
          <Pressable style={s.lucky} onPress={() => router.push({ pathname: "/luckyList/[id]", params: { id: destino?.slug || id || "" } })}>
            <Text style={s.luckyStar}>✦</Text>
            <Text style={s.luckyTitle}>LUCKY LIST</Text>
            <Text style={s.luckyDesc} numberOfLines={1}>O que só os locais sabem</Text>
            <View style={s.luckyBtn}><Text style={s.luckyBtnText}>Ver seleção</Text></View>
          </Pressable>
        </View>

        {/* ── COMO CHEGAR ── */}
        <View style={s.section}>
          <Pressable style={s.comoChegar} onPress={() => router.push({ pathname: "/comoChegar/[cityId]", params: { cityId: destino?.slug || id || "" } })}>
            <View style={s.ccLeft}>
              <View style={s.ccIcon}><Ionicons name="airplane" size={16} color="rgba(255,255,255,0.8)" /></View>
              <View>
                <Text style={s.ccTitle}>COMO CHEGAR</Text>
                <Text style={s.ccSub}>Voos, aeroportos e acesso à cidade</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bgImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  scroll: { flex: 1 },

  // Top bar
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, zIndex: 10 },
  topBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  logo: { width: 28, height: 28 },
  topCenter: { flexDirection: "row", alignItems: "center" },
  separator: { width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.4)", marginLeft: 6 },
  topRight: { flexDirection: "row", gap: 10 },

  // Hero text
  heroText: { paddingHorizontal: 16, paddingBottom: 10 },
  label: { fontFamily: "Inter_500Medium", fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 2.5, marginBottom: 2, textAlign: "left" },
  title: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 36, color: "#fff", textAlign: "left", marginBottom: 4 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.7)", textAlign: "left", marginBottom: 4 },
  country: { fontFamily: "Inter_500Medium", fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 2, textAlign: "left", marginBottom: 8 },
  dots: { flexDirection: "row", gap: 5, alignSelf: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)" },
  dotActive: { width: 16, backgroundColor: "#fff" },

  // Sections
  section: { marginBottom: 8, paddingHorizontal: 14 },
  glass: { backgroundColor: GLASS_BG, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: SAND_BORDER },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  eyebrow: { fontFamily: "Inter_600SemiBold", fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 1.8, marginBottom: 2 },
  headerTitle: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 17, color: "#fff" },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  link: { fontFamily: "Inter_500Medium", fontSize: 11, color: "rgba(255,255,255,0.5)" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  cardsRow: { flexDirection: "row", justifyContent: "space-between" },
  cards: { gap: 10 },

  // Cards
  card: { width: 110, height: 110, borderRadius: 12, overflow: "hidden", backgroundColor: "#3a3632" },
  cardGrad: { position: "absolute", bottom: 0, left: 0, right: 0, height: 70 },
  cardText: { position: "absolute", bottom: 10, left: 10, right: 10, fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff", lineHeight: 16 },

  // Weather
  weather: { width: 80, height: 100, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 10, justifyContent: "center", borderWidth: 1, borderColor: SAND_BORDER },
  weatherRow: { flexDirection: "row", alignItems: "flex-start", gap: 2 },
  temp: { fontFamily: "Inter_600SemiBold", fontSize: 22, color: "#fff" },
  weatherLabel: { fontFamily: "Inter_500Medium", fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  weatherSub: { fontFamily: "Inter_400Regular", fontSize: 9, color: "rgba(255,255,255,0.4)" },

  // Event cards
  eventCard: { width: 110, height: 100, borderRadius: 14, overflow: "hidden", backgroundColor: "#3a3632" },
  eventContent: { position: "absolute", bottom: 8, left: 8, right: 8 },
  eventTitle: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#fff", lineHeight: 14, marginBottom: 4 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start" },
  chipDot: { width: 4, height: 4, borderRadius: 2 },
  chipText: { fontFamily: "Inter_500Medium", fontSize: 8 },

  // Planeje
  planRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  planBtn: { flex: 1, height: 110, maxHeight: 110, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  planIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  planTitle: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff", letterSpacing: 1.2, textAlign: "center", marginBottom: 4 },
  planSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.7)", textAlign: "center", lineHeight: 15 },

  // Lucky — fundo petrol blue sólido
  lucky: { backgroundColor: PETROL_BLUE, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  luckyStar: { fontSize: 16, color: "#fff", marginBottom: 6 },
  luckyTitle: { fontFamily: "Inter_700Bold", fontSize: 12, color: "#fff", letterSpacing: 1.5, marginBottom: 4 },
  luckyDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 17, marginBottom: 12 },
  luckyBtn: { backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, alignSelf: "flex-start" },
  luckyBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: PETROL_BLUE },

  // Como chegar
  comoChegar: { backgroundColor: GLASS_BG, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: SAND_BORDER },
  ccLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  ccIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  ccTitle: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "rgba(255,255,255,0.85)", letterSpacing: 1.2 },
  ccSub: { fontFamily: "Inter_400Regular", fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 1 },

  // State screens (loading / not_found)
  stateScreen: { flex: 1, backgroundColor: SAND, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  stateText: { fontFamily: "PlayfairDisplay_400Regular", fontSize: 18, color: PETROL_BLUE, opacity: 0.6 },
  stateContent: { alignItems: "center", gap: 12 },
  stateHeadline: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 24, color: PETROL_BLUE, textAlign: "center", lineHeight: 32 },
  stateSubtext: { fontFamily: "Inter_400Regular", fontSize: 15, color: PETROL_BLUE, opacity: 0.7, textAlign: "center" },
  stateCta: { marginTop: 24, backgroundColor: PETROL_BLUE, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  stateCtaText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
});
