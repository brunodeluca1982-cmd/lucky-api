/**
 * "O que fazer agora" — real-time intelligent guide by time of day.
 *
 * STRICT RULE: ALL content comes from Supabase only.
 * Any item not found in Supabase is REJECTED with console.error.
 * If Supabase returns 0 items → UI shows empty state. NEVER fake content.
 */

import React from "react";
import {
  ActivityIndicator,
  Animated,
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
import { PeriodoSwitcher } from "@/components/PeriodoSwitcher";
import { useTimeOfDay } from "@/hooks/useTimeOfDay";
import { useAgoraContent, type AgoraItem, type DestaqueItem } from "@/hooks/useAgoraContent";

const C = Colors.light;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_W = SCREEN_WIDTH * 0.62;
const GRID_CARD_W = (SCREEN_WIDTH - 48 - 12) / 2;

const PERIODO_META: Record<string, { label: string; subtitle: string }> = {
  manha: { label: "Manhã",  subtitle: "Manhã no Rio — comece o dia com leveza."   },
  tarde:  { label: "Tarde", subtitle: "Tarde no Rio — o melhor para este momento." },
  noite:  { label: "Noite", subtitle: "Noite no Rio — a cidade que nunca dorme."   },
};

// ── Hero card (first item, full-width) ────────────────────────────────────────
function HeroCard({ item, cityId }: { item: AgoraItem; cityId: string }) {
  return (
    <Pressable
      style={({ pressed }) => [s.heroCard, pressed && { opacity: 0.90 }]}
      onPress={() =>
        router.push({
          pathname: "/lugar/[cityId]/[placeId]",
          params: { cityId, placeId: item.placeId, source_table: item.source_table },
        })
      }
    >
      {item.image != null && (
        <Image source={item.image} style={s.heroCardImage} resizeMode="cover" />
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.02)", "rgba(0,0,0,0.85)"]}
        locations={[0.3, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.heroTagPill}>
        <Text style={s.heroTagText}>{item.tag}</Text>
      </View>
      <View style={s.heroCardContent}>
        <Text style={s.heroCardTitle}>{item.titulo}</Text>
        {item.descricao ? (
          <Text style={s.heroCardSub} numberOfLines={2}>{item.descricao}</Text>
        ) : null}
        <View style={s.heroCardAction}>
          <Text style={s.heroCardActionText}>Abrir</Text>
          <Feather name="arrow-right" size={13} color="rgba(255,255,255,0.70)" />
        </View>
      </View>
    </Pressable>
  );
}

// ── Horizontal scroll card ────────────────────────────────────────────────────
function MomentoCard({ item, cityId }: { item: AgoraItem; cityId: string }) {
  return (
    <Pressable
      style={({ pressed }) => [
        s.momentoCard,
        pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
      ]}
      onPress={() =>
        router.push({
          pathname: "/lugar/[cityId]/[placeId]",
          params: { cityId, placeId: item.placeId, source_table: item.source_table },
        })
      }
    >
      {item.image != null && (
        <Image source={item.image} style={s.momentoImage} resizeMode="cover" />
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.02)", "rgba(0,0,0,0.84)"]}
        locations={[0.25, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.momentoTagPill}>
        <Text style={s.momentoTagText}>{item.tag}</Text>
      </View>
      <View style={s.momentoContent}>
        <Text style={s.momentoTitle} numberOfLines={2}>{item.titulo}</Text>
        <Text style={s.momentoLoc}>{item.localizacao}</Text>
      </View>
    </Pressable>
  );
}

// ── Destaque card (2-col grid) ────────────────────────────────────────────────
function DestaqueCard({ pick }: { pick: DestaqueItem }) {
  return (
    <View style={s.destaqueCard}>
      {pick.image != null && (
        <Image source={pick.image} style={s.destaqueImage} resizeMode="cover" />
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.04)", "rgba(0,0,0,0.82)"]}
        locations={[0.2, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.destaqueTagPill}>
        <Text style={s.destaqueTagText}>{pick.tag}</Text>
      </View>
      <View style={s.destaqueContent}>
        <Text style={s.destaqueTitulo} numberOfLines={2}>{pick.titulo}</Text>
        <Text style={s.destaqueLoc}>{pick.localizacao}</Text>
      </View>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ periodo }: { periodo: string }) {
  const meta = PERIODO_META[periodo];
  return (
    <View style={s.emptyWrap}>
      <Feather name="compass" size={36} color="rgba(255,255,255,0.20)" />
      <Text style={s.emptyTitle}>Nada disponível</Text>
      <Text style={s.emptySubtitle}>
        Não encontramos sugestões para {meta?.label ?? periodo} no momento.
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AgoraNoRioScreen() {
  const { id, pinnedId } = useLocalSearchParams<{ id: string; pinnedId?: string }>();
  const insets    = useSafeAreaInsets();
  const topInset  = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const destino = destinos.find((d) => d.id === id) ?? destinos[0];
  const { periodo, setPeriodo, fadeAnim } = useTimeOfDay();
  const meta = PERIODO_META[periodo];

  const { byPeriodo, destaques, loading, error } = useAgoraContent(destino.id);

  const rawItems = byPeriodo[periodo] ?? [];

  const pinnedItem = pinnedId
    ? rawItems.find((item) => item.id === pinnedId || item.placeId === pinnedId)
    : undefined;

  const items = pinnedItem
    ? [pinnedItem, ...rawItems.filter((item) => item.id !== pinnedItem.id)]
    : rawItems;

  const heroItem  = items[0];
  const restItems = items.slice(1);

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Fullscreen background ── */}
      {destino.image != null && (
        <Image source={destino.image} style={s.bgImage} resizeMode="cover" />
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0.40)", "#000000"]}
        locations={[0, 0.28, 0.52]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Back button — fixed ── */}
      <Pressable
        onPress={() => router.back()}
        style={[s.backBtn, { top: topInset + 12 }]}
        hitSlop={8}
      >
        <Feather name="arrow-left" size={18} color={C.white} />
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.scrollContent,
          { paddingTop: topInset + 60, paddingBottom: bottomPad + 110 },
        ]}
      >
        {/* ── Hero header ── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>O que fazer agora</Text>
          <Animated.Text style={[s.headerSubtitle, { opacity: fadeAnim }]}>
            {meta?.subtitle ?? ""}
          </Animated.Text>
        </View>

        {/* ── Period switcher ── */}
        <PeriodoSwitcher active={periodo} onChange={setPeriodo} dark />

        {/* ── Content ── */}
        <Animated.View style={{ opacity: fadeAnim }}>

          {loading ? (
            <ActivityIndicator
              color="rgba(27,79,114,0.7)"
              style={{ marginTop: 40 }}
            />
          ) : error ? (
            <View style={s.emptyWrap}>
              <Feather name="wifi-off" size={32} color="rgba(255,255,255,0.20)" />
              <Text style={s.emptyTitle}>Erro ao carregar</Text>
              <Text style={s.emptySubtitle}>{error}</Text>
            </View>
          ) : (
            <>
              {/* ── Hero card ── */}
              {heroItem ? (
                <View style={s.heroSection}>
                  <HeroCard item={heroItem} cityId={destino.id} />
                </View>
              ) : (
                <EmptyState periodo={periodo} />
              )}

              {/* ── More cards horizontal scroll ── */}
              {restItems.length > 0 && (
                <View style={s.maisSection}>
                  <View style={s.maisSectionHeader}>
                    <Text style={s.maisSectionLabel}>Mais para este momento</Text>
                    <Feather
                      name="chevron-right"
                      size={15}
                      color="rgba(255,255,255,0.35)"
                    />
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.momentoScroll}
                  >
                    {restItems.map((item) => (
                      <MomentoCard key={item.id} item={item} cityId={destino.id} />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* ── Destaque (Supabase restaurants) ── */}
              {destaques.length > 0 && (
                <View style={s.destaqueSection}>
                  <View style={s.maisSectionHeader}>
                    <Text style={s.maisSectionLabel}>Onde comer</Text>
                  </View>
                  <View style={s.destaqueGrid}>
                    {destaques.slice(0, 2).map((pick) => (
                      <DestaqueCard key={pick.id} pick={pick} />
                    ))}
                  </View>
                </View>
              )}
            </>
          )}

        </Animated.View>

        {/* ── Editorial footer ── */}
        <View style={s.footer}>
          <Text style={s.footerL}>L.</Text>
          <Text style={s.footerText}>
            Sugestões baseadas no momento — atualizadas conforme o dia avança.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },

  bgImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: 320,
    resizeMode: "cover",
  },

  backBtn: {
    position: "absolute",
    left: 20,
    zIndex: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.40)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  scrollContent: {},

  header: {
    paddingHorizontal: 24,
    paddingBottom: 18,
    gap: 6,
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 34,
    color: C.white,
    lineHeight: 42,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.70)",
    lineHeight: 22,
  },

  heroSection: {
    paddingHorizontal: 24,
    marginTop: 22,
  },
  heroCard: {
    width: "100%",
    height: 240,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#1A1208",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  heroCardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  heroTagPill: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  heroTagText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: C.white,
    letterSpacing: 0.4,
  },
  heroCardContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    gap: 5,
  },
  heroCardTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: C.white,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  heroCardSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 19,
  },
  heroCardAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  heroCardActionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "rgba(255,255,255,0.70)",
    letterSpacing: 0.3,
  },

  maisSection: {
    marginTop: 28,
  },
  maisSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  maisSectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "rgba(255,255,255,0.50)",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  momentoScroll: {
    paddingHorizontal: 24,
    gap: 12,
  },
  momentoCard: {
    width: CARD_W,
    height: CARD_W * 1.18,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#1A1208",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  momentoImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  momentoTagPill: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.50)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  momentoTagText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "rgba(255,255,255,0.80)",
    letterSpacing: 0.5,
  },
  momentoContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    gap: 3,
  },
  momentoTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 16,
    color: C.white,
    lineHeight: 21,
  },
  momentoLoc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
  },

  destaqueSection: {
    marginTop: 32,
  },
  destaqueGrid: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 12,
  },
  destaqueCard: {
    flex: 1,
    height: GRID_CARD_W * 1.2,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#1A1208",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  destaqueImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  destaqueTagPill: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.52)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  destaqueTagText: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: "rgba(255,255,255,0.70)",
    letterSpacing: 0.5,
  },
  destaqueContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingBottom: 34,
    gap: 2,
  },
  destaqueTitulo: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 14,
    color: C.white,
    lineHeight: 19,
  },
  destaqueLoc: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.52)",
  },

  emptyWrap: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 18,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.32)",
    textAlign: "center",
    lineHeight: 20,
  },

  footer: {
    marginTop: 40,
    marginHorizontal: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
  },
  footerL: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: C.terracotta,
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.32)",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 240,
  },
});
