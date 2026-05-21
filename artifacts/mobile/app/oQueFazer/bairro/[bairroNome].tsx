/**
 * oQueFazer/bairro/[bairroNome].tsx — Neighborhood activities page
 *
 * Layout:
 *   Hero → action buttons ("Ver X locais" + "Por dentro do bairro")
 *   [Collapsible editorial from Supabase neighborhoods]
 *   Filtered activities list (LUGARES_O_QUE_FAZER)
 *
 * URL params:
 *   bairroNome — neighborhood name (used to filter place.localizacao)
 *   cityId     — destination id
 */

import React, { useRef, useState } from "react";
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
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { destinos } from "@/data/mockData";
import { useNeighborhoods } from "@/hooks/useNeighborhoods";
import { useOQueFazer } from "@/hooks/useOQueFazer";
import { getNeighborhoodHero } from "@/utils/neighborhoodHero";
import { useGuia } from "@/context/GuiaContext";

const C = Colors.light;
const GOLD = "#1B4F72";
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const HERO_H = Math.round(SCREEN_HEIGHT * 0.46);
const CARD_IMAGE_H = 200;

function formatLevel(val: string): string {
  const m: Record<string, string> = {
    alto: "Alta", alta: "Alta", media: "Média", baixa: "Baixa", muito_alta: "Muito alta",
  };
  return m[val?.toLowerCase()] ?? val ?? "—";
}

