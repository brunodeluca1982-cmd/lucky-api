/**
 * luckyList/[id].tsx — Lucky List map + curated picks screen
 *
 * Map: RioMapView (Leaflet satellite).
 * Tap a neighborhood → navigate directly to luckyList/bairro/[bairroNome] (no floating card).
 * Scrollable list always shows ALL lucky picks. Gold branding preserved.
 */

import React, { useRef } from "react";
import {
  ActivityIndicator,
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
import RioMapView from "@/components/RioMapView";
import { useGuia } from "@/context/GuiaContext";
import { useLuckyList, type LuckyListItem } from "@/hooks/useLuckyList";
import { useBairros } from "@/hooks/useBairros";

const FREE_ITEMS = 3;

const C    = Colors.light;
const GOLD = "#1B4F72";
const GOLD_DIM    = "rgba(27,79,114,0.18)";
const GOLD_BORDER = "rgba(27,79,114,0.28)";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MAP_H       = Math.round(SCREEN_HEIGHT * 0.50);
const CARD_IMAGE_H = 218;

const EDITORIAIS: Record<string, { headline: string; paras: string[] }> = {
  rio: {
    headline: "Os lugares que só quem sabe, sabe",
    paras: [
      "Não é o que está no guia turístico. É o que o carioca te conta no terceiro dia — quando já confia em você.",
      "A Lucky List reúne os achados que merecem ser vividos pelo menos uma vez: mirantes sem fila, rituais locais, endereços que parecem segredo mas são simplesmente bem guardados.",
      "Curadoria feita à mão. Atualizada quando vale a pena.",
    ],
  },
};

const DEFAULT_EDITORIAL = {
  headline: "Curadoria especial para este destino",
  paras: [
    "Cada pick da Lucky List foi escolhido por um motivo — não apenas por ser popular, mas por ser a experiência certa no lugar certo.",
    "Aqui estão os endereços que transformam uma viagem boa em uma viagem que você vai contar para todo mundo.",
  ],
};

const RIO_DESTINO_ID = "7f047742-427f-4b11-8286-781af899c57d";

export default function LuckyListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets    = useSafeAreaInsets();
  const topInset  = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const destino    = destinos.find((d) => d.id === id) ?? destinos[0];
  const { luckyList, loading: lugaresLoading, error } = useLuckyList("lucky-list-rio-de-janeiro");
  const { bairros, loading: bairrosLoading } = useBairros(RIO_DESTINO_ID);
  const editorial  = EDITORIAIS[destino.id] ?? DEFAULT_EDITORIAL;

  const allItens = luckyList?.itens ?? [];

  const { save, unsave, isSaved, isPremium, showPaywall } = useGuia();

  const listRef = useRef<ScrollView>(null);

  function handleBairroPress(bairro: any) {
    if (!bairro) return;
    router.push({
      pathname: "/luckyList/bairro/[bairroNome]",
      params: { bairroNome: bairro.nome, cityId: destino.id },
    });
  }

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Fixed map section ── */}
      <View style={s.mapSection}>
        <RioMapView
          bairros={bairros}
          selectedBairroId={null}
          onBairroPress={handleBairroPress}
          loading={bairrosLoading}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={[s.mapControls, { top: topInset + 10 }]} pointerEvents="box-none">
          <Pressable style={s.pill} onPress={() => router.back()} hitSlop={8}>
            <Text style={s.pillText}>← Voltar</Text>
          </Pressable>
          <View style={[s.pill, s.pillGold]}>
            <Text style={s.pillGoldText}>
              {lugaresLoading ? "✦ carregando…" : `✦ ${allItens.length} picks`}
            </Text>
          </View>
        </View>

        <View style={[s.mapHint, { pointerEvents: "none" }]}>
          <Text style={s.mapHintText}>✦ Toque num bairro para filtrar picks</Text>
        </View>
      </View>

      {/* ── Scrollable list ── */}
      <ScrollView
        ref={listRef}
        style={s.listScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 96 }}
      >
        {/* Hero editorial block */}
        <View style={s.heroBlock}>
          <View style={s.heroAccent}>
            <Text style={s.heroAccentText}>✦ LUCKY LIST</Text>
            <View style={s.heroAccentLine} />
          </View>
          <Text style={s.heroHeadline}>{editorial.headline}</Text>
          {editorial.paras.map((para, i) => (
            <Text key={i} style={s.heroPara}>{para}</Text>
          ))}
          <View style={s.curatorBadge}>
            <View style={s.curatorDot} />
            <Text style={s.curatorText}>
              Curadoria Lucky Trip · {destino.cidade} · {allItens.length} picks selecionados
            </Text>
          </View>
        </View>

        {/* Lucky picks cards */}
        <View style={s.cardsSection}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>Lucky Picks</Text>
            <View style={s.sectionLabelLine} />
          </View>

          {lugaresLoading && (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="small" color={GOLD} />
              <Text style={s.loadingText}>Carregando picks...</Text>
            </View>
          )}

          {error && !lugaresLoading && (
            <View style={s.loadingWrap}>
              <Feather name="alert-circle" size={18} color="rgba(27,79,114,0.4)" />
              <Text style={s.loadingText}>{error}</Text>
            </View>
          )}

          {!lugaresLoading && !error && allItens.map((item: LuckyListItem, index: number) => {
            const isLocked = item.bloqueado && !isPremium;
            const lugar = item.lugar;
            return (
              <Pressable
                key={item.id}
                style={s.card}
                onPress={() => {
                  if (isLocked) {
                    showPaywall("discovery");
                    return;
                  }
                  router.push({
                    pathname: "/lugar/[cityId]/[placeId]",
                    params: { cityId: destino.id, placeId: lugar.id, source_table: "lugares" },
                  });
                }}
              >
                <View style={s.cardImageWrap}>
                  <LinearGradient
                    colors={["#1A1208", "#0F0A06"]}
                    style={[s.cardImage, { justifyContent: "center", alignItems: "center" }]}
                  >
                    <Text style={{ fontSize: 40, color: GOLD, opacity: 0.3 }}>✦</Text>
                  </LinearGradient>
                  <LinearGradient
                    colors={["rgba(0,0,0,0.22)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.55)"]}
                    locations={[0, 0.45, 1]}
                    style={StyleSheet.absoluteFill}
                  />

                  {/* Lock overlay (premium only) */}
                  {isLocked && (
                    <View style={s.lockOverlay}>
                      <View style={s.lockBadge}>
                        <Feather name="lock" size={14} color={GOLD} />
                        <Text style={s.lockBadgeText}>Lucky Premium</Text>
                      </View>
                      <Text style={s.lockHint}>Toque para desbloquear</Text>
                    </View>
                  )}

                  {!isLocked && (
                    <View style={s.bookmarkBtn}>
                      <Feather name="bookmark" size={15} color={C.white} />
                    </View>
                  )}
                  <View style={s.luckyNumber}>
                    <Text style={s.luckyNumberText}>✦</Text>
                    <Text style={s.luckyIndexText}>{String(index + 1).padStart(2, "0")}</Text>
                  </View>
                  <View style={s.categoriaBadge}>
                    <Text style={s.categoriaText}>LUCKY LIST</Text>
                  </View>
                </View>

                <View style={s.cardBody}>
                  <View style={s.cardLocRow}>
                    <Feather name="map-pin" size={10} color={GOLD} />
                    <Text style={s.cardLocText}>{lugar.bairro_nome ?? "Rio de Janeiro"}</Text>
                  </View>
                  <Text style={[s.cardTitulo, isLocked && s.cardTituloLocked]}>
                    {isLocked ? "Lucky Pick exclusivo" : lugar.nome}
                  </Text>
                  <Text style={s.cardDesc}>
                    {isLocked
                      ? "Este endereço faz parte da curadoria Lucky Premium. Desbloqueie para ver."
                      : (lugar.meu_olhar ?? "Um dos achados especiais da Lucky List.")}
                  </Text>

                  {isLocked ? (
                    <Pressable
                      style={s.unlockBtn}
                      onPress={() => showPaywall("discovery")}
                    >
                      <Feather name="lock" size={13} color="#000000" />
                      <Text style={s.unlockBtnText}>Desbloquear</Text>
                    </Pressable>
                  ) : (
                    <View style={s.actionsRow}>
                      <Pressable
                        style={s.verNoMapaBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          router.push({
                            pathname: "/lugar/[cityId]/[placeId]",
                            params: { cityId: destino.id, placeId: lugar.id, source_table: "lugares", showMap: "true" },
                          });
                        }}
                      >
                        <Feather name="map-pin" size={13} color={C.terracotta} />
                        <Text style={s.verNoMapaText}>Ver no mapa</Text>
                      </Pressable>
                      <Pressable
                        style={[s.saveBtn, isSaved(lugar.id) && s.saveBtnSaved]}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          if (isSaved(lugar.id)) {
                            unsave(lugar.id);
                          } else {
                            save({
                              id:           lugar.id,
                              categoria:    "lucky",
                              source_table: "lugares",
                              titulo:       lugar.nome,
                              localizacao:  lugar.bairro_nome ?? "Rio de Janeiro",
                              image:        require("../../../assets/images/ipanema.png"),
                            });
                          }
                        }}
                      >
                        <Feather
                          name="bookmark"
                          size={13}
                          color={isSaved(lugar.id) ? C.white : GOLD}
                        />
                        <Text style={[s.saveBtnText, isSaved(lugar.id) && s.saveBtnTextSaved]}>
                          {isSaved(lugar.id) ? "Salvo" : "Salvar"}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={s.footer}>
          <Text style={s.footerGold}>✦</Text>
          <Text style={s.footerTitle}>Lucky Trip</Text>
          <Text style={s.footerSub}>
            Curadoria de lugares que fazem a diferença em {destino.cidade}.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },

  mapSection: {
    width: "100%",
    height: MAP_H,
    position: "relative",
  },
  mapControls: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 30,
    pointerEvents: "box-none",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.46)",
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    boxShadow: "0px 2px 16px rgba(0,0,0,0.38), 0px 0px 0px 1px rgba(255,255,255,0.06)",
  } as any,
  pillText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.88)",
    letterSpacing: 0.1,
  },
  pillGold: {
    borderColor: GOLD_BORDER,
    backgroundColor: "rgba(27,79,114,0.12)",
  },
  pillGoldText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: GOLD,
    letterSpacing: 0.3,
  },
  mapHint: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  mapHintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(27,79,114,0.55)",
    letterSpacing: 0.4,
  },

  listScroll: { flex: 1, backgroundColor: "#000000" },

  heroBlock: {
    backgroundColor: "#000000",
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(27,79,114,0.12)",
  },
  heroAccent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  heroAccentText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: GOLD,
    letterSpacing: 2.5,
  },
  heroAccentLine: {
    flex: 1,
    height: 1,
    backgroundColor: GOLD_BORDER,
  },
  heroHeadline: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: C.white,
    lineHeight: 34,
    letterSpacing: -0.3,
    marginBottom: 18,
  },
  heroPara: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.68)",
    lineHeight: 26,
    letterSpacing: 0.1,
    marginBottom: 14,
  },
  curatorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  curatorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: GOLD,
  },
  curatorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(27,79,114,0.60)",
    letterSpacing: 0.4,
    flexShrink: 1,
  },

  cardsSection: {
    backgroundColor: "#0F0A06",
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  loadingWrap: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(27,79,114,0.50)",
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  sectionLabel: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 13,
    color: GOLD,
    letterSpacing: 1.2,
  },
  sectionLabelLine: {
    flex: 1,
    height: 1,
    backgroundColor: GOLD_BORDER,
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
    width:  "100%",
    height: "100%",
    resizeMode: "cover",
  },
  cardImageLocked: {
    opacity: 0.35,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
    gap:            10,
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  lockBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               6,
    backgroundColor:   "rgba(27,79,114,0.16)",
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderWidth:       1,
    borderColor:       GOLD_BORDER,
  },
  lockBadgeText: {
    fontFamily:    "Inter_500Medium",
    fontSize:      13,
    color:         GOLD,
    letterSpacing: 0.3,
  },
  lockHint: {
    fontFamily: "Inter_400Regular",
    fontSize:   12,
    color:      "rgba(255,255,255,0.50)",
    letterSpacing: 0.2,
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
  cardTituloLocked: {
    color: "rgba(255,255,255,0.35)",
    fontStyle: "italic",
  },
  unlockBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             7,
    backgroundColor: GOLD,
    borderRadius:    10,
    paddingVertical: 11,
  },
  unlockBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize:   13,
    color:      "#000000",
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
    maxWidth: 250,
    marginTop: 4,
  },
});
