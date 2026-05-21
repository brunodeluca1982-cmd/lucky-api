import React, { memo, useCallback, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useDestinos } from "@/hooks/useDestinos";
import { RotatingBackground } from "@/components/RotatingBackground";
import { useRioHeroMedia } from "@/hooks/useHeroMedia";
import { useDestinoFoto } from "@/hooks/useDestinoFotos";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const H_PAD = 14;
const GAP = 8;
const COLS = 3;
const CARD_W = (SCREEN_WIDTH - H_PAD * 2 - GAP * (COLS - 1)) / COLS;
const CARD_H = Math.round(CARD_W * 1.18);

const SELECTED_ID = "rio-de-janeiro";

// ── Memoized card: uses bucket photos with fallback ──────────────────────────
interface DestCardProps {
  id: string;
  slug: string;
  cidade: string;
  pais: string;
  fallbackImage: ImageSourcePropType;
  selected: boolean;
  lancado: boolean;
}

const DestCard = memo(function DestCard({
  id,
  slug,
  cidade,
  pais,
  fallbackImage,
  selected,
  lancado,
}: DestCardProps) {
  // Busca foto do bucket media/{slug}/hero/foto/ com fallbacks
  const { foto, isPlaceholder } = useDestinoFoto(slug);

  // Stable handler — created once per card id, never recreated on parent re-render
  const handlePress = useCallback(() => {
    router.push({ pathname: "/cidade/[id]", params: { id } });
  }, [id]);

  // Determina a fonte da imagem
  const imageSource: ImageSourcePropType = foto
    ? { uri: foto }
    : fallbackImage;

  return (
    <Pressable
      key={id}
      onPress={handlePress}
      style={({ pressed }) => [
        s.card,
        selected && s.cardSelected,
        !lancado && s.cardComingSoon,
        pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
      ]}
    >
      {/* Image from bucket or fallback */}
      {isPlaceholder && !fallbackImage ? (
        <View style={[s.cardImage, s.placeholderBg]}>
          <Text style={s.placeholderText}>{cidade}</Text>
        </View>
      ) : (
        <Image
          source={imageSource}
          style={[s.cardImage, !lancado && { opacity: 0.72 }]}
          resizeMode="cover"
        />
      )}

      {/* Bottom-anchored gradient — does NOT obscure the image on load */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.20)", "rgba(0,0,0,0.82)"]}
        locations={[0.25, 0.55, 1]}
        style={s.cardGradient}
      />

      {/* Selected checkmark badge */}
      {selected && (
        <View style={s.checkBadge}>
          <Feather name="check" size={10} color="#000000" />
        </View>
      )}

      {/* Em breve badge */}
      {!lancado && (
        <View style={s.comingSoonBadge}>
          <Text style={s.comingSoonText}>Em breve</Text>
        </View>
      )}

      {/* Labels */}
      <View style={s.cardInfo}>
        <Text style={s.cardCidade} numberOfLines={1}>
          {cidade}
        </Text>
        <Text style={s.cardPais} numberOfLines={1}>
          {pais}
        </Text>
      </View>
    </Pressable>
  );
});

// ── Screen ─────────────────────────────────────────────────────────────────────
// Background com fotos do Rio em loop desfocado (igual home)
const RIO_BG_PHOTOS = [
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg" },
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero02.jpg" },
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero03.jpg" },
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero04.jpg" },
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero05.jpg" },
];
const DESTINOS_BG_POOL = RIO_BG_PHOTOS;

