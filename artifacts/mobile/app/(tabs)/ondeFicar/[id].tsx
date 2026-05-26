/**
 * ondeFicar/[id].tsx — "Onde ficar" premium editorial v3
 *
 * Proporções calibradas para caber na tela sem scroll:
 *   Hero  ≈ 28% da tela  (~236px em iPhone 14)
 *   Map   ≈ fixo pelo OndeFicarMap (~280px)
 *   Card  ≈ flex 1 restante (~228px → CTA visível)
 *
 * OndeFicarMap NUNCA dentro de ScrollView.
 */

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useBairros, type Bairro } from "@/hooks/useBairros";
import OndeFicarMap, { MAP_H as MAP_INNER_H } from "@/components/OndeFicarMap";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const PETROL    = "#1B4F72";
const PETROL_LT = "rgba(27,79,114,0.10)";
const GOLD      = "#BF9B5C";
const BG_DARK   = "#060810";
const CARD_BG   = "#FFFFFF";
const DARK_TEXT = "#141414";
const MID_TEXT  = "#6B6B6B";

// Hero height: deixa espaço suficiente para card ficar visível
const HERO_H = Math.round(SCREEN_H * 0.28);

const RIO_ID = "7f047742-427f-4b11-8286-781af899c57d";
const FALLBACK =
  "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg";

// ─── Zona ────────────────────────────────────────────────────────────────────

const SUL   = ["Ipanema","Leblon","Copacabana","Botafogo","Flamengo","Laranjeiras","Gávea","Lagoa","Jardim Botânico","Arpoador","Urca","Leme","Humaitá","Catete","Glória","São Conrado","Joá","Vidigal"];
const NORTE = ["Tijuca","Vila Isabel","Maracanã","São Cristóvão","Méier","Penha","Ramos"];
const OESTE = ["Barra da Tijuca","Recreio dos Bandeirantes","Recreio","Jacarepaguá","Vargem Grande"];
const CTR   = ["Centro","Lapa","Santa Teresa","Praça Mauá","Caju"];

function zona(nome: string) {
  if (SUL.includes(nome))   return "ZONA SUL";
  if (NORTE.includes(nome)) return "ZONA NORTE";
  if (OESTE.includes(nome)) return "ZONA OESTE";
  if (CTR.includes(nome))   return "CENTRO";
  return "RIO DE JANEIRO";
}

// ─── Tags com ícones ──────────────────────────────────────────────────────────

interface Tag {
  label: string;
  icon: React.ReactNode;
  iconSmall: React.ReactNode; // menor, para o card
}

