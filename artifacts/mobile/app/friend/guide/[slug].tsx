/**
 * friend/guide/[slug].tsx — Roteiro curado do friend (itinerary view)
 *
 * Data flow (all from Supabase, zero hardcoded):
 *   1. friend_guides       → guide metadata (via v_friend_guides_cards)
 *   2. friend_guide_days   → day headers ordered by day_number
 *   3. friend_guide_itinerary_items → chronological structure per day (includes preview_rank)
 *   4. friend_guide_places → entity data joined via place_id (includes source_table, source_id, place_canonical_id)
 *
 * Renders as a 7-day itinerary grouped by day, ordered by display_time
 * then item_order. Each item is pressable and navigates to its place card.
 *
 * Premium/preview logic:
 *   - Guide access_type=premium + user not premium → items without preview_rank (or rank > limit) are locked
 *   - Locked items show a teaser state; pressing navigates to subscription
 *   - Unlocked and all premium-user items navigate normally with from_guide_slug context
 */

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { supabase } from "@/lib/supabase";
import { useGuia } from "@/context/GuiaContext";

const GOLD  = "#1B4F72";
const CREAM = "#F5EDD6";
const RIO_BG = require("../../../assets/images/hero-rio.png");

// ── Period display config ─────────────────────────────────────────────────────

const PERIOD_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  morning:   "sunrise",
  lunch:     "coffee",
  afternoon: "sun",
  sunset:    "sunset",
  evening:   "moon",
  night:     "moon",
};

const PERIOD_LABEL: Record<string, string> = {
  morning:   "Manhã",
  lunch:     "Almoço",
  afternoon: "Tarde",
  sunset:    "Entardecer",
  evening:   "Noite",
  night:     "Noite",
};

