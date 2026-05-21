/**
 * oQueFazer/[id].tsx — O que fazer map + activities list screen
 *
 * Map: RioMapView (Leaflet satellite).
 * Tap a neighborhood → navigate directly to oQueFazer/bairro/[bairroNome] (no floating card).
 * Scrollable list always shows ALL activities.
 */

import React, { useRef } from "react";
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
import RioMapView from "@/components/RioMapView";
import { useGuia } from "@/context/GuiaContext";
import { useOQueFazer } from "@/hooks/useOQueFazer";
import { useBairros } from "@/hooks/useBairros";
import { getImageForEntity } from "@/utils/getImageForEntity";

const C = Colors.light;
const GOLD = "#1B4F72";
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MAP_H = Math.round(SCREEN_HEIGHT * 0.50);
const CARD_IMAGE_H = 210;

const DESCRICOES: Record<string, string[]> = {
  rio: [
    "O Rio de Janeiro é muito mais que praias paradisíacas e o Cristo Redentor. É uma cidade que respira música, dança e uma energia contagiante que mistura modernidade com tradição.",
    "Cada bairro carrega uma identidade própria — de Santa Teresa com seus artistas e ladeiras de pedra, ao Leblon com seu charme discretamente exclusivo.",
    "Aqui, natureza e vida urbana coexistem com uma harmonia rara no mundo.",
  ],
};

const DEFAULT_DESCRICAO = [
  "Uma cidade que convida à exploração lenta e curiosa. Cada esquina revela algo inesperado.",
  "A verdadeira experiência começa quando você abandona o roteiro previsível e segue o instinto.",
];

// Human-readable labels for each category id
const CATEGORIA_LABELS: Record<string, string> = {
  atividade:    "Atividades",
  praia:        "Praias",
  compras:      "Compras",
  dica_secreta: "Dicas Secretas",
};

const RIO_DESTINO_ID = "7f047742-427f-4b11-8286-781af899c57d";