function buildTags(b: Bairro): Tag[] {
  const tags: Tag[] = [];
  if (b.gastronomia === "excelente" || b.gastronomia === "boa")
    tags.push({
      label: "Gastronomia",
      icon: <MaterialCommunityIcons name="silverware-fork-knife" size={14} color="#FFF" />,
      iconSmall: <MaterialCommunityIcons name="silverware-fork-knife" size={18} color={PETROL} />,
    });
  if (b.caminhavel === "muito" || b.caminhavel === "razoavel")
    tags.push({
      label: "Caminhável",
      icon: <MaterialCommunityIcons name="walk" size={14} color="#FFF" />,
      iconSmall: <MaterialCommunityIcons name="walk" size={18} color={PETROL} />,
    });
  if (b.vida_noturna === "intensa" || b.vida_noturna === "moderada")
    tags.push({
      label: "Vida noturna",
      icon: <Feather name="moon" size={13} color="#FFF" />,
      iconSmall: <Feather name="moon" size={17} color={PETROL} />,
    });
  // fallbacks para bairros sem dados de lifestyle
  if (tags.length === 0) {
    tags.push(
      {
        label: "Curadoria Lucky",
        icon: <Feather name="star" size={13} color="#FFF" />,
        iconSmall: <Feather name="star" size={17} color={PETROL} />,
      },
      {
        label: "Rio de Janeiro",
        icon: <Feather name="map-pin" size={13} color="#FFF" />,
        iconSmall: <Feather name="map-pin" size={17} color={PETROL} />,
      },
    );
  }
  return tags;
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

export default function OndeFicarScreen() {
  useLocalSearchParams<{ id: string }>();
  const insets      = useSafeAreaInsets();
  const topInset    = Platform.OS === "web" ? 0 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const { bairros, loading } = useBairros(RIO_ID);
  const [selected, setSelected] = useState<Bairro | null>(null);
  const [hearted,  setHearted]  = useState<string | null>(null);

  const onPress = (name: string | null) => {
    if (!name) { setSelected(null); return; }
    setSelected(bairros.find((b) => b.nome === name) ?? null);
  };

  const goHotels  = () => selected && router.push(`/ondeFicar/bairro/${selected.slug}`);
  const shuffle   = () => {
    const pool = selected ? bairros.filter((b) => b.id !== selected.id) : bairros;
    if (pool.length) setSelected(pool[Math.floor(Math.random() * pool.length)]);
  };

  const tags    = useMemo(() => selected ? buildTags(selected) : [], [selected]);
  const zLabel  = selected ? zona(selected.nome) : "RIO DE JANEIRO";
  const heroUri = selected?.hero_image_url ?? FALLBACK;
  const descTxt = selected?.descricao_curta || selected?.identidade || "";

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ═══════════════════ HERO ═══════════════════════════════════════════ */}
      <View style={[s.hero, { height: HERO_H }]}>

        <ExpoImage
          source={{ uri: heroUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={400}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.88)"]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Botões topo */}
        <View style={[s.topRow, { paddingTop: topInset + 8 }]}>
          <Pressable style={s.circleBtn} onPress={() => router.back()} hitSlop={10}>
            <Feather name="chevron-left" size={20} color="#FFF" />
          </Pressable>
          <View style={s.topRight}>
            <Pressable style={s.circleBtn} hitSlop={10}>
              <Ionicons name="musical-notes-outline" size={16} color="#FFF" />
            </Pressable>
            <Pressable style={s.circleBtn} hitSlop={10}>
              <Feather name="play" size={16} color="#FFF" />
            </Pressable>
          </View>
        </View>

        {/* Conteúdo textual — ancorado na base do hero */}
        <View style={s.heroContent}>
          <Text style={s.zonaLabel} numberOfLines={1}>{zLabel}</Text>

          <Text style={s.heroName} numberOfLines={2}>
            {selected ? selected.nome : "Onde Ficar"}
          </Text>

          {descTxt ? (
            <Text style={s.heroDesc} numberOfLines={2}>{descTxt}</Text>
          ) : !selected ? (
            <Text style={s.heroDesc}>
              Toque em um bairro no mapa para ver as melhores opções de hospedagem.
            </Text>
          ) : null}

          {/* Pills de feature — só se tiver espaço (hero suficientemente alto) */}
          {selected && tags.length > 0 && HERO_H >= 250 && (
            <View style={s.pillRow}>
              {tags.slice(0, 3).map((t) => (
                <View key={t.label} style={s.pill}>
                  {t.icon}
                  <Text style={s.pillTxt}>{t.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* ═══════════════════ MAP (NUNCA dentro de ScrollView) ════════════ */}
      <View style={s.mapWrap}>
        {loading ? (
          <View style={[{ height: MAP_INNER_H }, s.mapLoading]}>
            <ActivityIndicator size="large" color="rgba(255,255,255,0.4)" />
          </View>
        ) : (
          <OndeFicarMap
            selectedNeighborhood={selected?.nome ?? null}
            onNeighborhoodPress={onPress}
            topInset={0}
          />
        )}
      </View>

      {/* ═══════════════════ CARD / EMPTY ════════════════════════════════ */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: bottomInset + 12 }]}
        showsVerticalScrollIndicator={false}
        bounces={selected !== null}
      >
        {selected ? (
          <>
            {/* Card principal */}
            <View style={s.card}>

              {/* Foto lateral */}
              <ExpoImage
                source={{ uri: selected.hero_image_url ?? FALLBACK }}
                style={s.cardPhoto}
                contentFit="cover"
              />

              {/* Corpo */}
              <View style={s.cardBody}>

                {/* Badge + coração */}
                <View style={s.badgeRow}>
                  <View style={s.badge}>
                    <Text style={s.badgeTxt}>EM DESTAQUE</Text>
                  </View>
                  <Pressable
                    hitSlop={14}
                    onPress={() => setHearted(hearted === selected.id ? null : selected.id)}
                  >
                    <Feather
                      name={hearted === selected.id ? "heart" : "heart"}
                      size={19}
                      color={hearted === selected.id ? "#E53935" : "#C8C8C8"}
                    />
                  </Pressable>
                </View>

                {/* Nome */}
                <Text style={s.cardName} numberOfLines={1}>{selected.nome}</Text>

                {/* Descrição */}
                {descTxt ? (
                  <Text style={s.cardDesc} numberOfLines={3}>{descTxt}</Text>
                ) : null}

                {/* Ícones de feature */}
                {tags.length > 0 && (
                  <View style={s.featureRow}>
                    {tags.slice(0, 3).map((t) => (
                      <View key={t.label} style={s.featureItem}>
                        {t.iconSmall}
                        <Text style={s.featureLbl}>{t.label}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* CTA */}
                <Pressable style={s.ctaBtn} onPress={goHotels}>
                  <Text style={s.ctaTxt}>Ver hotéis no {selected.nome}{"  →"}</Text>
                </Pressable>

              </View>
            </View>

            {/* Explorar outros bairros */}
            <Pressable style={s.exploreRow} onPress={shuffle}>
              <Feather name="compass" size={14} color={PETROL} />
              <Text style={s.exploreTxt}>Explorar outros bairros</Text>
              <Feather name="chevron-right" size={14} color={PETROL} />
            </Pressable>
          </>
        ) : (
          /* Estado vazio */
          <View style={s.empty}>
            <Feather name="map-pin" size={22} color="rgba(255,255,255,0.25)" />
            <Text style={s.emptyTitle}>Escolha um bairro no mapa</Text>
            <Text style={s.emptyBody}>
              Toque em qualquer ponto para ver hospedagens curadas.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PHOTO_W = Math.round(SCREEN_W * 0.28); // ~109px em 390px

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_DARK,
  },

  /* ── Hero ── */
  hero: {
    width: "100%",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  topRight: { flexDirection: "row", gap: 10 },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 4,
  },
  zonaLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 2.4,
    color: GOLD,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  heroName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 38,
    color: "#FFFFFF",
    lineHeight: 44,
  },
  heroDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.72)",
    lineHeight: 20,
    marginTop: 2,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
  },
  pillTxt: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "#FFFFFF",
  },

  /* ── Map ── */
  mapWrap: {
    width: "100%",
    backgroundColor: "#060810",
    overflow: "hidden",
  },
  mapLoading: {
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Scroll ── */
  scroll: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },

  /* ── Card ── */
  card: {
    flexDirection: "row",
    backgroundColor: CARD_BG,
    borderRadius: 18,
    overflow: "hidden",
    // shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  cardPhoto: {
    width: PHOTO_W,
    height: 190,
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  badge: {
    backgroundColor: PETROL_LT,
    borderRadius: 100,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1.2,
    color: PETROL,
  },

  cardName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 21,
    color: DARK_TEXT,
    lineHeight: 27,
  },
  cardDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: MID_TEXT,
    lineHeight: 17,
  },

  featureRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 6,
  },
  featureItem: {
    alignItems: "center",
    gap: 4,
  },
  featureLbl: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: MID_TEXT,
    textAlign: "center",
  },

  ctaBtn: {
    marginTop: 8,
    backgroundColor: PETROL,
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },

  /* ── Explorar ── */
  exploreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 2,
  },
  exploreTxt: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: PETROL,
  },

  /* ── Empty ── */
  empty: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 18,
    color: "#FFFFFF",
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    maxWidth: 230,
    lineHeight: 19,
  },
});