export default function DestinosScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top + 12;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const rioHero = useRioHeroMedia("image");

  const { destinos, loading } = useDestinos();
  const [query, setQuery] = React.useState("");

  const filtered = query.trim()
    ? destinos.filter(
        (d) =>
          d.cidade.toLowerCase().includes(query.toLowerCase()) ||
          d.pais.toLowerCase().includes(query.toLowerCase())
      )
    : destinos;

  const rows: typeof filtered[] = [];
  for (let i = 0; i < filtered.length; i += COLS) {
    rows.push(filtered.slice(i, i + COLS));
  }

  return (
    <View style={s.root}>
      {/* Full-screen atmospheric background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <RotatingBackground
          pool={rioHero && rioHero.length > 0
            ? rioHero.map((item) => ({ uri: item.public_url }))
            : DESTINOS_BG_POOL}
          interval={15000}
          blurRadius={0}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.74)", "rgba(0,0,0,0.66)", "rgba(0,0,0,0.86)"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.scroll,
          { paddingTop: topPad + 8, paddingBottom: bottomPad + 96 },
        ]}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.title}>Vai pra onde?</Text>
            <Text style={s.subtitle}>
              Descubra lugares autênticos vividos pelo Bruno
            </Text>
          </View>
          <View style={s.headerRight}>
            <Pressable style={s.iconBtn} hitSlop={8}>
              <Feather name="music" size={18} color="#FFF" />
            </Pressable>
            <Pressable style={s.iconBtn} hitSlop={8}>
              <Feather name="play" size={16} color="#FFF" />
            </Pressable>
          </View>
        </View>

        {/* Search bar */}
        <View style={s.searchWrap}>
          <Feather name="search" size={16} color="rgba(255,255,255,0.50)" />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar cidade, país..."
            placeholderTextColor="rgba(255,255,255,0.38)"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x" size={15} color="rgba(255,255,255,0.45)" />
            </Pressable>
          )}
        </View>

        {/* 3-column grid */}
        {loading && destinos.length === 0 ? (
          <ActivityIndicator color="rgba(27,79,114,0.7)" style={{ marginTop: 40 }} />
        ) : rows.length > 0 ? (
          <View style={s.grid}>
            {rows.map((row, ri) => (
              <View key={ri} style={s.row}>
                {row.map((d) => (
                  <DestCard
                    key={d.id}
                    id={d.id}
                    slug={d.id}
                    cidade={d.cidade}
                    pais={d.pais}
                    fallbackImage={d.image}
                    selected={d.id === SELECTED_ID}
                    lancado={d.lancado}
                  />
                ))}
                {/* Fill trailing empty slots */}
                {row.length < COLS &&
                  Array.from({ length: COLS - row.length }).map((_, i) => (
                    <View key={`fill-${i}`} style={{ width: CARD_W }} />
                  ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={s.empty}>
            <Feather name="map-pin" size={28} color="rgba(255,255,255,0.30)" />
            <Text style={s.emptyText}>Nenhum destino encontrado</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  bgImage: {
    width: "100%",
    height: "100%",
    opacity: 0.55,
  },
  scroll: {
    paddingHorizontal: H_PAD,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 16,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: "#FFFFFF",
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.58)",
    lineHeight: 19,
  },
  headerRight: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.11)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#FFFFFF",
    padding: 0,
  },

  // Grid
  grid: {
    gap: GAP,
  },
  row: {
    flexDirection: "row",
    gap: GAP,
  },

  // Card — mirrors DestinationCard.tsx pattern exactly
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  placeholderBg: {
    backgroundColor: "#D4C5A9",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 11,
    color: "#4A4844",
    textAlign: "center",
    paddingHorizontal: 6,
  },
  // Bottom-anchored: image top half is never covered
  cardGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "70%",
  },
  checkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 9,
    paddingBottom: 10,
    gap: 2,
  },
  cardCidade: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 12,
    color: "#FFFFFF",
    lineHeight: 16,
    letterSpacing: -0.1,
  },
  cardPais: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.68)",
    lineHeight: 14,
  },

  // Coming soon card variant
  cardComingSoon: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  comingSoonBadge: {
    position: "absolute",
    top: 7,
    left: 7,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  comingSoonText: {
    fontFamily: "Inter_400Regular",
    fontSize: 8.5,
    color: "rgba(255,255,255,0.72)",
    letterSpacing: 0.4,
  },

  // Empty state
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.40)",
  },
});