export default function OQueFazerScreen() {
  const { id, categoria } = useLocalSearchParams<{ id: string; categoria?: string }>();
  const insets    = useSafeAreaInsets();
  const topInset  = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const destino    = destinos.find((d) => d.id === id) ?? destinos[0];
  const { atividades, loading, error } = useOQueFazer(RIO_DESTINO_ID);
  const { bairros, loading: bairrosLoading } = useBairros(RIO_DESTINO_ID);
  const descricao  = DESCRICOES[destino.id] ?? DEFAULT_DESCRICAO;
  const { save, unsave, isSaved } = useGuia();

  // Filter by categoria if provided (case-insensitive)
  const filtered = categoria
    ? atividades.filter((l) => l.categoria?.toLowerCase() === categoria.toLowerCase())
    : atividades;

  const categoriaLabel = categoria ? (CATEGORIA_LABELS[categoria.toLowerCase()] ?? categoria) : null;

  const listRef = useRef<ScrollView>(null);

  function handleBairroPress(bairro: any) {
    if (!bairro) return;
    router.push({
      pathname: "/oQueFazer/bairro/[bairroNome]",
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
          <View style={s.pill}>
            <View style={s.badgeDot} />
            <Text style={s.pillText}>
              {loading ? "carregando…" : `${filtered.length} locais`}
            </Text>
          </View>
        </View>

        <View style={[s.mapHint, { pointerEvents: "none" }]}>
          <Text style={s.mapHintText}>Toque num bairro para explorar</Text>
        </View>
      </View>

      {/* ── Scrollable list ── */}
      <ScrollView
        ref={listRef}
        style={s.listScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 96 }}
      >
        <View style={s.introHeroWrap}>
          <Image
            source={destino.image}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.28)", "rgba(0,0,0,0.92)"]}
            locations={[0.05, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={[s.intro, s.introAbsolute]}>
            <Text style={s.introTitle}>O que fazer em {destino.cidade}</Text>
            <Text style={s.introPara}>{descricao[0]}</Text>
            <Text style={s.byline}>Por Bruno de Luca</Text>
            <View style={s.introMeta}>
              <View style={s.introDot} />
              <Text style={s.introMetaText}>
                Seleção curada · {filtered.length} lugar{filtered.length !== 1 ? "es" : ""}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.listSection}>
          {/* Active filter badge + "Ver todas" */}
          {categoriaLabel ? (
            <View style={s.filterRow}>
              <View style={s.filterBadge}>
                <Text style={s.filterBadgeText}>{categoriaLabel.toUpperCase()} · {filtered.length} lugar{filtered.length !== 1 ? "es" : ""}</Text>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  router.replace({
                    pathname: "/oQueFazer/[id]",
                    params: { id: destino.id },
                  })
                }
              >
                <Text style={s.verTodasText}>Ver todas ×</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={s.listLabel}>
            {categoriaLabel ? `${categoriaLabel} selecionadas` : "Experiências selecionadas"}
          </Text>

          {descricao.slice(1).map((para, i) => (
            <Text key={i} style={s.descPara}>{para}</Text>
          ))}

          {filtered.map((place, index) => {
            const imageSource = getImageForEntity("activity", place.nome, place.bairro_nome ?? "", place.hero_image_url);
            return (
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
                  <Image source={imageSource} style={s.cardImage} resizeMode="cover" />
                  <LinearGradient
                    colors={["rgba(0,0,0,0.12)", "transparent"]}
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
                          categoria:    place.categoria as any,
                          source_table: "lugares",
                          titulo:       place.nome,
                          localizacao:  place.bairro_nome ?? "",
                          image:        imageSource,
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
                  {place.energia && (
                    <View style={s.priceBadge}>
                      <Text style={s.priceText}>{place.energia}</Text>
                    </View>
                  )}
                  <View style={s.orderBadge}>
                    <Text style={s.orderText}>{String(index + 1).padStart(2, "0")}</Text>
                  </View>
                </View>

                <View style={s.cardBody}>
                  <View style={s.cardMeta}>
                    <Text style={s.cardCategoria}>{place.categoria.toUpperCase()}</Text>
                    <View style={s.cardLocWrap}>
                      <Feather name="map-pin" size={10} color={C.warmGray} />
                      <Text style={s.cardLocText}>{place.bairro_nome ?? ""}</Text>
                    </View>
                  </View>
                  <Text style={s.cardTitulo}>{place.nome}</Text>
                  <Text style={s.cardDesc}>{place.meu_olhar}</Text>
                  <Pressable
                    style={s.verNoMapaBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      router.push({
                        pathname: "/lugar/[cityId]/[placeId]",
                        params: { cityId: destino.id, placeId: place.id, source_table: "lugares", showMap: "true" },
                      });
                    }}
                  >
                    <Feather name="map-pin" size={13} color={C.terracotta} />
                    <Text style={s.verNoMapaText}>Ver no mapa</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={s.footer}>
          <Text style={s.footerL}>L.</Text>
          <Text style={s.footerText}>
            Curadoria para quem quer viver {destino.cidade} com profundidade.
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
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.terracotta,
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
    color: "rgba(255,255,255,0.52)",
    letterSpacing: 0.4,
  },

  listScroll: { flex: 1, backgroundColor: "#000000" },

  introHeroWrap: {
    width: "100%",
    height: 260,
    position: "relative",
    overflow: "hidden",
  },
  introAbsolute: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  intro: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 26,
  },
  introTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: C.white,
    lineHeight: 36,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  introPara: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.62)",
    lineHeight: 26,
    marginBottom: 14,
  },
  introMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  introDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(27,79,114,0.55)",
  },
  introMetaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.5,
  },
  byline: {
    fontFamily: "Inter_500Medium",
    fontSize: 11.5,
    color: "#1B4F72",
    letterSpacing: 0.6,
    marginBottom: 10,
    opacity: 0.85,
  },

  listSection: {
    backgroundColor: "#000000",
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  listLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: C.warmGray,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  descPara: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.62)",
    lineHeight: 26,
    letterSpacing: 0.1,
    marginBottom: 14,
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
  verNoMapaBtn: {
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
  verNoMapaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 0.2,
  },

  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  filterBadge: {
    backgroundColor: "rgba(27,79,114,0.14)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.35)",
  },
  filterBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: GOLD,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  verTodasText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.2,
  },

  footer: {
    backgroundColor: "#000000",
    marginTop: 4,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    gap: 8,
  },
  footerL: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: "rgba(255,255,255,0.25)",
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 240,
  },
});