export default function OQueFazerBairroScreen() {
  const { bairroNome, cityId } = useLocalSearchParams<{ bairroNome: string; cityId?: string }>();
  const insets    = useSafeAreaInsets();
  const topInset  = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const destino    = destinos.find((d) => d.id === (cityId ?? "rio")) ?? destinos[0];
  const { atividades, loading: lugaresLoading } = useOQueFazer();
  const FALLBACK_IMG = require("../../../assets/images/ipanema.png");
  const allLugares = (atividades ?? []).map((item: any) => ({
    id: item.id,
    titulo: item.nome,
    localizacao: item.bairro_nome ?? "",
    descricao: item.meu_olhar ?? "",
    categoria: item.categoria ?? "atividade",
    image: item.hero_image_url ? { uri: item.hero_image_url } : FALLBACK_IMG,
    preco: null,
  }));
  const filtered   = allLugares.filter((p: any) => p.localizacao === bairroNome);

  const { neighborhoods } = useNeighborhoods();
  const { save, unsave, isSaved } = useGuia();
  const supabaseNeighborhood = neighborhoods.find(
    (n) => n.neighborhood_name === bairroNome,
  ) ?? null;

  const heroImage = getNeighborhoodHero(
    supabaseNeighborhood?.image_url,
    bairroNome,
    destino.image,
  );

  const [editorialOpen, setEditorialOpen] = useState(false);

  const scrollRef    = useRef<ScrollView>(null);
  const listSectionY = useRef(0);

  const itemCount = filtered.length;

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Full-screen background (persists while scrolling) ── */}
      <Image
        source={heroImage}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.38)", "rgba(0,0,0,0.82)", "rgba(0,0,0,0.95)"]}
        locations={[0, 0.30, 0.54, 1.0]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 56 }}
      >
        {/* ── Hero ── */}
        <View style={[s.hero, { height: HERO_H }]}>
          <Pressable
            style={[s.backBtn, { top: topInset + 12 }]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Feather name="arrow-left" size={15} color="rgba(255,255,255,0.88)" />
            <Text style={s.backText}>Voltar</Text>
          </Pressable>

          <View style={s.heroContent}>
            <View style={s.categoryBadge}>
              <Text style={s.categoryText}>O QUE FAZER</Text>
            </View>
            <Text style={s.heroName}>{bairroNome}</Text>
            {supabaseNeighborhood?.identity_phrase ? (
              <Text style={s.heroPhrase}>{supabaseNeighborhood.identity_phrase}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={s.actionRow}>
          <Pressable
            style={s.actionPrimary}
            onPress={() =>
              setTimeout(
                () => scrollRef.current?.scrollTo({ y: listSectionY.current, animated: true }),
                60,
              )
            }
          >
            <Feather name="compass" size={14} color="#18120C" />
            <Text style={s.actionPrimaryText}>
              Ver {itemCount > 0 ? `${itemCount} ` : ""}local{itemCount !== 1 ? "is" : ""}
            </Text>
          </Pressable>

          {supabaseNeighborhood && (
            <Pressable
              style={[s.actionGhost, editorialOpen && s.actionGhostActive]}
              onPress={() => setEditorialOpen((v) => !v)}
            >
              <Text style={s.actionGhostText}>Por dentro do bairro</Text>
              <Feather
                name={editorialOpen ? "chevron-up" : "chevron-down"}
                size={13}
                color="rgba(255,255,255,0.55)"
              />
            </Pressable>
          )}
        </View>

        {/* ── Collapsible editorial ── */}
        {editorialOpen && supabaseNeighborhood && (
          <View style={s.editorial}>
            <Text style={s.sectionLabel}>Por dentro do bairro</Text>
            {supabaseNeighborhood.my_view
              .replace(/\r\n/g, "\n")
              .split("\n")
              .map((p, i) =>
                p.trim() ? (
                  <Text key={i} style={s.bodyText}>{p.trim()}</Text>
                ) : null,
              )}

            {supabaseNeighborhood.how_to_live && supabaseNeighborhood.how_to_live.length > 0 && (
              <>
                <Text style={[s.sectionLabel, { marginTop: 24 }]}>Como viver o bairro</Text>
                {supabaseNeighborhood.how_to_live.map((tip, i) => (
                  <View key={i} style={s.tipRow}>
                    <View style={s.tipDot} />
                    <Text style={s.tipText}>{tip}</Text>
                  </View>
                ))}
              </>
            )}

            {(supabaseNeighborhood.scenery || supabaseNeighborhood.walkable) && (
              <>
                <Text style={[s.sectionLabel, { marginTop: 24 }]}>Perfil do bairro</Text>
                <View style={s.statsGrid}>
                  {supabaseNeighborhood.scenery ? (
                    <StatPill label="Paisagem" value={formatLevel(supabaseNeighborhood.scenery)} />
                  ) : null}
                  {supabaseNeighborhood.walkable ? (
                    <StatPill label="A pé" value={formatLevel(supabaseNeighborhood.walkable)} />
                  ) : null}
                  {supabaseNeighborhood.gastronomy ? (
                    <StatPill label="Gastronomia" value={formatLevel(supabaseNeighborhood.gastronomy)} />
                  ) : null}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Activities list ── */}
        <View
          style={s.listSection}
          onLayout={(e) => { listSectionY.current = e.nativeEvent.layout.y; }}
        >
          <View style={s.listHeader}>
            <Text style={s.listLabel}>O que fazer em {bairroNome}</Text>
            {itemCount > 0 && (
              <Text style={s.listCount}>
                {itemCount} local{itemCount !== 1 ? "is" : ""}
              </Text>
            )}
          </View>

          {lugaresLoading && itemCount === 0 && (
            <View style={s.centerWrap}>
              <Text style={s.emptyText}>Carregando…</Text>
            </View>
          )}
          {!lugaresLoading && itemCount === 0 && (
            <View style={s.centerWrap}>
              <Feather name="map-pin" size={18} color="rgba(255,255,255,0.12)" />
              <Text style={s.emptyTitle}>Nenhum local em {bairroNome}</Text>
              <Text style={s.emptyText}>Em breve novidades neste bairro.</Text>
            </View>
          )}

          {filtered.map((place, index) => (
            <Pressable
              key={place.id}
              style={s.card}
              onPress={() =>
                router.push({
                  pathname: "/lugar/[cityId]/[placeId]",
                  params: { cityId: destino.id, placeId: place.id, source_table: "lugares" },
                })
              }
            >
              <View style={s.cardImageWrap}>
                <Image source={place.image} style={s.cardImage} resizeMode="cover" />
                <LinearGradient
                  colors={["rgba(0,0,0,0.10)", "transparent"]}
                  locations={[0, 0.4]}
                  style={StyleSheet.absoluteFill}
                />
                <Pressable
                  style={[s.bookmarkBtn, isSaved(place.id) && s.bookmarkBtnSaved]}
                  hitSlop={6}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    if (isSaved(place.id)) {
                      unsave(place.id);
                    } else {
                      save({
                        id:           place.id,
                        categoria:    "oQueFazer",
                        source_table: "lugares",
                        titulo:       place.titulo,
                        localizacao:  place.localizacao,
                        image:        place.image ?? FALLBACK_IMG,
                      });
                    }
                  }}
                >
                  <Feather
                    name="bookmark"
                    size={15}
                    color={isSaved(place.id) ? GOLD : C.white}
                  />
                </Pressable>
                {place.preco && (
                  <View style={s.priceBadge}>
                    <Text style={s.priceText}>{place.preco}</Text>
                  </View>
                )}
                <View style={s.orderBadge}>
                  <Text style={s.orderText}>{String(index + 1).padStart(2, "0")}</Text>
                </View>
              </View>

              <View style={s.cardBody}>
                <View style={s.cardMeta}>
                  <Text style={s.cardCategoria}>{place.categoria}</Text>
                  <View style={s.cardLocWrap}>
                    <Feather name="map-pin" size={10} color={C.warmGray} />
                    <Text style={s.cardLocText}>{place.localizacao}</Text>
                  </View>
                </View>
                <Text style={s.cardTitulo}>{place.titulo}</Text>
                <Text style={s.cardDesc}>{place.descricao}</Text>
                <Pressable
                  style={s.cta}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    router.push({
                      pathname: "/lugar/[cityId]/[placeId]",
                      params: { cityId: destino.id, placeId: place.id, source_table: "lugares", showMap: "true" },
                    });
                  }}
                >
                  <Feather name="map-pin" size={13} color={C.terracotta} />
                  <Text style={s.ctaText}>Ver no mapa</Text>
                </Pressable>
              </View>
            </Pressable>
          ))}
        </View>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerL}>L.</Text>
          <Text style={s.footerText}>Experiências curadas · {bairroNome}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statPill}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },

  hero: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  backBtn: {
    position: "absolute",
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    zIndex: 10,
  },
  backText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.88)",
  },
  heroContent: { paddingHorizontal: 24, paddingBottom: 28 },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    marginBottom: 14,
  },
  categoryText: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: "rgba(255,255,255,0.70)",
    letterSpacing: 1.6,
  },
  heroName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 38,
    color: C.white,
    letterSpacing: -0.6,
    lineHeight: 46,
    marginBottom: 8,
  },
  heroPhrase: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 16,
    color: C.gold,
    letterSpacing: 0.1,
    fontStyle: "italic",
    opacity: 0.85,
    lineHeight: 24,
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  actionPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 50,
    paddingVertical: 13,
  },
  actionPrimaryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13.5,
    color: "#18120C",
    letterSpacing: 0.1,
  },
  actionGhost: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 50,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  actionGhostActive: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.20)",
  },
  actionGhostText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.70)",
    letterSpacing: 0.1,
  },

  editorial: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    marginTop: 16,
  },
  sectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: C.warmGray,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  bodyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.72)",
    lineHeight: 26,
    marginBottom: 14,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  tipDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
    marginTop: 10,
    flexShrink: 0,
  },
  tipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.62)",
    lineHeight: 22,
    flex: 1,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statPill: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    minWidth: 110,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.30)",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },

  listSection: {
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    marginTop: 16,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  listLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: C.warmGray,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  listCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.25)",
  },
  centerWrap: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 16,
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.20)",
    textAlign: "center",
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardImageWrap: {
    height: CARD_IMAGE_H,
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  bookmarkBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
  bookmarkBtnSaved: {
    backgroundColor: "rgba(27,79,114,0.22)",
    borderColor: "rgba(27,79,114,0.40)",
  },
  priceBadge: {
    position: "absolute",
    top: 14,
    right: 58,
    backgroundColor: "rgba(0,0,0,0.52)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  priceText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "rgba(255,255,255,0.80)",
    letterSpacing: 0.5,
  },
  orderBadge: {
    position: "absolute",
    bottom: 14,
    left: 14,
  },
  orderText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 1,
  },
  cardBody: { padding: 18, paddingTop: 16 },
  cardMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardCategoria: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "rgba(255,255,255,0.50)",
    letterSpacing: 1.4,
  },
  cardLocWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardLocText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.warmGray,
  },
  cardTitulo: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 19,
    color: C.white,
    lineHeight: 26,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  cardDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.62)",
    lineHeight: 20,
    marginBottom: 16,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingVertical: 11,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  ctaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 0.2,
  },

  footer: {
    marginTop: 32,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    gap: 8,
  },
  footerL: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: "rgba(255,255,255,0.18)",
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.30)",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
  },
});
