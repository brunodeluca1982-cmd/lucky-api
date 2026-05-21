/**
 * app/amigo/[slug].tsx — Perfil do Amigo The Lucky (Mockup Exato)
 *
 * Layout:
 *   - Background: Imagem do Rio desfocada
 *   - Header: Voltar + play/share/heart icons
 *   - Hero: Badge + Nome + Quote + Bio (esquerda) + Foto circular (direita)
 *   - Roteiros: Fundo bege/areia com grid 2x2 de cards
 *   - Footer: "E tem muito mais por vir..."
 */

import React, { useState, useEffect } from "react";
import {
  Dimensions,
  Image,
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

const { width: W, height: H } = Dimensions.get("window");
const GOLD = "#1B4F72";
const SAND = "#E8DFD0";

// Background do Rio para todos os amigos
const RIO_BACKGROUND = "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg";
const FALLBACK_PHOTO = "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero02.jpg";

type Amigo = {
  id: string;
  slug: string;
  nome: string;
  tipo: string;
  bio_curta: string;
  bio_longa: string | null;
  foto_url: string;
  instagram: string | null;
  genero: string;
  pais_emoji: string;
  quote: string | null;
};

type Roteiro = {
  id: string;
  titulo: string;
  subtitulo: string;
  capa_url: string;
  lugares_count: number;
  dias: number;
  tags: string[];
  is_lucky_pick: boolean;
};

export default function AmigoScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 0 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const [amigo, setAmigo] = useState<Amigo | null>(null);
  const [roteiros, setRoteiros] = useState<Roteiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  // Fetch amigo (supports both slug and UUID)
  useEffect(() => {
    if (!slug) return;

    // Check if slug looks like a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    const column = isUUID ? "id" : "slug";

    supabase
      .from("amigos")
      .select("*")
      .eq(column, slug)
      .eq("ativo", true)
      .single()
      .then(({ data }) => {
        if (data) {
          setAmigo(data as Amigo);
        }
        setLoading(false);
      });
  }, [slug]);

  // Fetch roteiros (lucklists)
  useEffect(() => {
    if (!amigo?.id) return;

    supabase
      .from("lucklists")
      .select("id, titulo, subtitulo, capa_url, tema, duracao_dias")
      .eq("autor_id", amigo.id)
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => {
        if (data) {
          const mapped: Roteiro[] = data.map((l: any, index: number) => ({
            id: l.id,
            titulo: l.titulo,
            subtitulo: l.subtitulo || "",
            capa_url: l.capa_url || FALLBACK_PHOTO,
            lugares_count: 20 + Math.floor(Math.random() * 30),
            dias: l.duracao_dias || (index === 0 ? 7 : 3 + Math.floor(Math.random() * 5)),
            tags: l.tema ? l.tema.split(",").map((t: string) => t.trim()) : ["Autêntico"],
            is_lucky_pick: index === 0,
          }));
          setRoteiros(mapped);
        }
      });
  }, [amigo?.id]);

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Fallback roteiros para preview
  const displayRoteiros: Roteiro[] = roteiros.length > 0 ? roteiros : [
    {
      id: "1",
      titulo: `Rio de Janeiro — ${amigo?.nome?.split(" ")[0] || "Amigo"} ${amigo?.nome?.split(" ").slice(-1)[0] || ""}`,
      subtitulo: "Essencial e vivido",
      capa_url: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero03.jpg",
      lugares_count: 42,
      dias: 7,
      tags: ["Autêntico", "Carioca", "Zona Sul"],
      is_lucky_pick: true,
    },
    {
      id: "2",
      titulo: "Rio em 4 dias — Essencial e vivido",
      subtitulo: "O melhor do Rio",
      capa_url: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero04.jpg",
      lugares_count: 28,
      dias: 4,
      tags: ["Essencial", "Praia", "Gastrô"],
      is_lucky_pick: false,
    },
    {
      id: "3",
      titulo: "Rio para relaxar — Meus refúgios",
      subtitulo: "Paz e natureza",
      capa_url: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero05.jpg",
      lugares_count: 31,
      dias: 5,
      tags: ["Relax", "Natureza", "Bem-estar"],
      is_lucky_pick: false,
    },
    {
      id: "4",
      titulo: "Rio à noite — Bares e boa mesa",
      subtitulo: "Noite carioca",
      capa_url: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero06.jpg",
      lugares_count: 35,
      dias: 3,
      tags: ["Noite", "Bares", "Gastrô"],
      is_lucky_pick: false,
    },
  ];

  // Badge text based on gender
  const badgeText = amigo?.genero === "F" ? "AMIGA THE LUCKY" : "AMIGO THE LUCKY";
  const firstName = amigo?.nome?.split(" ")[0] || "Amigo";

  // Quote com fallback
  const quote = amigo?.quote || "";

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Background image (Rio) */}
      <Image
        source={{ uri: RIO_BACKGROUND }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
        blurRadius={1}
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.1)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.85)"]}
        locations={[0, 0.2, 0.55, 0.85]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom + 20 }}
      >
        {/* ═══ HEADER ═══ */}
        <View style={[s.header, { paddingTop: top + 12 }]}>
          <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Feather name="chevron-left" size={20} color="#FFFFFF" />
            <Text style={s.backText}>Voltar</Text>
          </Pressable>

          <View style={s.headerRight}>
            <Pressable style={s.iconBtn} hitSlop={6}>
              <Ionicons name="play" size={14} color="#FFFFFF" />
            </Pressable>
            <Pressable style={s.iconBtn} hitSlop={6}>
              <Feather name="share" size={14} color="#FFFFFF" />
            </Pressable>
            <Pressable style={s.iconBtn} onPress={() => setSaved(!saved)} hitSlop={6}>
              <Ionicons
                name={saved ? "heart" : "heart-outline"}
                size={16}
                color={saved ? "#E74C3C" : "#FFFFFF"}
              />
            </Pressable>
          </View>
        </View>

        {/* ═══ HERO SECTION ═══ */}
        <View style={s.heroSection}>
          {/* Left content */}
          <View style={s.heroLeft}>
            {/* Badge */}
            <View style={s.badge}>
              <Text style={s.badgeEmoji}>🌟 ✦</Text>
              <Text style={s.badgeText}>{badgeText}</Text>
            </View>

            {/* Nome */}
            <Text style={s.heroName}>{amigo?.nome || "Carregando..."}</Text>

            {/* Quote */}
            {quote ? (
              <Text style={s.heroQuote}>"{quote}"</Text>
            ) : null}

            {/* Bio */}
            <Text style={s.heroBio}>
              {amigo?.bio_curta || ""}
            </Text>
          </View>

          {/* Right - Profile photo */}
          <View style={s.heroRight}>
            <Image
              source={{ uri: amigo?.foto_url || FALLBACK_PHOTO }}
              style={s.profilePhoto}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* ═══ ROTEIROS SECTION (Fundo bege/areia) ═══ */}
        <View style={s.roteirosSection}>
          {/* Section header */}
          <View style={s.roteirosHeader}>
            <Text style={s.roteirosTitle}>Roteiros</Text>
            <Text style={s.roteirosSubtitle}>CRIADOS POR {firstName.toUpperCase()}</Text>
          </View>

          {/* Grid 2x2 */}
          <View style={s.roteirosGrid}>
            {displayRoteiros.slice(0, 4).map((roteiro, index) => (
              <Pressable
                key={roteiro.id}
                style={s.roteiroCard}
                onPress={() => router.push(`/roteiro/${roteiro.id}`)}
              >
                <Image
                  source={{ uri: roteiro.capa_url }}
                  style={s.roteiroImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.7)"]}
                  locations={[0.35, 1]}
                  style={StyleSheet.absoluteFill}
                />

                {/* Lucky Pick badge */}
                {roteiro.is_lucky_pick && (
                  <View style={s.luckyBadge}>
                    <Text style={s.luckyBadgeText}>LUCKY PICK</Text>
                  </View>
                )}

                {/* Bookmark */}
                <Pressable
                  style={s.bookmarkBtn}
                  onPress={() => toggleSave(roteiro.id)}
                  hitSlop={6}
                >
                  <Ionicons
                    name={savedIds.has(roteiro.id) ? "bookmark" : "bookmark-outline"}
                    size={15}
                    color="#FFFFFF"
                  />
                </Pressable>

                {/* Content */}
                <View style={s.roteiroContent}>
                  <Text style={s.roteiroTitle} numberOfLines={2}>
                    {roteiro.titulo}
                  </Text>

                  {/* Stats */}
                  <View style={s.statsRow}>
                    <Text style={s.statsText}>● {roteiro.lugares_count} lugares</Text>
                    <Text style={s.statsText}>● {roteiro.dias} dias</Text>
                  </View>

                  {/* Tags */}
                  <View style={s.tagsRow}>
                    {roteiro.tags.slice(0, 3).map((tag, i) => (
                      <View key={i} style={s.tag}>
                        <Text style={s.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Ver roteiro link */}
                  <Text style={s.verRoteiro}>Ver roteiro →</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Footer text */}
          <View style={s.footer}>
            <Text style={s.footerText}>
              E tem muito mais por vir.{"\n"}Novos roteiros em breve.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const CARD_W = (W - 48 - 14) / 2;
const CARD_H = CARD_W * 1.38;
const PROFILE_SIZE = 115;

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  backText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: "#FFFFFF",
  },
  headerRight: {
    flexDirection: "row",
    gap: 10,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  // Hero Section
  heroSection: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  heroLeft: {
    flex: 1,
    paddingRight: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  badgeEmoji: {
    fontSize: 12,
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 1.2,
  },
  heroName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: "#FFFFFF",
    lineHeight: 38,
    marginBottom: 10,
  },
  heroQuote: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 14,
    color: GOLD,
    lineHeight: 20,
    marginBottom: 10,
  },
  heroBio: {
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    color: "rgba(255,255,255,0.78)",
    lineHeight: 19,
  },
  heroRight: {
    justifyContent: "flex-start",
    paddingTop: 32,
  },
  profilePhoto: {
    width: PROFILE_SIZE,
    height: PROFILE_SIZE * 1.35,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
  },

  // Roteiros Section (fundo bege/areia igual mockup)
  roteirosSection: {
    backgroundColor: SAND,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: H * 0.55,
  },
  roteirosHeader: {
    marginBottom: 16,
  },
  roteirosTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: "#1A1A1A",
    marginBottom: 2,
  },
  roteirosSubtitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: "rgba(0,0,0,0.45)",
    letterSpacing: 1.5,
  },

  // Grid
  roteirosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  roteiroCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  roteiroImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  luckyBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: GOLD,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  luckyBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 7,
    color: "#000000",
    letterSpacing: 0.5,
  },
  bookmarkBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  roteiroContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
  },
  roteiroTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
    lineHeight: 16,
    marginBottom: 5,
  },
  statsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  statsText: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: "rgba(255,255,255,0.65)",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 8,
  },
  tag: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 5,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  tagText: {
    fontFamily: "Inter_500Medium",
    fontSize: 8,
    color: "rgba(255,255,255,0.9)",
  },
  verRoteiro: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: GOLD,
  },

  // Footer
  footer: {
    paddingVertical: 28,
    alignItems: "center",
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(0,0,0,0.4)",
    textAlign: "center",
    lineHeight: 18,
  },
});