function periodIcon(period: string): keyof typeof Feather.glyphMap {
  return PERIOD_ICON[period] ?? "clock";
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface GuideDetail {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  tagline: string | null;
  intro_text: string | null;
  city: string | null;
  suggested_days: number | null;
  access_type: string;
  preview_enabled: boolean;
  preview_items_limit: number;
  friend_display_name: string;
  friend_full_name: string;
  places_count: number;
  highlights_count: number;
}

interface ItineraryPlace {
  id: string;
  nome: string;
  bairro: string | null;
  categoria: string | null;
  photo_url: string | null;
  meu_olhar: string | null;
  source_table: string | null;
  source_id: string | null;
  place_canonical_id: string | null;
}

interface ItineraryItem {
  id: string;
  day_number: number;
  period: string;
  item_order: number;
  display_time: string | null;
  note: string | null;
  is_optional: boolean;
  preview_rank: number | null;
  place: ItineraryPlace;
}

interface ItineraryDay {
  day_number: number;
  title: string;
  description: string | null;
  items: ItineraryItem[];
}

// ── Guide context passed down to rows ─────────────────────────────────────────

interface GuideCtx {
  slug: string;
  isPremium: boolean;
  access_type: string;
  preview_enabled: boolean;
  preview_items_limit: number;
}

function isItemLocked(item: ItineraryItem, ctx: GuideCtx): boolean {
  if (ctx.access_type !== "premium") return false;
  if (ctx.isPremium) return false;
  if (!ctx.preview_enabled) return true;
  // Items with a valid preview_rank within the limit are freely accessible
  return item.preview_rank === null || item.preview_rank > ctx.preview_items_limit;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function FriendGuideScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets   = useSafeAreaInsets();
  const { isPremium } = useGuia();

  const [guide,   setGuide]   = useState<GuideDetail | null>(null);
  const [days,    setDays]    = useState<ItineraryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [introExpanded, setIntroExpanded] = useState(false);

  const overlayAnim = useRef(new Animated.Value(0)).current;
  function handleBgDisplay() {
    Animated.timing(overlayAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // ── 1. Guide metadata ──────────────────────────────────────────────
        const { data: guideData } = await supabase
          .from("v_friend_guides_cards")
          .select("id, slug, title, subtitle, tagline, intro_text, city, suggested_days, access_type, preview_enabled, preview_items_limit, friend_display_name, friend_full_name, places_count, highlights_count")
          .eq("slug", slug)
          .single();

        if (!guideData || cancelled) return;

        const guideId = guideData.id as string;

        // ── 2. Parallel fetch: days + items + places ────────────────────────
        const [{ data: daysData }, { data: itemsData }, { data: placesData }] = await Promise.all([
          supabase
            .from("friend_guide_days")
            .select("day_number, title, description")
            .eq("guide_id", guideId)
            .order("day_number"),

          supabase
            .from("friend_guide_itinerary_items")
            .select("id, day_number, period, item_order, display_time, note, is_optional, place_id, preview_rank")
            .eq("guide_id", guideId)
            .order("day_number")
            .order("display_time")
            .order("item_order"),

          supabase
            .from("friend_guide_places")
            .select("id, nome, bairro, categoria, photo_url, meu_olhar, source_table, source_id, place_canonical_id")
            .eq("guide_id", guideId),
        ]);

        if (cancelled) return;

        // ── 3. Build place lookup map ──────────────────────────────────────
        const placeMap: Record<string, ItineraryPlace> = {};
        for (const p of placesData ?? []) {
          placeMap[p.id] = p as ItineraryPlace;
        }

        // ── 4. Group items by day_number, join place ───────────────────────
        const itemsByDay: Record<number, ItineraryItem[]> = {};
        for (const raw of itemsData ?? []) {
          const place = placeMap[raw.place_id];
          if (!place) continue;              // skip orphaned items
          const item: ItineraryItem = {
            id:           raw.id,
            day_number:   raw.day_number,
            period:       raw.period,
            item_order:   raw.item_order,
            display_time: raw.display_time,
            note:         raw.note,
            is_optional:  raw.is_optional,
            preview_rank: raw.preview_rank ?? null,
            place,
          };
          if (!itemsByDay[raw.day_number]) itemsByDay[raw.day_number] = [];
          itemsByDay[raw.day_number].push(item);
        }

        // ── 5. Build final days array ──────────────────────────────────────
        const builtDays: ItineraryDay[] = (daysData ?? []).map((d) => ({
          day_number:  d.day_number,
          title:       d.title,
          description: d.description,
          items:       itemsByDay[d.day_number] ?? [],
        }));

        setGuide(guideData as GuideDetail);
        setDays(builtDays);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  // ── Loading / error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.loadingRoot}>
        <LinearGradient colors={["#2D1A08", "#1A0E04"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={GOLD} size="large" />
      </View>
    );
  }

  if (!guide) {
    return (
      <View style={s.loadingRoot}>
        <LinearGradient colors={["#2D1A08", "#1A0E04"]} style={StyleSheet.absoluteFill} />
        <Text style={s.errorText}>Roteiro não encontrado.</Text>
      </View>
    );
  }

  const topPad    = insets.top + 8;
  const bottomPad = insets.bottom + 56;

  const introTruncated = (guide.intro_text ?? "").length > 220 && !introExpanded;
  const introDisplay   = introTruncated
    ? (guide.intro_text ?? "").slice(0, 220).trim() + "…"
    : (guide.intro_text ?? "");

  const guideCtx: GuideCtx = {
    slug:                guide.slug,
    isPremium,
    access_type:         guide.access_type,
    preview_enabled:     guide.preview_enabled,
    preview_items_limit: guide.preview_items_limit ?? 0,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>

      {/* ── Warm amber base ── */}
      <LinearGradient
        colors={["#2D1A08", "#1A0E04"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── expo-image: crossfades to Rio background ── */}
      <ExpoImage
        source={RIO_BG}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#1A0E04" }]}
        contentFit="cover"
        transition={{ duration: 600, effect: "cross-dissolve" }}
        onDisplay={handleBgDisplay}
      />

      {/* ── Dark overlay fades in after image renders ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayAnim }]} pointerEvents="none">
        <LinearGradient
          colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.28)", "rgba(0,0,0,0.58)", "rgba(0,0,0,0.78)"]}
          locations={[0, 0.25, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── Scrollable content ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingTop: topPad, paddingBottom: bottomPad }]}
      >

        {/* Back */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.65 }]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={18} color="rgba(255,255,255,0.85)" />
        </Pressable>

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.eyebrow}>CURADORIA DE {guide.friend_display_name.toUpperCase()}</Text>
          {guide.tagline ? <Text style={s.tagline}>"{guide.tagline}"</Text> : null}
          <Text style={s.title}>{guide.title}</Text>
          {guide.subtitle ? <Text style={s.subtitle}>{guide.subtitle}</Text> : null}

          <View style={s.pillRow}>
            <View style={s.pill}>
              <Feather name="calendar" size={11} color={GOLD} />
              <Text style={s.pillText}>{days.length} dias</Text>
            </View>
            <View style={s.pill}>
              <Feather name="map-pin" size={11} color={GOLD} />
              <Text style={s.pillText}>{days.reduce((n, d) => n + d.items.length, 0)} lugares</Text>
            </View>
            {guide.city ? (
              <View style={s.pill}>
                <Feather name="compass" size={11} color={GOLD} />
                <Text style={s.pillText}>{guide.city}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Rule ── */}
        <View style={s.rule} />

        {/* ── Intro (glass card) ── */}
        {guide.intro_text ? (
          <View style={s.introCard}>
            <Text style={s.introQuote}>"</Text>
            <Text style={s.introText}>{introDisplay}</Text>
            {(guide.intro_text ?? "").length > 220 && (
              <Pressable onPress={() => setIntroExpanded((x) => !x)} style={s.introToggle}>
                <Text style={s.introToggleText}>{introExpanded ? "Ler menos" : "Ler mais"}</Text>
                <Feather name={introExpanded ? "chevron-up" : "chevron-down"} size={13} color={GOLD} />
              </Pressable>
            )}
            <Text style={s.introAuthor}>— {guide.friend_display_name}</Text>
          </View>
        ) : null}

        {/* ── 7-day itinerary ── */}
        <View style={s.daysWrap}>
          {days.map((day) => (
            <DayBlock key={day.day_number} day={day} guideCtx={guideCtx} />
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

// ── Day block ─────────────────────────────────────────────────────────────────

function DayBlock({ day, guideCtx }: { day: ItineraryDay; guideCtx: GuideCtx }) {
  return (
    <View style={d.wrap}>
      {/* Day header */}
      <View style={d.header}>
        <View style={d.dayNumWrap}>
          <Text style={d.dayNumLabel}>DIA</Text>
          <Text style={d.dayNum}>{day.day_number}</Text>
        </View>
        <View style={d.titleBlock}>
          <Text style={d.title}>{day.title}</Text>
          {day.description ? <Text style={d.desc}>{day.description}</Text> : null}
        </View>
      </View>

      {/* Items glass card */}
      <View style={d.card}>
        {day.items.map((item, idx) => (
          <ItemRow
            key={item.id}
            item={item}
            isLast={idx === day.items.length - 1}
            guideCtx={guideCtx}
          />
        ))}
        {day.items.length === 0 && (
          <View style={d.emptyRow}>
            <Text style={d.emptyText}>Nenhum item neste dia.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({ item, isLast, guideCtx }: { item: ItineraryItem; isLast: boolean; guideCtx: GuideCtx }) {
  const locked = isItemLocked(item, guideCtx);

  function handlePress() {
    if (locked) {
      // Navigate to subscription screen — preserve navigation stack
      router.push("/(tabs)/subscription");
      return;
    }

    // Entity resolution (Step 1→2 per spec):
    // 2A: source_table + source_id → open core Lucky Trip entity
    if (item.place.source_table && item.place.source_id) {
      router.push({
        pathname: "/lugar/[cityId]/[placeId]",
        params: {
          cityId:          "rio",
          placeId:         item.place.source_id,
          source_table:    item.place.source_table,
          from_guide_slug: guideCtx.slug,
        },
      });
      return;
    }

    // 2B: place_canonical_id present but no source resolved yet →
    //     fall through to friend-only entity (canonical resolver not yet built)
    // 2C: friend-only → render directly from friend_guide_places
    router.push({
      pathname: "/lugar/[cityId]/[placeId]",
      params: {
        cityId:          "rio",
        placeId:         item.place.id,
        source_table:    "friend_guide_places",
        from_guide_slug: guideCtx.slug,
      },
    });
  }

  const icon      = periodIcon(item.period);
  const timeLabel = item.display_time ?? PERIOD_LABEL[item.period] ?? item.period;

  if (locked) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [ir.wrap, !isLast && ir.separator, pressed && { backgroundColor: "rgba(255,255,255,0.03)" }]}
      >
        {/* Time column */}
        <View style={ir.timeCol}>
          <Feather name={icon} size={11} color={`${GOLD}55`} style={ir.periodIcon} />
          <Text style={[ir.time, { opacity: 0.4 }]}>{timeLabel}</Text>
        </View>

        {/* Info — teaser only, no meu_olhar exposed */}
        <View style={ir.info}>
          <View style={ir.lockedNameRow}>
            <Text style={[ir.name, { opacity: 0.38 }]} numberOfLines={2}>{item.place.nome}</Text>
            <Feather name="lock" size={11} color={`${GOLD}88`} style={{ marginTop: 3 }} />
          </View>
          {item.place.bairro ? (
            <Text style={[ir.bairro, { opacity: 0.28 }]}>{item.place.bairro}</Text>
          ) : null}
          <View style={ir.lockedBadge}>
            <Feather name="star" size={9} color={GOLD} />
            <Text style={ir.lockedBadgeText}>Exclusivo Lucky Premium</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  const thumbSrc = item.place.photo_url ? { uri: item.place.photo_url } : null;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [ir.wrap, !isLast && ir.separator, pressed && { backgroundColor: "rgba(255,255,255,0.04)" }]}
    >
      {/* Time column */}
      <View style={ir.timeCol}>
        <Feather name={icon} size={11} color={GOLD} style={ir.periodIcon} />
        <Text style={ir.time}>{timeLabel}</Text>
      </View>

      {/* Info */}
      <View style={ir.info}>
        <Text style={ir.name} numberOfLines={2}>{item.place.nome}</Text>
        {item.place.bairro ? <Text style={ir.bairro}>{item.place.bairro}</Text> : null}
        {item.note ? (
          <View style={ir.noteRow}>
            <View style={ir.noteLine} />
            <Text style={ir.noteText}>"{item.note}"</Text>
          </View>
        ) : item.place.meu_olhar ? (
          <View style={ir.noteRow}>
            <View style={ir.noteLine} />
            <Text style={ir.noteText}>"{item.place.meu_olhar}"</Text>
          </View>
        ) : null}
        {item.is_optional ? <Text style={ir.optional}>opcional</Text> : null}
      </View>

      {/* Thumbnail */}
      {thumbSrc ? (
        <ExpoImage
          source={thumbSrc}
          style={ir.thumb}
          contentFit="cover"
        />
      ) : (
        <Feather name="chevron-right" size={13} color="rgba(255,255,255,0.25)" />
      )}
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1A0E04",
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: "#1A0E04",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.55)",
  },
  content: {
    paddingHorizontal: 22,
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.32)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    alignSelf: "flex-start",
  },

  header: {
    gap: 10,
    marginBottom: 20,
  },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: GOLD,
    letterSpacing: 2.8,
  },
  tagline: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 15,
    color: "rgba(255,255,255,0.60)",
    lineHeight: 22,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: CREAM,
    lineHeight: 38,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.58)",
    lineHeight: 20,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: `${GOLD}12`,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: `${GOLD}28`,
  },
  pillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: GOLD,
  },

  rule: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 20,
  },

  introCard: {
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: 20,
    marginBottom: 20,
  },
  introQuote: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 44,
    color: GOLD,
    lineHeight: 36,
    marginBottom: 4,
    opacity: 0.55,
  },
  introText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.72)",
    lineHeight: 22,
    fontStyle: "italic",
  },
  introToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  introToggleText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: GOLD,
  },
  introAuthor: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: GOLD,
    marginTop: 14,
    letterSpacing: 0.3,
  },

  daysWrap: {
    gap: 28,
  },
});

