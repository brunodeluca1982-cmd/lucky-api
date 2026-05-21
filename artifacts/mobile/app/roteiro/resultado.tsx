import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  Linking,
  Image,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGuia, sourceTableFromCategoria } from "@/context/GuiaContext";
import type { SavedItem, SourceTable } from "@/context/GuiaContext";
import type { ItineraryResult } from "@/utils/buildItinerary";
import { PERIODO_LABEL, PERIODO_ICON } from "@/utils/buildRoteiro";
import type { DiaRoteiro, HotelBlock } from "@/utils/buildRoteiro";
import { RotatingBackground } from "@/components/RotatingBackground";

// ── Constants ─────────────────────────────────────────────────────────────────

const GOLD       = "#1B4F72";
const BG         = "#1A0E04";
const GLASS_CARD = "rgba(255,255,255,0.07)";
const GLASS_ITEM = "rgba(255,255,255,0.05)";
const BORDER     = "rgba(27,79,114,0.15)";
const ITINERARY_KEY = "@luckytrip/current_itinerary";

// ── Cinematic background (shared with all premium screens) ────────────────────

function CinematicBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: BG }]} />
      <RotatingBackground />
      <LinearGradient
        colors={["rgba(26,14,4,0.50)", "rgba(26,14,4,0.82)", BG]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

// ── Item navigation ───────────────────────────────────────────────────────────

function navigateToItem(item: SavedItem) {
  if (item.isExternal) {
    if (item.placeId) {
      Linking.openURL(`https://www.google.com/maps/place/?q=place_id:${item.placeId}`);
      return;
    }
    if (item.lat && item.lng) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`);
      return;
    }
    Alert.alert("Em breve disponível", "Este lugar ainda não tem página de detalhes.");
    return;
  }
  if (!item.id) {
    Alert.alert("Em breve disponível", "Este lugar ainda não tem página de detalhes.");
    return;
  }
  const table: SourceTable = item.source_table ?? sourceTableFromCategoria(item.categoria);
  if (table === "stay_hotels") {
    router.push({ pathname: "/ondeFicar/hotel/[hotelId]", params: { hotelId: item.id } });
    return;
  }
  router.push({
    pathname: "/lugar/[cityId]/[placeId]",
    params: {
      cityId:       "rio",
      placeId:      item.id,
      source_table: table,
      titulo:       item.titulo ?? "",
      localizacao:  item.localizacao ?? "",
    },
  });
}

// ── Travel time chip ──────────────────────────────────────────────────────────

type TravelData = { distance_km: number; travel_time_minutes: number };

// Convert total minutes → "HH:MM" (e.g. 14 → "00:14", 75 → "01:15")
function minsToHHMM(m: number): string {
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

// Subtract N minutes from a "HH:MM" string (floors at "00:00")
function subtractMins(timeStr: string, delta: number): string {
  const [hh, mm] = timeStr.split(":").map(Number);
  return minsToHHMM(Math.max(0, (hh ?? 0) * 60 + (mm ?? 0) - delta));
}

// ── Deslocamento row ── shows departure time, label, travel duration + distance
function DeslocamentoRow({
  travel,
  arrivalTime,
}: {
  travel:       TravelData;
  arrivalTime?: string;
}) {
  const departureTime = arrivalTime
    ? subtractMins(arrivalTime, travel.travel_time_minutes)
    : null;

  return (
    <View style={sc.deslocamentoRow}>
      {departureTime && (
        <Text style={sc.deslocamentoTime}>{departureTime}</Text>
      )}
      <View style={sc.deslocamentoDivider} />
      <Text style={sc.deslocamentoLabel}>Deslocamento</Text>
      <View style={{ flex: 1 }} />
      <Feather name="clock" size={9} color="rgba(255,255,255,0.25)" />
      <Text style={sc.deslocamentoMeta}>{minsToHHMM(travel.travel_time_minutes)}</Text>
      <Feather name="map-pin" size={9} color="rgba(255,255,255,0.25)" />
      <Text style={sc.deslocamentoMeta}>{travel.distance_km.toFixed(1)} km</Text>
    </View>
  );
}

// ── Placeholder image — reusable, consistent, no randomness ──────────────────
// Shown whenever photo_url is null. Same size as real image (parent controls).

function PlaceholderImage() {
  return (
    <View style={[StyleSheet.absoluteFill, sc.thumbPlaceholder]}>
      <Feather name="map-pin" size={14} color="rgba(27,79,114,0.22)" />
    </View>
  );
}

// ── Item thumbnail — single source of truth: photo_url string|null ────────────
// Accepts photo_url directly. Never accepts undefined — caller normalizes first.

function ItemThumb({ photoUrl }: { photoUrl: string | null }) {
  const [errored, setErrored] = React.useState(false);
  const imageSource: { uri: string } | null =
    !errored && typeof photoUrl === "string" && photoUrl.length > 0
      ? { uri: photoUrl }
      : null;
  return (
    <>
      {imageSource !== null ? (
        <Image
          source={imageSource}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <PlaceholderImage />
      )}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.32)"]}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}

// ── Period time helpers ────────────────────────────────────────────────────────

const PERIOD_START: Record<string, number> = {
  manha:  8,
  almoco: 12,
  tarde:  15,
  noite:  19,
};

function getItemTime(periodo: string, index: number): string {
  const base  = PERIOD_START[periodo] ?? 9;
  const hour  = base + Math.floor(index * 1.5);
  const clamp = Math.min(hour, 23);
  return `${String(clamp).padStart(2, "0")}:${index % 2 === 0 ? "00" : "30"}`;
}

// ── Day card ──────────────────────────────────────────────────────────────────

function DayCard({
  dia,
  onLayout,
}: {
  dia:       DiaRoteiro;
  onLayout?: (y: number) => void;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const allItems = dia.periodos.flatMap((p) => p.items);

  return (
    <View
      style={sc.dayCard}
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.y)}
    >
      <Pressable
        style={({ pressed }) => [sc.dayHeader, pressed && { opacity: 0.85 }]}
        onPress={() => setCollapsed((v) => !v)}
      >
        <View style={sc.dayBadge}>
          <Text style={sc.dayBadgeText}>DIA {dia.numero}</Text>
        </View>
        <Text style={sc.dayBairro} numberOfLines={1}>{dia.bairro}</Text>
        <Feather
          name={collapsed ? "chevron-down" : "chevron-up"}
          size={15}
          color="rgba(255,255,255,0.35)"
        />
      </Pressable>

      {collapsed && (
        <View style={sc.collapsedRow}>
          <Text style={sc.collapsedText}>
            {allItems.length} {allItems.length === 1 ? "lugar" : "lugares"}
          </Text>
        </View>
      )}

      {!collapsed && (
        <View style={sc.dayBody}>

          {/* ── Hotel block — fixed header before all periods ──────────────── */}
          {dia.hotel && (() => {
            const h = dia.hotel as HotelBlock;
            return (
              <Pressable
                style={({ pressed }) => [sc.hotelBlock, pressed && { opacity: 0.82 }]}
                onPress={() =>
                  navigateToItem({
                    id:           h.id,
                    titulo:       h.titulo,
                    localizacao:  h.localizacao,
                    categoria:    "hotel",
                    source_table: "stay_hotels",
                    image:        (h.image ?? null) as SavedItem["image"],
                  } as SavedItem)
                }
              >
                <View style={sc.hotelThumb}>
                  <ItemThumb photoUrl={(h as any).photo_url ?? null} />
                </View>
                <View style={sc.hotelInfo}>
                  <View style={sc.hotelBadge}>
                    <Feather name="home" size={9} color={GOLD} />
                    <Text style={sc.hotelBadgeText}>HOSPEDAGEM</Text>
                  </View>
                  <Text style={sc.hotelTitle} numberOfLines={2}>{h.titulo}</Text>
                  <Text style={sc.hotelBairro}  numberOfLines={1}>{h.localizacao}</Text>
                </View>
                <Feather name="chevron-right" size={13} color="rgba(255,255,255,0.30)" />
              </Pressable>
            );
          })()}

          {dia.periodos.map((periodo) => (
            <View key={periodo.periodo} style={sc.periodoSection}>
              <View style={sc.periodoHeader}>
                <Feather
                  name={PERIODO_ICON[periodo.periodo] as any}
                  size={11}
                  color={GOLD}
                />
                <Text style={sc.periodoLabel}>{PERIODO_LABEL[periodo.periodo]}</Text>
                <View style={sc.periodoDivider} />
              </View>

              {periodo.items.map((item, idx) => {
                // PART 7 — defensive guard: never render an item without an id
                if (!item || !item.id) return null;

                const travel     = (item as any).travel_from_previous as TravelData | undefined;
                const photoUrl   = ((item as any).photo_url as string | null) ?? null;

                return (
                  <React.Fragment key={`${item.source_table ?? item.categoria}_${item.id}_${idx}`}>
                    {travel && (
                      <DeslocamentoRow
                        travel={travel}
                        arrivalTime={(item as any).start_time}
                      />
                    )}
                    <Pressable
                      style={({ pressed }) => [sc.itemRow, pressed && { opacity: 0.78 }]}
                      onPress={() => navigateToItem(item)}
                    >
                      <View style={sc.timeCol}>
                        <Text style={sc.timeLabel}>
                          {(item as any).start_time ?? getItemTime(periodo.periodo, idx)}
                        </Text>
                      </View>

                      <View style={sc.connectorCol}>
                        <View style={sc.connectorDot} />
                        {idx < periodo.items.length - 1 && <View style={sc.connectorLine} />}
                      </View>

                      <View style={sc.itemCard}>
                        <View style={sc.thumb}>
                          <ItemThumb photoUrl={photoUrl} />
                        </View>
                        <View style={sc.itemInfo}>
                          <Text style={sc.itemTitle} numberOfLines={2}>{item.titulo}</Text>
                          <Text style={sc.itemBairro} numberOfLines={1}>
                            {item.localizacao || dia.bairro}
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={13} color="rgba(255,255,255,0.30)" />
                      </View>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ResultadoScreen() {
  const insets    = useSafeAreaInsets();
  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { currentItinerary, setCurrentItinerary } = useGuia();
  const scrollRef = useRef<ScrollView>(null);

  // Local copy of the itinerary — survives context race conditions
  const [itinerary, setItinerary] = useState<ItineraryResult | null>(
    currentItinerary ?? null,
  );
  const [loading, setLoading]     = useState<boolean>(!currentItinerary);
  const [dayOffsets, setDayOffsets] = useState<Record<number, number>>({});
  const [activeChip, setActiveChip] = useState<number | null>(null);

  // On mount: if context already has the data, use it immediately.
  // Otherwise load from AsyncStorage (guards against context race condition).
  useEffect(() => {
    if (currentItinerary) {
      setItinerary(currentItinerary);
      setLoading(false);
      return;
    }

    let cancelled = false;
    AsyncStorage.getItem(ITINERARY_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as ItineraryResult;
            setItinerary(parsed);
          } catch {
            // Corrupt data — leave itinerary null, show error state
          }
        }
      })
      .catch(() => { /* AsyncStorage unavailable — show error state */ })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Sync context updates into local state (e.g. after a new generation)
  useEffect(() => {
    if (currentItinerary) {
      setItinerary(currentItinerary);
      setLoading(false);
    }
  }, [currentItinerary]);

  function handleBack() {
    setCurrentItinerary(null);
    AsyncStorage.removeItem(ITINERARY_KEY).catch(() => {});
    router.back();
  }

  function handleDayChip(num: number) {
    setActiveChip(num);
    const y = dayOffsets[num] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={sc.root}>
        <CinematicBackground />
        <View style={[sc.centerContent, { paddingTop: topPad }]}>
          <ActivityIndicator size="large" color={GOLD} />
          <Text style={sc.loadingText}>Carregando roteiro…</Text>
        </View>
      </View>
    );
  }

  // ── No data state ──────────────────────────────────────────────────────────
  if (!itinerary) {
    return (
      <View style={sc.root}>
        <CinematicBackground />
        <View style={{ paddingTop: topPad }}>
          <Pressable style={sc.backBtn} onPress={handleBack} hitSlop={12}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
        </View>
        <View style={sc.centerContent}>
          <Feather name="map" size={40} color="rgba(27,79,114,0.40)" />
          <Text style={sc.emptyText}>Nenhum roteiro disponível.</Text>
          <Text style={sc.emptySubtext}>Gere um novo roteiro para começar.</Text>
          <Pressable style={sc.emptyBtn} onPress={handleBack}>
            <Text style={sc.emptyBtnText}>Voltar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  const { totalDays, totalItems } = itinerary.summary;

  return (
    <View style={[sc.root, { paddingBottom: bottomPad }]}>
      <CinematicBackground />
      {/* Header */}
      <View style={[sc.header, { paddingTop: topPad }]}>
        <Pressable style={sc.backBtn} onPress={handleBack} hitSlop={10}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Text style={sc.headerTitle}>Roteiro</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={sc.scroll}
        contentContainerStyle={sc.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={sc.hero}>
          <Text style={sc.heroEyebrow}>Rio de Janeiro</Text>
          <Text style={sc.heroTitle}>
            {totalDays} {totalDays === 1 ? "dia" : "dias"} no Rio
          </Text>
          <Text style={sc.heroMeta}>
            {totalItems} {totalItems === 1 ? "experiência curada" : "experiências curadas"}
          </Text>

          {/* Day chips */}
          {itinerary.days.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={sc.chipScroll}
              contentContainerStyle={sc.chipRow}
            >
              {itinerary.days.map((dia) => {
                const active = activeChip === dia.numero;
                return (
                  <Pressable
                    key={dia.numero}
                    style={({ pressed }) => [
                      sc.chip,
                      active && sc.chipActive,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => handleDayChip(dia.numero)}
                  >
                    <Text style={[sc.chipText, active && sc.chipTextActive]}>
                      Dia {dia.numero}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Day cards */}
        {itinerary.days.map((dia) => (
          <DayCard
            key={dia.numero}
            dia={dia}
            onLayout={(y) =>
              setDayOffsets((prev) => ({ ...prev, [dia.numero]: y }))
            }
          />
        ))}

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: BG,
    overflow:        "hidden",
  },
  centerContent: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            12,
    paddingHorizontal: 32,
  },

  // Header
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 20,
    paddingBottom:     12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    fontFamily:    "PlayfairDisplay_600SemiBold",
    fontSize:      17,
    color:         "#fff",
    letterSpacing: 0.4,
  },
  backBtn: {
    width:          36,
    height:         36,
    alignItems:     "center",
    justifyContent: "center",
  },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  // Loading
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize:   14,
    color:      "rgba(255,255,255,0.55)",
    marginTop:  12,
  },

  // Hero
  hero: {
    paddingVertical: 24,
    alignItems:      "center",
    gap:             4,
  },
  heroEyebrow: {
    fontFamily:    "Inter_400Regular",
    fontSize:      11,
    color:         GOLD,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontFamily:    "PlayfairDisplay_700Bold",
    fontSize:      30,
    color:         "#fff",
    letterSpacing: 0.3,
    marginTop:     4,
  },
  heroMeta: {
    fontFamily: "Inter_400Regular",
    fontSize:   13,
    color:      "rgba(255,255,255,0.55)",
    marginTop:  2,
  },

  // Day chips
  chipScroll: { marginTop: 16 },
  chipRow: {
    flexDirection:     "row",
    gap:               8,
    paddingHorizontal: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       "rgba(27,79,114,0.30)",
    backgroundColor:   "rgba(27,79,114,0.06)",
  },
  chipActive: {
    backgroundColor: GOLD,
    borderColor:     GOLD,
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize:   12,
    color:      "rgba(255,255,255,0.65)",
  },
  chipTextActive: {
    color: "#1A0E04",
  },

  // Day card
  dayCard: {
    backgroundColor: GLASS_CARD,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.12)",
    marginBottom:    12,
    overflow:        "hidden",
  },
  dayHeader: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  dayBadge: {
    backgroundColor:   "rgba(27,79,114,0.15)",
    borderRadius:      6,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  dayBadgeText: {
    fontFamily:    "Inter_600SemiBold",
    fontSize:      10,
    color:         GOLD,
    letterSpacing: 1.2,
  },
  dayBairro: {
    flex:       1,
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize:   15,
    color:      "#fff",
  },
  collapsedRow: {
    paddingHorizontal: 16,
    paddingBottom:     12,
  },
  collapsedText: {
    fontFamily: "Inter_400Regular",
    fontSize:   12,
    color:      "rgba(255,255,255,0.40)",
  },

  // Day body
  dayBody: {
    paddingBottom: 8,
  },

  // Period
  periodoSection: {
    paddingHorizontal: 16,
    paddingBottom:     8,
  },
  periodoHeader: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             6,
    paddingVertical: 10,
  },
  periodoLabel: {
    fontFamily:    "Inter_500Medium",
    fontSize:      11,
    color:         "rgba(255,255,255,0.60)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  periodoDivider: {
    flex:            1,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  // Item row
  itemRow: {
    flexDirection: "row",
    alignItems:    "flex-start",
    marginBottom:  10,
  },
  timeCol: {
    width:        42,
    paddingTop:   12,
    alignItems:   "flex-end",
    paddingRight: 6,
  },
  timeLabel: {
    fontFamily:    "Inter_400Regular",
    fontSize:      10,
    color:         "rgba(255,255,255,0.35)",
    letterSpacing: 0.3,
  },
  connectorCol: {
    width:       18,
    alignItems:  "center",
    paddingTop:  14,
    marginRight: 8,
  },
  connectorDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: GOLD,
  },
  connectorLine: {
    flex:            1,
    width:           1,
    backgroundColor: "rgba(27,79,114,0.25)",
    marginTop:       4,
    minHeight:       32,
  },
  itemCard: {
    flex:            1,
    flexDirection:   "row",
    alignItems:      "center",
    backgroundColor: GLASS_ITEM,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.10)",
    overflow:        "hidden",
    minHeight:       60,
    gap:             10,
    paddingRight:    10,
  },
  thumb: {
    width:           80,
    height:          56,
    backgroundColor: "rgba(0,0,0,0.35)",
    flexShrink:      0,
    overflow:        "hidden",
  },
  itemInfo: {
    flex:            1,
    paddingVertical: 10,
  },
  itemTitle: {
    fontFamily: "Inter_500Medium",
    fontSize:   13,
    color:      "#fff",
    lineHeight: 18,
  },
  itemBairro: {
    fontFamily: "Inter_400Regular",
    fontSize:   11,
    color:      "rgba(255,255,255,0.45)",
    marginTop:  2,
  },

  // Deslocamento row — first-class travel block between items
  deslocamentoRow: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               6,
    paddingHorizontal: 16,
    paddingVertical:   5,
    marginTop:         -2,
    marginBottom:      2,
    backgroundColor:   "rgba(255,255,255,0.03)",
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor:       "rgba(255,255,255,0.06)",
  },
  deslocamentoTime: {
    fontFamily:    "Inter_500Medium",
    fontSize:      10,
    color:         "rgba(255,255,255,0.38)",
    letterSpacing: 0.3,
    minWidth:      38,
  },
  deslocamentoDivider: {
    width:           1,
    height:          10,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginHorizontal: 2,
  },
  deslocamentoLabel: {
    fontFamily:    "Inter_400Regular",
    fontSize:      10,
    color:         "rgba(255,255,255,0.28)",
    letterSpacing: 0.4,
  },
  deslocamentoMeta: {
    fontFamily:    "Inter_400Regular",
    fontSize:      10,
    color:         "rgba(255,255,255,0.28)",
    letterSpacing: 0.3,
    marginLeft:    2,
  },

  // Image placeholder — shown when no photo_url from Supabase
  thumbPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "rgba(27,79,114,0.04)",
  },

  // Hotel block — rendered above period sections inside dayBody
  hotelBlock: {
    flexDirection:     "row",
    alignItems:        "center",
    marginHorizontal:  16,
    marginTop:         2,
    marginBottom:      8,
    backgroundColor:   "rgba(27,79,114,0.07)",
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       "rgba(27,79,114,0.22)",
    overflow:          "hidden",
    gap:               10,
    paddingRight:      10,
  },
  hotelThumb: {
    width:           76,
    height:          56,
    backgroundColor: "rgba(0,0,0,0.35)",
    flexShrink:      0,
    overflow:        "hidden",
  },
  hotelInfo: {
    flex:            1,
    paddingVertical: 10,
    gap:             2,
  },
  hotelBadge: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
    marginBottom:  2,
  },
  hotelBadgeText: {
    fontFamily:    "Inter_600SemiBold",
    fontSize:      9,
    color:         GOLD,
    letterSpacing: 1.4,
  },
  hotelTitle: {
    fontFamily: "Inter_500Medium",
    fontSize:   13,
    color:      "#fff",
    lineHeight: 18,
  },
  hotelBairro: {
    fontFamily: "Inter_400Regular",
    fontSize:   11,
    color:      "rgba(255,255,255,0.45)",
    marginTop:  1,
  },

  // Empty state
  emptyText: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize:   18,
    color:      "#fff",
    textAlign:  "center",
  },
  emptySubtext: {
    fontFamily: "Inter_400Regular",
    fontSize:   13,
    color:      "rgba(255,255,255,0.50)",
    textAlign:  "center",
  },
  emptyBtn: {
    marginTop:         8,
    paddingHorizontal: 28,
    paddingVertical:   12,
    borderRadius:      24,
    backgroundColor:   GOLD,
  },
  emptyBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   14,
    color:      "#1A0E04",
  },
});
