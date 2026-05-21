// app/amigo/all.tsx — Lista de todos os Amigos The Lucky
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
import { router, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";

const { width: W } = Dimensions.get("window");
const PETROL = "#1B4F72";
const SUPABASE = "https://bkwlximkadmlnbgjcrdp.supabase.co";
const FALLBACK = `${SUPABASE}/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg`;

type Amigo = {
  id: string;
  slug: string;
  nome: string;
  tagline: string;
  foto_url: string;
  pais_bandeira: string;
};

// Fallback data
const AMIGOS_FALLBACK: Amigo[] = [
  { id: "1", slug: "carolina-dieckmann", nome: "Carolina Dieckmann", tagline: "Atriz e embaixadora do Rio", foto_url: `${SUPABASE}/storage/v1/object/public/media/amigos/carolina-dieckmmann/hero/foto/carolina1.jpg`, pais_bandeira: "🇧🇷" },
  { id: "2", slug: "isabeli-fontana", nome: "Isabeli Fontana", tagline: "Top model internacional", foto_url: `${SUPABASE}/storage/v1/object/public/media/amigos/isabeli-fontana/hero/foto/IMG_1411.jpg`, pais_bandeira: "🇧🇷" },
  { id: "3", slug: "ana-clara", nome: "Ana Clara Lima", tagline: "Apresentadora e influencer", foto_url: `${SUPABASE}/storage/v1/object/public/media/amigos/ana-clara-lima/hero/foto/IMG_1409.jpg`, pais_bandeira: "🇧🇷" },
  { id: "4", slug: "di-ferrero", nome: "Di Ferrero", tagline: "Cantor e compositor", foto_url: `${SUPABASE}/storage/v1/object/public/media/amigos/di-ferrero/hero/foto/IMG_1408.jpg`, pais_bandeira: "🇧🇷" },
  { id: "5", slug: "celina-locks", nome: "Celina Locks", tagline: "Modelo e empresária", foto_url: `${SUPABASE}/storage/v1/object/public/media/amigos/celina-locks/hero/foto/celina1.jpg`, pais_bandeira: "🇧🇷" },
];

export default function AmigosAllScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 0 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const [amigos, setAmigos] = useState<Amigo[]>(AMIGOS_FALLBACK);

  useEffect(() => {
    supabase
      .from("amigos")
      .select("id, slug, nome, bio_curta, foto_url")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => {
        if (data && data.length > 0) {
          // Mapear campos da tabela amigos para o formato esperado
          const mapped = data.map((a: any) => ({
            id: a.id,
            slug: a.slug,
            nome: a.nome,
            tagline: a.bio_curta || "",
            foto_url: a.foto_url || "",
            pais_bandeira: "🇧🇷",
          }));
          setAmigos(mapped as Amigo[]);
        }
      });
  }, []);

  const getImageUrl = (url: string) => {
    if (!url) return FALLBACK;
    if (url.startsWith("http")) return url;
    return `${SUPABASE}/storage/v1/object/public/media/${url}`;
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Amigos The Lucky</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Lista */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {amigos.map((amigo) => (
            <Pressable
              key={amigo.id}
              style={styles.card}
              onPress={() => router.push(`/amigo/${amigo.slug}`)}
            >
              <Image
                source={{ uri: getImageUrl(amigo.foto_url) }}
                style={styles.cardImage}
              />
              <View style={styles.cardOverlay} />
              <View style={styles.cardContent}>
                <View style={styles.flagBadge}>
                  <Text style={styles.flag}>{amigo.pais_bandeira || "🇧🇷"}</Text>
                </View>
                <Text style={styles.cardName}>{amigo.nome}</Text>
                <Text style={styles.cardTagline} numberOfLines={1}>
                  {amigo.tagline}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const CARD_WIDTH = (W - 48) / 2;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#FFF",
  },
  scroll: {
    flex: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 16,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.3,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  cardContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  flagBadge: {
    position: "absolute",
    top: -40,
    left: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  flag: {
    fontSize: 14,
  },
  cardName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFF",
    marginBottom: 2,
  },
  cardTagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
});