// ── Day block styles ──────────────────────────────────────────────────────────

const d = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  dayNumWrap: {
    alignItems: "center",
    backgroundColor: `${GOLD}14`,
    borderWidth: 1,
    borderColor: `${GOLD}30`,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 44,
  },
  dayNumLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    color: GOLD,
    letterSpacing: 2,
  },
  dayNum: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: GOLD,
    lineHeight: 26,
  },
  titleBlock: {
    flex: 1,
    gap: 3,
    paddingTop: 4,
  },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 17,
    color: CREAM,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  desc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    lineHeight: 17,
    fontStyle: "italic",
  },
  card: {
    backgroundColor: "rgba(0,0,0,0.26)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  emptyRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
    fontStyle: "italic",
  },
});

// ── Item row styles ───────────────────────────────────────────────────────────

const ir = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: `${GOLD}12`,
  },

  timeCol: {
    alignItems: "center",
    gap: 4,
    width: 42,
    paddingTop: 2,
  },
  periodIcon: {
    opacity: 0.7,
  },
  time: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: GOLD,
    letterSpacing: 0.4,
    textAlign: "center",
  },

  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: CREAM,
    lineHeight: 20,
  },
  bairro: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.42)",
    letterSpacing: 0.2,
  },
  noteRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 6,
  },
  noteLine: {
    width: 2,
    backgroundColor: `${GOLD}48`,
    borderRadius: 1,
    alignSelf: "stretch",
    minHeight: 14,
  },
  noteText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 18,
    fontStyle: "italic",
  },
  optional: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.28)",
    fontStyle: "italic",
    marginTop: 3,
    letterSpacing: 0.3,
  },

  thumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    flexShrink: 0,
  },

  // Locked item styles
  lockedNameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    backgroundColor: `${GOLD}14`,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: `${GOLD}28`,
  },
  lockedBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: GOLD,
    letterSpacing: 0.4,
  },
});
