/**
 * luckyList/bairro/[bairroNome].tsx — Neighborhood Lucky picks page
 *
 * Layout:
 *   Hero → action buttons ("Ver X picks" + "Por dentro do bairro")
 *   [Collapsible editorial from Supabase neighborhoods]
 *   Filtered Lucky picks list
 *
 * URL params:
 *   bairroNome — neighborhood name (used to filter place.localizacao)
 *   cityId     — destination id
 *
 * Gold Lucky List branding preserved throughout.
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
import { sanitizePhotoUrl } from "@/utils/getImageForEntity";
import { destinos } from "@/data/mockData";
import { useNeighborhoods } from "@/hooks/useNeighborhoods";
import { useLuckyList } from "@/hooks/useLuckyList";
import { getNeighborhoodHero } from "@/utils/neighborhoodHero";
import { useGuia } from "@/context/GuiaContext";

const C    = Colors.light;
const GOLD = "#1B4F72";
const GOLD_DIM    = "rgba(27,79,114,0.18)";
const GOLD_BORDER = "rgba(27,79,114,0.28)";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const HERO_H      = Math.round(SCREEN_HEIGHT * 0.46);
const CARD_IMAGE_H = 218;

function formatLevel(val: string): string {
  const m: Record<string, string> = {
    alto: "Alta", alta: "Alta", media: "Média", baixa: "Baixa", muito_alta: "Muito alta",
  };
  return m[val?.toLowerCase()] ?? val ?? "—";
}

export default function LuckyListBairroScreen() {
  const { bairroNome, cityId } = useLocalSearchParams<{ bairroNome: string; cityId?: string }>();
  const insets    = useSafeAreaInsets();
  const topInset  = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const destino    = destinos.find((d) => d.id === (cityId ?? "rio")) ?? destinos[0];
  const { luckyList, loading: lugaresLoading } = useLuckyList();
  const FALLBACK_IMG = require("../../../assets/images/ipanema.png");
  const allLugares = (luckyList?.itens ?? []).map((item: any) => ({
    id: item.lugar.id,
    titulo: item.lugar.nome,
    localizacao: item.lugar.bairro_nome ?? "",
    descricao: item.lugar.meu_olhar ?? "",
    categoria: "lucky",
    image: FALLBACK_IMG,
  }));
  const filtered   = allLugares.filter((p: any) => p.localizacao === bairroNome);

  const { save, unsave, isSaved } = useGuia();

  const { neighborhoods } = useNeighborhoods();
  const supabaseNeighborhood = neighborhoods.find(
    (n) => n.neighborhood_name === bairroNome,
  ) ?? null;

  const heroImage = getNeighborhoodHero(supabaseNeighborhood?.image_url);

  const [editorialOpen, setEditorialOpen] = useState(false);

  const scrollRef    = useRef<ScrollView>(null);
  const listSectionY = useRef(0);

  const itemCount = filtered.length;

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Full-screen background (persists while scrolling) ── */}
      {heroImage != null && (
        <Image
          source={heroImage}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      )}
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
          {/* Gold top accent line */}
          <View style={s.goldLine} />

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
              <Text style={s.categoryText}>✦ LUCKY LIST</Text>
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
            style={s.actionGold}
            onPress={() =>
              setTimeout(
                () => scrollRef.current?.scrollTo({ y: listSectionY.current, animated: true }),
                60,
              )
            }
          >
            <Text style={s.actionGoldText}>
              ✦ Ver {itemCount > 0 ? `${itemCount} ` : ""}pick{itemCount !== 1 ? "s" : ""}
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
                color="rgba(27,79,114,0.60)"
              />
            </Pressable>
          )}
        </View>

        {/* ── Collapsible editorial ── */}
        {editorialOpen && supabaseNeighborhood && (
          <View style={s.editorial}>
            <View style={s.editorialHeader}>
              <Text style={s.sectionLabel}>Por dentro do bairro</Text>
              <View style={s.sectionLine} />
            </View>
            {supabaseNeighborhood.my_view
              .replace(/\r\n/g, "\n")
              .split("\n")
              .map((p, i) =>
                p.trim() ? (
                  <Text key={`para-${i}`} style={s.bodyText}>{p.trim()}</Text>
                ) : null,
              )}

            {supabaseNeighborhood.how_to_live && supabaseNeighborhood.how_to_live.length > 0 && (
              <>
                <View style={[s.editorialHeader, { marginTop: 24 }]}>
                  <Text style={s.sectionLabel}>Como viver o bairro</Text>
                  <View style={s.sectionLine} />
                </View>
                {supabaseNeighborhood.how_to_live.map((tip, i) => (
                  <View key={`tip-${i}`} style={s.tipRow}>
                    <Text style={s.tipMark}>✦</Text>
                    <Text style={s.tipText}>{tip}</Text>
                  </View>
                ))}
              </>
            )}

            {supabaseNeighborhood.nightlife && (
              <>
                <View style={[s.editorialHeader, { marginTop: 24 }]}>
                  <Text style={s.sectionLabel}>Perfil do bairro</Text>
                  <View style={s.sectionLine} />
                </View>
                <View style={s.statsGrid}>
                  {supabaseNeighborhood.nightlife ? (
                    <StatPill label="Vida noturna" value={formatLevel(supabaseNeighborhood.nightlife)} />
                  ) : null}
                  {supabaseNeighborhood.scenery ? (
                    <StatPill label="Paisagem" value={formatLevel(supabaseNeighborhood.scenery)} />
                  ) : null}
                  {supabaseNeighborhood.walkable ? (
                    <StatPill label="A pé" value={formatLevel(supabaseNeighborhood.walkable)} />
                  ) : null}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Lucky picks list ── */}
        <View
          style={s.listSection}
          onLayout={(e) => { listSectionY.current = e.nativeEvent.layout.y; }}
        >
          <View style={s.listHeader}>
            <Text style={s.listLabel}>
              {itemCount > 0 ? `${itemCount} seleções` : "Seleções"} em {bairroNome}
            </Text>
            <View style={s.listLine} />
          </View>

          {lugaresLoading && itemCount === 0 && (
            <View style={s.centerWrap}>
              <Text style={s.emptyText}>Carregando…</Text>
            </View>
          )}
          {!lugaresLoading && itemCount === 0 && (
            <View style={s.centerWrap}>
              <Text style={s.emptyGold}>✦</Text>
              <Text style={s.emptyTitle}>Nenhum pick em {bairroNome}</Text>
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
                  params: { cityId: destino.id, placeId: place.id, source_table: "lucky_list_rio_v2" },
                })
              }
            >
              <View style={s.cardImageWrap}>
                {sanitizePhotoUrl(place.photo_url) ? (
                  <Image source={{ uri: sanitizePhotoUrl(place.photo_url)! }} style={s.cardImage} resizeMode="cover" />
                ) : (
                  <View style={[s.cardImage, { backgroundColor: "#1A0E04" }]} />
                )}
                <LinearGradient
                  colors={["rgba(0,0,0,0.22)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.55)"]}
                  locations={[0, 0.45, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={s.bookmarkBtn}>
                  <Feather name="bookmark" size={15} color={C.white} />
                </View>
                <View style={s.luckyNumber}>
                  <Text style={s.luckyNumberText}>✦</Text>
                  <Text style={s.luckyIndexText}>{String(index + 1).padStart(2, "0")}</Text>
                </View>
                <View style={s.categoriaBadge}>
                  <Text style={s.categoriaText}>{place.categoria}</Text>
                </View>
              </View>

              <View style={s.cardBody}>
                <View style={s.cardLocRow}>
                  <Feather name="map-pin" size={10} color={GOLD} />
                  <Text style={s.cardLocText}>{place.localizacao}</Text>
                </View>
                <Text style={s.cardTitulo}>{place.titulo}</Text>
                <Text style={s.cardDesc}>{place.descricao}</Text>
                <View style={s.actionsRow}>
                  <Pressable
                    style={s.verNoMapaBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      router.push({
                        pathname: "/lugar/[cityId]/[placeId]",
                        params: { cityId: destino.id, placeId: place.id, source_table: "lucky_list_rio_v2", showMap: "true" },
                      });
                    }}
                  >
                    <Feather name="map-pin" size={13} color={C.terracotta} />
                    <Text style={s.verNoMapaText}>Ver no mapa</Text>
                  </Pressable>
                  <Pressable
                    style={[s.saveBtn, isSaved(place.id) && s.saveBtnSaved]}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      if (isSaved(place.id)) {
                        unsave(place.id);
                      } else {
                        save({
                          id:           place.id,
                          categoria:    "lucky",
                          source_table: "lucky_list_rio_v2",
                          titulo:       place.titulo,
                          localizacao:  place.localizacao,
                          image:        place.image,
                        });
                      }
                    }}
                  >
                    <Feather
                      name="bookmark"
                      size={13}
                      color={isSaved(place.id) ? C.white : GOLD}
                    />
                    <Text style={[s.saveBtnText, isSaved(place.id) && s.saveBtnTextSaved]}>
                      {isSaved(place.id) ? "Salvo" : "Salvar"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerGold}>✦</Text>
          <Text style={s.footerTitle}>Lucky Trip</Text>
          <Text style={s.footerSub}>
            Seleções curadas para quem sabe escolher · {bairroNome}
          </Text>
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
  goldLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: GOLD_BORDER,
    zIndex: 5,
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
    borderColor: GOLD_BORDER,
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
    backgroundColor: "rgba(27,79,114,0.12)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    marginBottom: 14,
  },
  categoryText: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: GOLD,
    letterSpacing: 2,
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
    color: GOLD,
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
  actionGold: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: GOLD,
    borderRadius: 50,
    paddingVertical: 13,
  },
  actionGoldText: {
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
    backgroundColor: "rgba(27,79,114,0.06)",
    borderRadius: 50,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  actionGhostActive: {
    backgroundColor: "rgba(27,79,114,0.12)",
    borderColor: "rgba(27,79,114,0.40)",
  },
  actionGhostText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(27,79,114,0.80)",
    letterSpacing: 0.1,
  },

  editorial: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(27,79,114,0.12)",
    marginTop: 16,
  },
  editorialHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  sectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: GOLD,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: GOLD_BORDER,
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
    gap: 10,
    marginBottom: 12,
  },
  tipMark: {
    fontSize: 8,
    color: GOLD,
    opacity: 0.55,
    marginTop: 8,
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
    backgroundColor: "rgba(27,79,114,0.05)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.12)",
    minWidth: 110,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(27,79,114,0.45)",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(27,79,114,0.85)",
  },

  listSection: {
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(27,79,114,0.10)",
    marginTop: 16,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  listLabel: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 13,
    color: GOLD,
    letterSpacing: 1.2,
  },
  listLine: {
    flex: 1,
    height: 1,
    backgroundColor: GOLD_BORDER,
  },
  centerWrap: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyGold: {
    fontSize: 22,
    color: GOLD,
    opacity: 0.35,
    marginBottom: 4,
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
    color: "rgba(255,255,255,0.18)",
    textAlign: "center",
  },

  card: {
    backgroundColor: "#1A1208",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.10)",
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
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  luckyNumber: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.46)",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  luckyNumberText: { fontSize: 9, color: GOLD },
  luckyIndexText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: GOLD,
    letterSpacing: 0.8,
  },
  categoriaBadge: {
    position: "absolute",
    bottom: 14,
    left: 14,
    backgroundColor: "rgba(0,0,0,0.54)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  categoriaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: GOLD,
    letterSpacing: 1.6,
  },
  cardBody: { padding: 18, paddingTop: 16 },
  cardLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  cardLocText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(27,79,114,0.72)",
  },
  cardTitulo: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: C.white,
    lineHeight: 28,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  cardDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.62)",
    lineHeight: 21,
    marginBottom: 18,
  },
  actionsRow: { flexDirection: "row", gap: 10 },
  verNoMapaBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "rgba(196,112,74,0.30)",
    borderRadius: 10,
    paddingVertical: 11,
    backgroundColor: "rgba(196,112,74,0.06)",
  },
  verNoMapaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.terracotta,
  },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    borderRadius: 10,
    paddingVertical: 11,
    backgroundColor: GOLD_DIM,
  },
  saveBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: GOLD,
  },
  saveBtnSaved: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  saveBtnTextSaved: {
    color: "#000000",
  },

  footer: {
    backgroundColor: "#000000",
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(27,79,114,0.12)",
    alignItems: "center",
    gap: 6,
  },
  footerGold: {
    fontSize: 22,
    color: GOLD,
    marginBottom: 2,
  },
  footerTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: C.white,
    letterSpacing: 0.5,
  },
  footerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(27,79,114,0.50)",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
    marginTop: 4,
  },
});
