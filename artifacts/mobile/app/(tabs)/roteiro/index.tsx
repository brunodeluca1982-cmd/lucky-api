/**
 * roteiro/index.tsx
 *
 * Guided 5-step itinerary builder.
 * Each step appears as a glass modal over an atmospheric background.
 * Steps auto-advance on single-select; multi-select shows a CTA.
 *
 * Steps:
 *   0 — Destino       (confirm Rio, tap to begin)
 *   1 — Datas         (arrival + departure calendar, auto-advance on range)
 *   2 — Companhia     (solo/casal/amigos/família, auto-advance)
 *   3 — Inspiração    (multi-select, CTA)
 *   4 — Estilo        (budget, auto-advance → triggers generation)
 */

import React, { useEffect, useRef, useState } from "react";
import { RotatingBackground } from "@/components/RotatingBackground";
import { useRioHeroMedia } from "@/hooks/useHeroMedia";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  ImageSourcePropType,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useGuia, sourceTableFromCategoria } from "@/context/GuiaContext";
import type { SavedCategory, SavedItem, SourceTable } from "@/context/GuiaContext";
import { supabase } from "@/lib/supabase";
import { getNeighborhoodImage } from "@/data/neighborhoodImages";
import { getImageForEntity } from "@/utils/getImageForEntity";
import {
  buildItinerary,
  type Inspiration,
  type ItineraryPreferences,
  type ItineraryResult,
  type Vibe,
} from "@/utils/buildItinerary";
import { PERIODO_LABEL, PERIODO_ICON } from "@/utils/buildRoteiro";
import type { DiaRoteiro, PeriodoDia } from "@/utils/buildRoteiro";
import { useInspirationPhotos, type InspirationPhotoMap } from "@/hooks/useInspirationPhotos";
import { haversineKm, bairroCoord, formatTravel, walkMinutes } from "@/utils/haversine";
import { PlaceSearchModal, type SelectedPlace } from "@/components/PlaceSearchModal";

const C          = Colors.light;
const GOLD       = "#1B4F72";
const DARK_BROWN = "#FFFFFF";
const { width: SW } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────────────────────
// Types + static data
// ─────────────────────────────────────────────────────────────────────────────

type TravelVibe  = "solo" | "casal" | "amigos" | "família";
type BudgetStyle = "essencial" | "conforto" | "sofisticado";

const COMPANIONS: { id: TravelVibe; label: string; icon: string }[] = [
  { id: "solo",    label: "Solo",    icon: "user"  },
  { id: "casal",   label: "Casal",   icon: "heart" },
  { id: "amigos",  label: "Amigos",  icon: "users" },
  { id: "família", label: "Família", icon: "home"  },
];

const BUDGETS: { id: BudgetStyle; label: string; desc: string }[] = [
  { id: "essencial",   label: "Essencial",   desc: "Custo-benefício · experiências acessíveis" },
  { id: "conforto",    label: "Conforto",    desc: "Qualidade equilibrada · bom e bem feito" },
  { id: "sofisticado", label: "Sofisticado", desc: "Melhor do Rio · exclusivo e premium" },
];

const BUDGET_TO_VIBE: Record<BudgetStyle, Vibe> = {
  essencial:   "tranquilo",
  conforto:    "moderado",
  sofisticado: "intenso",
};

const CATEGORY_LABEL: Record<SavedCategory, string> = {
  oQueFazer:    "O Que Fazer",
  restaurante:  "Restaurante",
  hotel:        "Hotel",
  lucky:        "Lucky",
  atividade:    "Atividade",
  praia:        "Praia",
  compras:      "Compras",
  dica_secreta: "Dica Secreta",
  bar:          "Bar",
  cafe:         "Café",
};

// Result phase helpers — time labels, weather, travel connectors
const PERIODO_TIME: Record<string, number> = {
  manha:      9 * 60,
  almoco:     12 * 60 + 30,
  tarde:      14 * 60,
  jantar:     19 * 60 + 30,
  late_night: 21 * 60,
  noite:      19 * 60 + 30,
};

// ─── Rio de Janeiro fixed time anchors ────────────────────────────────────────
// Average year-round approximations (winter ~17:30, summer ~18:30 → midpoint 18:00).
// Future: replace with live weather/astronomy API without changing anchor logic.
const RIO_SUNSET_MINUTES  = 18 * 60; // 18:00
const RIO_SUNRISE_MINUTES =  6 * 60; // 06:00

// ─── Item signal detectors ────────────────────────────────────────────────────
// Title-based matching only — momento_ideal and tags_ia are not on the client
// type. Detection is conservative: only exact cultural phrases are matched.

function _isSunsetItem(t: string): boolean {
  return t.includes("pôr do sol") || t.includes("por do sol") ||
         t.includes("pôr-do-sol") || t.includes("sunset");
}

function _isSunriseItem(t: string): boolean {
  return t.includes("nascer do sol") || t.includes("nascer-do-sol") ||
         t.includes("amanhecer")     || t.includes("sunrise");
}

function _isTheaterItem(t: string): boolean {
  return t.includes("teatro")     || t.includes("show")      ||
         t.includes("concerto")   || t.includes("espetáculo") ||
         t.includes("espetaculo") || t.includes("ópera")     ||
         t.includes("opera")      || t.includes("ballet")    ||
         t.includes("peça");
}

function _isNightlifeBar(t: string, categoria: string): boolean {
  return t.includes("samba")   || t.includes("pagode")  ||
         t.includes("chorinho") || t.includes("baile")  ||
         t.includes("balada")   || t.includes("clube noturno") ||
         (t.includes(" bar ")   && categoria !== "restaurante");
}

// ─── Anchor time resolver ──────────────────────────────────────────────────────
// Returns a pinned time in minutes when the item matches a real-world anchor,
// or null when the item has no anchor (→ cumulative offset from base applies).
//
// Priority order:
//   1. Sunset    → sunset − 60 min  (only in "tarde")
//   2. Sunrise   → sunrise − 30 min (only in "manha")
//   3. Restaurant → 12:30 almoco / 20:00 noite
//   4. Theater   → 19:30 noite
//   5. Nightlife bar → 21:00 noite, ONLY when first item in the period

function _getAnchorTime(
  item:    { titulo: string; categoria: string },
  periodo: string,
  isFirst: boolean,
): number | null {
  const t = item.titulo.toLowerCase();
  if (_isSunsetItem(t)  && periodo === "tarde")  return RIO_SUNSET_MINUTES  - 60;
  if (_isSunriseItem(t) && periodo === "manha")  return RIO_SUNRISE_MINUTES - 30;
  if (item.categoria === "restaurante") {
    if (periodo === "almoco") return 12 * 60 + 30;
    if (periodo === "noite")  return 20 * 60;
  }
  if (_isTheaterItem(t)             && periodo === "noite") return 19 * 60 + 30;
  if (_isNightlifeBar(t, item.categoria) && periodo === "noite" && isFirst) return 21 * 60;
  return null;
}

function _fmt(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Parse duracao strings from Step F enrichment into minutes.
// Engine returns values like "30min", "45min", "1-2h", "2-3h", "3h+", "4h+".
function parseDuracao(dur: string | undefined | null): number {
  if (!dur) return 90;
  const s = dur.toLowerCase().trim();
  if (s.startsWith("30")) return 30;
  if (s.startsWith("45")) return 45;
  if (s.startsWith("1h") || s.startsWith("1-") || s === "1h") return 75;
  if (s.startsWith("1"))  return 60;
  if (s.startsWith("2h") || s.startsWith("2-")) return 135;
  if (s.startsWith("2"))  return 120;
  if (s.startsWith("3") || s.startsWith("4") || s.startsWith("5")) return 180;
  return 90;
}

// Returns the display time string for the idx-th item in a period block.
//
// Priority order:
//   1. Anchor-based override  — item matches a real-world time signal
//   2. Cumulative duration    — offset from the last anchor (or period base)
//
// "Sliding reference" pattern:
//   When an anchor is found at position k < idx, subsequent items accumulate
//   their durations from that anchor's START time + anchor's own duration.
//   This gives correct sequencing for arcs like:
//     Teatro 19:30 (anchor) → Samba 21:00 (19:30 + 90 min)
//   instead of a collision at 19:30 for both.
function getItemTime(
  periodo: string,
  items: SavedItem[],
  idx: number,
  overrides?: Record<string, number>,
): string {
  const dur = (item: SavedItem) =>
    overrides?.[item.id] ?? parseDuracao(item.duracao);

  let refMinutes = PERIODO_TIME[periodo] ?? 9 * 60;
  let refIdx     = -1;

  for (let i = 0; i <= idx; i++) {
    const anchor = _getAnchorTime(items[i], periodo, i === 0);
    if (anchor !== null) {
      if (i === idx) return _fmt(anchor);
      refMinutes = anchor;
      refIdx     = i;
    }
  }

  let elapsed = 0;
  if (refIdx >= 0) elapsed += dur(items[refIdx]);
  for (let i = Math.max(refIdx + 1, 0); i < idx; i++) {
    elapsed += dur(items[i]);
  }

  return _fmt(refMinutes + elapsed);
}

type WeatherIcon = "sun" | "cloud" | "wind";
const WEATHER_SEQ: WeatherIcon[] = ["sun", "sun", "cloud", "cloud", "cloud", "sun", "wind", "sun"];
function getDayWeather(dayNum: number): WeatherIcon {
  return WEATHER_SEQ[(dayNum - 1) % WEATHER_SEQ.length];
}

const GLASS_BG     = "rgba(255,255,255,0.15)";
const GLASS_HEADER = "rgba(0,0,0,0.42)";
const GLASS_BORDER = "rgba(255,255,255,0.22)";
const CREAM        = "#FFFFFF";

// ─────────────────────────────────────────────────────────────────────────────
// Calendar utilities
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const DAY_PT = ["D","S","T","Q","Q","S","S"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}
function isBeforeDay(a: Date, b: Date) {
  const norm = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return norm(a) < norm(b);
}
function isBetweenDays(d: Date, start: Date, end: Date) {
  const norm = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return norm(d) > norm(start) && norm(d) < norm(end);
}
function addMonths(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + n, 1);
  return d;
}
function calDays(month: Date): (Date | null)[] {
  const y = month.getFullYear(), m = month.getMonth();
  const first = new Date(y, m, 1).getDay();
  const total = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = Array(first).fill(null);
  for (let d = 1; d <= total; d++) cells.push(new Date(y, m, d));
  return cells;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inspiration cards data — image-based 3×2 grid
// ─────────────────────────────────────────────────────────────────────────────

const INSPIRATIONS_DATA: { id: Inspiration; label: string; image: ReturnType<typeof require> }[] = [
  { id: "natureza",   label: "Natureza",    image: require("@/assets/images/secret1.png") },
  { id: "gastronomy", label: "Gastronomia", image: require("@/assets/images/restaurante2.png") },
  { id: "culture",    label: "Cultura",     image: require("@/assets/images/cristo.png") },
  { id: "adventure",  label: "Aventura",    image: require("@/assets/images/pao-acucar.png") },
  { id: "beach",      label: "Relaxamento", image: require("@/assets/images/hotel1.png") },
  { id: "festa",      label: "Festa",       image: require("@/assets/images/lapa.png") },
];


// ─────────────────────────────────────────────────────────────────────────────
// Journey types
// ─────────────────────────────────────────────────────────────────────────────

interface JourneyGenerateProps {
  nights:       number;
  travelVibe:   TravelVibe;
  inspirations: Inspiration[];
  budget:       BudgetStyle;
  vibe:         Vibe;
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineCalendar — compact date picker rendered inline in the scroll view
// ─────────────────────────────────────────────────────────────────────────────

function InlineCalendar({
  value,
  minDate,
  onSelect,
  initialMonth,
}: {
  value: Date | null;
  minDate?: Date | null;
  onSelect: (d: Date) => void;
  initialMonth?: Date;
}) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(initialMonth ?? value ?? today);
  const days = calDays(viewMonth);
  const min  = minDate ?? today;

  return (
    <View style={fp.cal}>
      <View style={fp.calHeader}>
        <Pressable onPress={() => setViewMonth(addMonths(viewMonth, -1))} hitSlop={12}>
          <Feather name="chevron-left" size={18} color={CREAM} />
        </Pressable>
        <Text style={fp.calMonth}>
          {MONTH_PT[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </Text>
        <Pressable onPress={() => setViewMonth(addMonths(viewMonth, 1))} hitSlop={12}>
          <Feather name="chevron-right" size={18} color={CREAM} />
        </Pressable>
      </View>
      <View style={fp.calWeek}>
        {DAY_PT.map((d, i) => (
          <Text key={i} style={fp.calWeekDay}>{d}</Text>
        ))}
      </View>
      <View style={fp.calGrid}>
        {days.map((d, i) => {
          if (!d) return <View key={i} style={fp.calCell} />;
          const selected = value ? isSameDay(d, value) : false;
          const past = isBeforeDay(d, min) && !isSameDay(d, min);
          return (
            <Pressable
              key={i}
              style={[fp.calCell, selected && fp.calCellActive, past && fp.calCellPast]}
              onPress={() => !past && onSelect(d)}
              disabled={past}
            >
              <Text style={[
                fp.calDayText,
                selected && fp.calDayTextActive,
                past && fp.calDayTextPast,
              ]}>
                {d.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FlowPage1 — Destination (optional) + Dates
// ─────────────────────────────────────────────────────────────────────────────

interface FlowPage1Props {
  showDestination: boolean;
  destination: string;
  onDestinationChange: (v: string) => void;
  arrivalDate: Date | null;
  departureDate: Date | null;
  onArrivalChange: (d: Date) => void;
  onDepartureChange: (d: Date) => void;
  onNext: () => void;
}

function FlowPage1({
  showDestination,
  destination,
  onDestinationChange,
  arrivalDate,
  departureDate,
  onArrivalChange,
  onDepartureChange,
  onNext,
}: FlowPage1Props) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 72 : insets.top + 20;
  const [openCal, setOpenCal] = useState<"arrival" | "departure" | null>(null);
  const [deptInitMonth, setDeptInitMonth] = useState<Date | undefined>(undefined);

  function fmtDate(d: Date | null): string | null {
    if (!d) return null;
    return `${d.getDate()} de ${MONTH_PT[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
  }

  function handleArrival(d: Date) {
    onArrivalChange(d);
    // Open departure calendar on the same month as arrival
    setDeptInitMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setOpenCal("departure");
    // Clear departure if it's now before the new arrival
    if (departureDate && !isBeforeDay(d, departureDate)) {
      onDepartureChange(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    }
  }

  function handleDeparture(d: Date) {
    onDepartureChange(d);
    setOpenCal(null);
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[fp.page, { paddingTop: topPad, paddingBottom: 110 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={fp.bigTitle}>Criar roteiro</Text>
      <Text style={fp.bigSub}>Vamos organizar sua viagem em poucos passos.</Text>
      <View style={fp.divider} />

      {showDestination && (
        <View style={fp.section}>
          <Text style={fp.sectionLabel}>Vai pra onde?</Text>
          <View style={fp.searchRow}>
            <Feather name="search" size={16} color="rgba(255,255,255,0.50)" />
            <TextInput
              style={fp.searchInput}
              placeholder="Rio de Janeiro"
              placeholderTextColor="rgba(255,255,255,0.38)"
              value={destination}
              onChangeText={onDestinationChange}
              autoCorrect={false}
            />
          </View>
        </View>
      )}

      <View style={fp.section}>
        <Text style={fp.sectionLabel}>Quando será a viagem?</Text>
        <Text style={fp.sectionSub}>Informe as datas de chegada e partida. (Opcional)</Text>

        <Pressable
          style={[fp.dateField, openCal === "arrival" && fp.dateFieldActive]}
          onPress={() => setOpenCal(openCal === "arrival" ? null : "arrival")}
        >
          <Feather name="calendar" size={15} color="rgba(255,255,255,0.50)" />
          <Text style={[fp.dateFieldText, !arrivalDate && fp.dateFieldPlaceholder]}>
            {fmtDate(arrivalDate) ?? "Data de chegada"}
          </Text>
          <Feather
            name={openCal === "arrival" ? "chevron-up" : "chevron-down"}
            size={13}
            color="rgba(255,255,255,0.35)"
          />
        </Pressable>
        {openCal === "arrival" && (
          <InlineCalendar value={arrivalDate} onSelect={handleArrival} />
        )}

        <Pressable
          style={[fp.dateField, openCal === "departure" && fp.dateFieldActive]}
          onPress={() => setOpenCal(openCal === "departure" ? null : "departure")}
        >
          <Feather name="calendar" size={15} color="rgba(255,255,255,0.50)" />
          <Text style={[fp.dateFieldText, !departureDate && fp.dateFieldPlaceholder]}>
            {fmtDate(departureDate) ?? "Data de partida"}
          </Text>
          <Feather
            name={openCal === "departure" ? "chevron-up" : "chevron-down"}
            size={13}
            color="rgba(255,255,255,0.35)"
          />
        </Pressable>
        {openCal === "departure" && (
          <InlineCalendar
            value={departureDate}
            minDate={arrivalDate}
            onSelect={handleDeparture}
            initialMonth={deptInitMonth}
          />
        )}
      </View>

      <Pressable
        style={({ pressed }) => [fp.cta, pressed && { opacity: 0.85 }]}
        onPress={onNext}
      >
        <Text style={fp.ctaText}>Continuar</Text>
        <Feather name="chevron-right" size={17} color={C.darkBrown} />
      </Pressable>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FlowPage2 — Inspirations + Vibe + Budget
// ─────────────────────────────────────────────────────────────────────────────

interface FlowPage2Props {
  inspirations: Inspiration[];
  onToggleInspiration: (id: Inspiration) => void;
  travelVibe: TravelVibe;
  onTravelVibeChange: (v: TravelVibe) => void;
  budget: BudgetStyle;
  onBudgetChange: (b: BudgetStyle) => void;
  onBack: () => void;
  inspirationPhotos?: InspirationPhotoMap;
}

function FlowPage2({
  inspirations,
  onToggleInspiration,
  travelVibe,
  onTravelVibeChange,
  budget,
  onBudgetChange,
  onBack,
  inspirationPhotos = {},
}: FlowPage2Props) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 72 : insets.top + 20;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[fp.page, { paddingTop: topPad, paddingBottom: 110 }]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={fp.backRow} onPress={onBack} hitSlop={12}>
        <Feather name="chevron-left" size={20} color={CREAM} />
        <Text style={fp.backText}>Voltar</Text>
      </Pressable>

      <Text style={fp.bigTitle}>O que te inspira?</Text>
      <Text style={fp.bigSub}>
        Selecione o que você ama para personalizarmos seu roteiro
      </Text>

      <View style={fp.insGrid}>
        {INSPIRATIONS_DATA.map((ins) => {
          const active = inspirations.includes(ins.id);
          const photoUri = inspirationPhotos[ins.id];
          const imgSrc = photoUri ? { uri: photoUri } : ins.image;
          return (
            <Pressable
              key={ins.id}
              style={[fp.insCard, active && fp.insCardActive]}
              onPress={() => onToggleInspiration(ins.id)}
            >
              <Image source={imgSrc as ImageSourcePropType} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <LinearGradient
                colors={["rgba(0,0,0,0.06)", "rgba(0,0,0,0.68)"]}
                locations={[0, 1]}
                style={StyleSheet.absoluteFill}
              />
              {active && (
                <View style={fp.insCheck}>
                  <Feather name="check" size={11} color={GOLD} />
                </View>
              )}
              <Text style={fp.insLabel}>{ins.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={fp.glassSection}>
        <Text style={fp.glassSectionLabel}>Qual a vibe da viagem?</Text>
        <View style={fp.pillRow}>
          {COMPANIONS.map((c) => {
            const active = travelVibe === c.id;
            return (
              <Pressable
                key={c.id}
                style={[fp.pill, active && fp.pillActive]}
                onPress={() => onTravelVibeChange(c.id)}
              >
                <Feather
                  name={c.icon as any}
                  size={12}
                  color={active ? "rgba(0,0,0,0.70)" : "rgba(255,255,255,0.55)"}
                />
                <Text style={[fp.pillText, active && fp.pillTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={fp.glassSection}>
        <Text style={fp.glassSectionLabel}>Estilo da viagem — toque para criar o roteiro</Text>
        <View style={fp.pillRow}>
          {BUDGETS.map((b) => {
            const active = budget === b.id;
            return (
              <Pressable
                key={b.id}
                style={[fp.pill, active && fp.pillActive]}
                onPress={() => onBudgetChange(b.id)}
              >
                <Text style={[fp.pillText, active && fp.pillTextActive]}>{b.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TripFlow — coordinates the 2-page journey flow
// ─────────────────────────────────────────────────────────────────────────────

interface TripFlowProps {
  savedCount:   number;
  isContextual: boolean;
  onGenerate:   (p: JourneyGenerateProps) => void;
}

function TripFlow({ savedCount: _savedCount, isContextual: _isContextual, onGenerate }: TripFlowProps) {
  return <ContextualFlow onGenerate={onGenerate} />;
}

function StandardFlow({ onGenerate }: { onGenerate: (p: JourneyGenerateProps) => void }) {
  const [page,          setPage]          = useState(0);
  const [destination,   setDestination]   = useState("Rio de Janeiro");
  const [arrivalDate,   setArrivalDate]   = useState<Date | null>(null);
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [travelVibe,    setTravelVibe]    = useState<TravelVibe>("amigos");
  const [inspirations,  setInspirations]  = useState<Inspiration[]>([]);
  const [budget,        setBudget]        = useState<BudgetStyle>("conforto");
  const inspirationPhotos = useInspirationPhotos();

  function handleNext() { setPage(1); }
  function handleBack() { setPage(0); }

  function handleBudgetAndGenerate(b: BudgetStyle) {
    setBudget(b);
    const n =
      arrivalDate && departureDate
        ? Math.max(1, Math.round(
            (departureDate.getTime() - arrivalDate.getTime()) / 86400000,
          ))
        : 3;
    setTimeout(() => onGenerate({ nights: n, travelVibe, inspirations, budget: b, vibe: BUDGET_TO_VIBE[b] }), 300);
  }

  function toggleInspiration(id: Inspiration) {
    setInspirations((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return page === 0 ? (
    <FlowPage1
      showDestination
      destination={destination}
      onDestinationChange={setDestination}
      arrivalDate={arrivalDate}
      departureDate={departureDate}
      onArrivalChange={setArrivalDate}
      onDepartureChange={setDepartureDate}
      onNext={handleNext}
    />
  ) : (
    <FlowPage2
      inspirations={inspirations}
      onToggleInspiration={toggleInspiration}
      travelVibe={travelVibe}
      onTravelVibeChange={setTravelVibe}
      budget={budget}
      onBudgetChange={handleBudgetAndGenerate}
      onBack={handleBack}
      inspirationPhotos={inspirationPhotos}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ContextualFlow — step-based wizard for Viagem contextual entry
// Steps: 0 = Dates  1 = Company  2 = Interests  3 = Style/Budget
// ─────────────────────────────────────────────────────────────────────────────

function ContextualFlow({ onGenerate }: { onGenerate: (p: JourneyGenerateProps) => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 72 : insets.top + 20;

  const [step,          setStep]          = useState(0);
  const [arrivalDate,   setArrivalDate]   = useState<Date | null>(null);
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [openCal,       setOpenCal]       = useState<"arrival" | "departure" | null>(null);
  const [travelVibe,    setTravelVibe]    = useState<TravelVibe | null>(null);
  const [inspirations,  setInspirations]  = useState<Inspiration[]>([]);
  const [budget,        setBudget]        = useState<BudgetStyle | null>(null);
  const inspirationPhotos = useInspirationPhotos();

  function fmtDate(d: Date | null): string | null {
    if (!d) return null;
    return `${d.getDate()} de ${MONTH_PT[d.getMonth()].toLowerCase()}`;
  }

  function handleArrival(d: Date) {
    setArrivalDate(d);
    setOpenCal("departure");
    if (departureDate && !isBeforeDay(d, departureDate)) {
      setDepartureDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    }
  }

  function handleDeparture(d: Date) {
    setDepartureDate(d);
    setOpenCal(null);
    if (arrivalDate) setTimeout(() => setStep(1), 380);
  }

  function handleCompanion(v: TravelVibe) {
    setTravelVibe(v);
    setTimeout(() => setStep(2), 200);
  }

  function toggleInspiration(id: Inspiration) {
    setInspirations((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleBudget(b: BudgetStyle) {
    setBudget(b);
    const nights =
      arrivalDate && departureDate
        ? Math.max(1, Math.round((departureDate.getTime() - arrivalDate.getTime()) / 86400000))
        : 3;
    setTimeout(() => onGenerate({
      nights,
      travelVibe: travelVibe ?? "amigos",
      inspirations,
      budget: b,
      vibe: BUDGET_TO_VIBE[b],
    }), 300);
  }

  const STEP_LABELS = ["Datas", "Companhia", "Interesses", "Estilo"];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[fp.page, { paddingTop: topPad, paddingBottom: 110 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Progress indicators ── */}
      <View style={cf.stepRow}>
        {STEP_LABELS.map((_, i) => (
          <View
            key={i}
            style={[cf.stepDot, i === step && cf.stepDotActive, i < step && cf.stepDotDone]}
          >
            {i < step ? (
              <Feather name="check" size={10} color={C.darkBrown} />
            ) : (
              <Text style={[cf.stepNum, i === step && cf.stepNumActive]}>{i + 1}</Text>
            )}
          </View>
        ))}
      </View>

      {/* ══ Step 0: Dates ══ */}
      {step === 0 && (
        <>
          <Text style={fp.bigTitle}>Quando você vai?</Text>
          <Text style={fp.bigSub}>
            Selecione suas datas para montar o roteiro perfeito
          </Text>

          <View style={cf.dateRow}>
            <Pressable
              style={[cf.dateBtn, openCal === "arrival" && cf.dateBtnActive]}
              onPress={() => setOpenCal("arrival")}
            >
              <Feather name="calendar" size={14} color={arrivalDate ? GOLD : `${GOLD}55`} />
              <Text style={[cf.dateBtnText, arrivalDate && cf.dateBtnTextSet]}>
                {fmtDate(arrivalDate) ?? "Chegada"}
              </Text>
            </Pressable>
            <Feather name="arrow-right" size={14} color={`${GOLD}40`} />
            <Pressable
              style={[cf.dateBtn, openCal === "departure" && cf.dateBtnActive]}
              onPress={() => setOpenCal("departure")}
            >
              <Feather name="calendar" size={14} color={departureDate ? GOLD : `${GOLD}55`} />
              <Text style={[cf.dateBtnText, departureDate && cf.dateBtnTextSet]}>
                {fmtDate(departureDate) ?? "Saída"}
              </Text>
            </Pressable>
          </View>

          {openCal && (
            <InlineCalendar
              value={openCal === "arrival" ? arrivalDate : departureDate}
              minDate={openCal === "departure" && arrivalDate ? arrivalDate : new Date()}
              onSelect={openCal === "arrival" ? handleArrival : handleDeparture}
              initialMonth={
                openCal === "departure" && arrivalDate
                  ? new Date(arrivalDate.getFullYear(), arrivalDate.getMonth(), 1)
                  : undefined
              }
            />
          )}

          <Pressable style={cf.skipBtn} onPress={() => setStep(1)} hitSlop={12}>
            <Text style={cf.skipText}>Pular — usar datas flexíveis</Text>
          </Pressable>
        </>
      )}

      {/* ══ Step 1: Company ══ */}
      {step === 1 && (
        <>
          <Text style={fp.bigTitle}>Com quem você vai?</Text>
          <Text style={fp.bigSub}>
            Personalizamos o roteiro de acordo com a sua companhia
          </Text>

          <View style={cf.companionGrid}>
            {COMPANIONS.map((c) => (
              <Pressable
                key={c.id}
                style={[cf.companionCard, travelVibe === c.id && cf.companionCardActive]}
                onPress={() => handleCompanion(c.id)}
              >
                <Feather
                  name={c.icon as any}
                  size={26}
                  color={travelVibe === c.id ? GOLD : "rgba(255,255,255,0.55)"}
                />
                <Text style={[cf.companionLabel, travelVibe === c.id && cf.companionLabelActive]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* ══ Step 2: Interests ══ */}
      {step === 2 && (
        <>
          <Text style={fp.bigTitle}>O que te inspira?</Text>
          <Text style={fp.bigSub}>
            Selecione o que você ama para personalizarmos seu roteiro
          </Text>

          <View style={fp.insGrid}>
            {INSPIRATIONS_DATA.map((ins) => {
              const active = inspirations.includes(ins.id);
              const photoUri = inspirationPhotos[ins.id];
              const imgSrc = photoUri ? { uri: photoUri } : ins.image;
              return (
                <Pressable
                  key={ins.id}
                  style={[fp.insCard, active && fp.insCardActive]}
                  onPress={() => toggleInspiration(ins.id)}
                >
                  <Image source={imgSrc as ImageSourcePropType} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.35)"]}
                    locations={[0.25, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  {active && (
                    <View style={fp.insCheck}>
                      <Feather name="check" size={11} color={GOLD} />
                    </View>
                  )}
                  <Text style={fp.insLabel}>{ins.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {inspirations.length > 0 && (
            <Pressable style={fp.cta} onPress={() => setStep(3)}>
              <Text style={fp.ctaText}>Continuar</Text>
              <Feather name="chevron-right" size={17} color={C.darkBrown} />
            </Pressable>
          )}
        </>
      )}

      {/* ══ Step 3: Budget/Style ══ */}
      {step === 3 && (
        <>
          <Text style={fp.bigTitle}>Qual o estilo?</Text>
          <Text style={fp.bigSub}>
            Escolha o nível de conforto para a sua experiência no Rio
          </Text>

          <View style={cf.budgetGrid}>
            {BUDGETS.map((b) => (
              <Pressable
                key={b.id}
                style={[cf.budgetCard, budget === b.id && cf.budgetCardActive]}
                onPress={() => handleBudget(b.id)}
              >
                <Text style={[cf.budgetLabel, budget === b.id && cf.budgetLabelActive]}>
                  {b.label}
                </Text>
                <Text style={cf.budgetDesc}>{b.desc}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* ── Back nav (steps 1+) ── */}
      {step > 0 && (
        <Pressable
          style={[fp.backRow, { marginTop: 20 }]}
          onPress={() => setStep(step - 1)}
          hitSlop={12}
        >
          <Feather name="chevron-left" size={20} color={CREAM} />
          <Text style={fp.backText}>Voltar</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow page styles
// ─────────────────────────────────────────────────────────────────────────────

const fp = StyleSheet.create({
  page: {
    paddingHorizontal: 22,
  },

  bigTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 36,
    color: CREAM,
    lineHeight: 44,
    marginBottom: 10,
    marginTop: 8,
  },

  bigSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.56)",
    lineHeight: 22,
    marginBottom: 32,
  },

  divider: {
    height: 1,
    backgroundColor: GLASS_BORDER,
    marginBottom: 28,
  },

  section: {
    marginBottom: 24,
  },

  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: CREAM,
    marginBottom: 6,
  },

  sectionSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.42)",
    marginBottom: 12,
    lineHeight: 18,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GLASS_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },

  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: CREAM,
  },

  dateField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GLASS_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
    marginBottom: 10,
  },

  dateFieldActive: {
    borderColor: `${GOLD}70`,
  },

  dateFieldText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: CREAM,
  },

  dateFieldPlaceholder: {
    color: "rgba(255,255,255,0.38)",
  },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CREAM,
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 8,
    marginTop: 8,
  },

  ctaText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: C.darkBrown,
  },

  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 20,
  },

  backText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: CREAM,
  },

  insGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },

  insCard: {
    width: "47%",
    height: 128,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    justifyContent: "flex-end",
    padding: 12,
  },

  insCardActive: {
    borderColor: GOLD,
  },

  insLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  insCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },

  glassSection: {
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 20,
    marginBottom: 16,
  },

  glassSectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: CREAM,
    marginBottom: 16,
    letterSpacing: 0.2,
  },

  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  pillActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },

  pillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.78)",
    letterSpacing: 0.1,
  },

  pillTextActive: {
    color: "#000000",
    fontFamily: "Inter_600SemiBold",
  },

  // ── Inline Calendar ──────────────────────────────────────────────────────────
  cal: {
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 12,
    marginBottom: 10,
  },

  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  calMonth: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: CREAM,
  },

  calWeek: {
    flexDirection: "row",
    marginBottom: 4,
  },

  calWeekDay: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "rgba(255,255,255,0.40)",
  },

  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  calCell: {
    width: "14.285714285714286%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
  },

  calCellActive: {
    backgroundColor: GOLD,
  },

  calCellPast: {
    opacity: 0.25,
  },

  calDayText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: CREAM,
  },

  calDayTextActive: {
    color: C.darkBrown,
    fontFamily: "Inter_600SemiBold",
  },

  calDayTextPast: {
    color: "rgba(255,255,255,0.30)",
  },
});


// ─────────────────────────────────────────────────────────────────────────────
// ReplaceSheet — in-context item replacement overlay
// ─────────────────────────────────────────────────────────────────────────────

interface Suggestion {
  id: string;
  titulo: string;
  localizacao: string;
  image: ReturnType<typeof getNeighborhoodImage>;
  categoria: SavedCategory;
  /** Explicit Supabase table — always set for curated DB items. */
  source_table?: SourceTable;
  subtitle?: string;
}

interface ReplaceSheetProps {
  item:      SavedItem;
  diaNum:    number;
  onClose:   () => void;
  onReplace: (diaNum: number, itemId: string, newItem: SavedItem) => void;
}

function ReplaceSheet({ item, diaNum, onClose, onReplace }: ReplaceSheetProps) {
  const [suggestions,  setSuggestions]  = useState<Suggestion[]>([]);
  const [crossResults, setCrossResults] = useState<Suggestion[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [crossLoading, setCrossLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");

  useEffect(() => { fetchSuggestions(); }, [item.id]);

  // Cross-category internal DB search — fires at 2+ chars, finds ANY place in the DB
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) { setCrossResults([]); setCrossLoading(false); return; }
    setCrossLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [r1, r2, r3, r4] = await Promise.all([
          supabase.from("restaurantes").select("id,nome,bairro,especialidade,photo_url").ilike("nome", `%${q}%`).limit(6),
          supabase.from("o_que_fazer_rio").select("id,nome,bairro,categoria").ilike("nome", `%${q}%`).limit(6),
          supabase.from("lucky_list_rio").select("id,nome,bairro,tipo").ilike("nome", `%${q}%`).limit(4),
          supabase.from("stay_hotels").select("id,nome,bairro,categoria").ilike("nome", `%${q}%`).limit(4),
        ]);
        const rows: Suggestion[] = [
          ...(r1.data ?? []).map((r: Record<string, unknown>) => ({
            id: String(r.id), titulo: (r.nome as string) || "", localizacao: (r.bairro as string) || "",
            image: getImageForEntity("restaurant", (r.nome as string) || "", (r.bairro as string) || "", (r.photo_url as string | null) ?? null),
            categoria: "restaurante" as SavedCategory,
            source_table: "restaurantes" as SourceTable,
            subtitle: (r.especialidade as string) ?? "Restaurante",
          })),
          ...(r2.data ?? []).map((r: Record<string, unknown>) => ({
            id: String(r.id), titulo: (r.nome as string) || "", localizacao: (r.bairro as string) || "",
            image: getNeighborhoodImage((r.bairro as string) || ""), categoria: "oQueFazer" as SavedCategory,
            source_table: "o_que_fazer_rio" as SourceTable,
            subtitle: (r.categoria as string) ?? "O que fazer",
          })),
          ...(r3.data ?? []).map((r: Record<string, unknown>) => ({
            id: String(r.id), titulo: (r.nome as string) || "", localizacao: (r.bairro as string) || "",
            image: getNeighborhoodImage((r.bairro as string) || ""), categoria: "lucky" as SavedCategory,
            source_table: "lucky_list_rio" as SourceTable,
            subtitle: (r.tipo as string) ?? "Lucky",
          })),
          ...(r4.data ?? []).map((r: Record<string, unknown>) => ({
            id: String(r.id), titulo: (r.nome as string) || "", localizacao: (r.bairro as string) || "",
            image: getNeighborhoodImage((r.bairro as string) || ""), categoria: "hotel" as SavedCategory,
            source_table: "stay_hotels" as SourceTable,
            subtitle: (r.categoria as string) ?? "Hotel",
          })),
        ];
        setCrossResults(rows);
      } catch { setCrossResults([]); }
      setCrossLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);


  async function fetchSuggestions() {
    setLoading(true);
    try {
      let rows: Suggestion[] = [];

      if (item.categoria === "restaurante") {
        const { data } = await supabase
          .from("restaurantes")
          .select("id, nome, bairro, especialidade, categoria, photo_url")
          .eq("ativo", true)
          .limit(14);
        rows = (data ?? []).map((r: Record<string, unknown>) => ({
          id:           String(r.id),
          titulo:       (r.nome as string) || "Restaurante",
          localizacao:  (r.bairro as string) || "",
          image:        getImageForEntity("restaurant", (r.nome as string) || "", (r.bairro as string) || "", (r.photo_url as string | null) ?? null),
          categoria:    "restaurante" as SavedCategory,
          source_table: "restaurantes" as SourceTable,
          subtitle:     (r.especialidade as string) ?? (r.categoria as string) ?? undefined,
        }));
      } else if (item.categoria === "lucky") {
        const { data } = await supabase
          .from("lucky_list_rio")
          .select("id, nome, bairro, tipo")
          .limit(14);
        rows = (data ?? []).map((r: Record<string, unknown>) => ({
          id:           String(r.id),
          titulo:       (r.nome as string) || "Lucky pick",
          localizacao:  (r.bairro as string) || "",
          image:        getNeighborhoodImage((r.bairro as string) || ""),
          categoria:    "lucky" as SavedCategory,
          source_table: "lucky_list_rio" as SourceTable,
          subtitle:     (r.tipo as string) ?? undefined,
        }));
      } else {
        const { data } = await supabase
          .from("o_que_fazer_rio")
          .select("id, nome, bairro, categoria")
          .limit(14);
        rows = (data ?? []).map((r: Record<string, unknown>) => ({
          id:           String(r.id),
          titulo:       (r.nome as string) || "Experiência",
          localizacao:  (r.bairro as string) || "",
          image:        getNeighborhoodImage((r.bairro as string) || ""),
          categoria:    "oQueFazer" as SavedCategory,
          source_table: "o_que_fazer_rio" as SourceTable,
          subtitle:     (r.categoria as string) ?? undefined,
        }));
      }

      // Exclude the current item; prefer same bairro
      const same  = rows.filter((r) => r.localizacao === item.localizacao && r.id !== item.id);
      const other = rows.filter((r) => r.localizacao !== item.localizacao && r.id !== item.id);
      setSuggestions([...same, ...other]);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  const q = searchQuery.trim();

  // Internal DB results (filtered by query when searching, else show all suggestions)
  const localFiltered = q
    ? suggestions.filter(
        (s) =>
          s.titulo.toLowerCase().includes(q.toLowerCase()) ||
          s.localizacao.toLowerCase().includes(q.toLowerCase()),
      )
    : suggestions;

  // Cross-category DB results — deduplicate against localFiltered
  const crossDeduped = crossResults.filter(
    (c) => !localFiltered.some((l) => l.titulo === c.titulo),
  );

  /**
   * On confirm: create a fully-hydrated SavedItem from the curated DB suggestion
   * and pass it up to the roteiro context.
   */
  async function confirmReplace(sug: Suggestion) {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      const newItem: SavedItem = {
        id:           sug.id,
        titulo:       sug.titulo,
        localizacao:  sug.localizacao,
        image:        sug.image,
        categoria:    sug.categoria,
        source_table: sug.source_table ?? sourceTableFromCategoria(sug.categoria),
      };
      onReplace(diaNum, item.id, newItem);
      onClose();
    } finally {
      setIsConfirming(false);
    }
  }

  /** Render a single curated suggestion card */
  function renderSugCard(sug: Suggestion) {
    return (
      <Pressable
        key={sug.id}
        style={({ pressed }) => [rs.sugCard, (pressed || isConfirming) && { opacity: 0.75 }]}
        onPress={() => confirmReplace(sug)}
        disabled={isConfirming}
      >
        <View style={rs.sugThumb}>
          <Image source={sug.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.35)"]}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={rs.sugInfo}>
          <Text style={rs.sugName} numberOfLines={1}>{sug.titulo}</Text>
          <View style={rs.sugLocRow}>
            <Feather name="map-pin" size={9} color={`${GOLD}80`} />
            <Text style={rs.sugLoc} numberOfLines={1}>{sug.localizacao}</Text>
          </View>
          {sug.subtitle ? (
            <View style={rs.sugBadge}>
              <Text style={rs.sugBadgeText}>{sug.subtitle}</Text>
            </View>
          ) : null}
        </View>
        <View style={rs.useBtn}>
          {isConfirming
            ? <Feather name="loader" size={11} color="#000" />
            : <Text style={rs.useBtnText}>Usar</Text>}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={rs.overlay}>
      {/* Header */}
      <View style={rs.header}>
        <Pressable
          style={({ pressed }) => [rs.headerBtn, pressed && { opacity: 0.65 }]}
          onPress={onClose}
          disabled={isConfirming}
        >
          <Feather name="arrow-left" size={18} color={CREAM} />
        </Pressable>
        <View style={rs.headerCenter}>
          <Text style={rs.headerTitle}>Substituir lugar</Text>
          <Text style={rs.headerSub} numberOfLines={1}>{item.titulo}</Text>
        </View>
        <View style={rs.headerBtn} />
      </View>

      {/* Search bar */}
      <View style={rs.searchRow}>
        <Feather name="search" size={14} color={`${GOLD}80`} style={rs.searchIcon} />
        <TextInput
          style={rs.searchInput}
          placeholder="Buscar qualquer lugar no Rio…"
          placeholderTextColor="rgba(255,255,255,0.30)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
            <Feather name="x" size={14} color={`${GOLD}80`} />
          </Pressable>
        )}
      </View>

      {/* Suggestions list */}
      {loading ? (
        <View style={rs.loadingRow}>
          <Feather name="loader" size={20} color={GOLD} />
          <Text style={rs.loadingText}>Buscando opções…</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={rs.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Internal DB results ─── */}
          {localFiltered.length > 0 && (
            <>
              <View style={rs.sectionLabelRow}>
                <Text style={rs.sectionLabel}>
                  {q ? "✦ Na sua lista" : "✦ Sugestões para substituir"}
                </Text>
              </View>
              {localFiltered.map(renderSugCard)}
            </>
          )}

          {/* ── Cross-category DB results ─── */}
          {q.length >= 2 && crossDeduped.length > 0 && (
            <>
              <View style={rs.sectionLabelRow}>
                <Text style={rs.sectionLabel}>✦ Outros lugares no Rio</Text>
                {crossLoading && <Text style={rs.sectionLabelSub}>buscando…</Text>}
              </View>
              {crossDeduped.map(renderSugCard)}
            </>
          )}

          {/* ── Curated empty state — shown when search has results to offer ─── */}
          {q.length >= 2 && localFiltered.length === 0 && crossDeduped.length === 0 && !crossLoading && (
            <View style={rs.emptyState}>
              <Feather name="search" size={24} color={`${GOLD}50`} />
              <Text style={rs.emptyText}>Nenhum lugar encontrado na nossa curadoria</Text>
              <Text style={rs.emptySub}>Tente outro nome ou categoria</Text>
            </View>
          )}

          {/* ── Prompt: no query entered yet ── */}
          {q.length < 2 && localFiltered.length === 0 && !loading && (
            <View style={rs.emptyState}>
              <Feather name="search" size={24} color={`${GOLD}50`} />
              <Text style={rs.emptyText}>Nenhum lugar encontrado</Text>
              <Text style={rs.emptySub}>Digite o nome de qualquer lugar no Rio</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const rs = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    zIndex: 100,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
    gap: 12,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(27,79,114,0.10)",
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 17,
    color: CREAM,
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: CREAM,
    padding: 0,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: `${GOLD}90`,
    letterSpacing: 0.8,
  },
  sectionLabelSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.40)",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 40,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    gap: 10,
  },
  sugCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 12,
  },
  sugThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.35)",
    flexShrink: 0,
  },
  sugInfo: {
    flex: 1,
    gap: 4,
  },
  sugName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: CREAM,
    lineHeight: 17,
  },
  sugLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sugLoc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    flex: 1,
  },
  sugBadge: {
    backgroundColor: "rgba(27,79,114,0.10)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.18)",
    alignSelf: "flex-start",
  },
  sugBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: `${GOLD}CC`,
  },
  useBtn: {
    backgroundColor: "rgba(27,79,114,0.16)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 0,
  },
  useBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: GOLD,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 60,
  },
  emptyText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "rgba(255,255,255,0.50)",
  },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.30)",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen header
// ─────────────────────────────────────────────────────────────────────────────

function ScreenHeader({
  phase,
  onBack,
  onShare,
}: {
  phase: "journey" | "loading" | "result";
  onBack: () => void;
  onShare?: () => void;
}) {
  if (phase === "journey") return null;

  const isResult = phase === "result";

  return (
    <View style={hd.wrap}>
      <Pressable
        style={({ pressed }) => [hd.btn, pressed && { opacity: 0.65 }]}
        onPress={onBack}
        hitSlop={10}
      >
        <Feather name="arrow-left" size={18} color={isResult ? CREAM : C.darkBrown} />
      </Pressable>

      <View style={hd.center}>
        <Text style={[hd.title, isResult && hd.titleLight]}>
          {isResult ? "Roteiro inteligente" : "Criando roteiro…"}
        </Text>
        <Text style={[hd.sub, isResult && hd.subLight]}>Rio de Janeiro</Text>
      </View>

      {isResult ? (
        <Pressable
          style={({ pressed }) => [hd.btn, pressed && { opacity: 0.65 }]}
          onPress={onShare}
          hitSlop={10}
        >
          <Feather name="share" size={18} color={CREAM} />
        </Pressable>
      ) : (
        <View style={hd.btn} />
      )}
    </View>
  );
}

const hd = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(20,10,5,0.42)",
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 17,
    color: C.darkBrown,
  },
  titleLight: {
    color: CREAM,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.warmGray,
    marginTop: 1,
  },
  subLight: {
    color: "rgba(255,255,255,0.45)",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Loading phase — premium animated loader
// ─────────────────────────────────────────────────────────────────────────────

function LoadingPhase() {
  const dot0 = useRef(new Animated.Value(0.3)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dots = [dot0, dot1, dot2];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 260),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.delay((dots.length - i - 1) * 260),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={sc.loadingWrap}>
      <View style={sc.loadingIconRing}>
        <Feather name="zap" size={22} color={GOLD} />
      </View>
      <Text style={sc.loadingText}>Estamos organizando sua viagem</Text>
      <Text style={sc.loadingSubText}>Selecionando as melhores experiências para você</Text>
      <View style={sc.loadingDots}>
        {dots.map((dot, i) => (
          <Animated.View key={i} style={[sc.loadingDot, { opacity: dot }]} />
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add-item menu — "+" button per day → 7 options sheet
// ─────────────────────────────────────────────────────────────────────────────

interface AddItemMenuProps {
  diaNum:        number;
  onClose:       () => void;
  onPickCategory:(categoria: SavedCategory) => void;
  onTempoLivre:  () => void;
  onVoltarHotel: () => void;
  onSugerir:     () => void;
  onManual:      () => void;
}

const ADD_MENU_OPTIONS: {
  id: string;
  label: string;
  icon: string;
  danger?: boolean;
}[] = [
  { id: "atrativo",   label: "Atrativo",              icon: "star"     },
  { id: "gastronomia",label: "Gastronomia",            icon: "coffee"   },
  { id: "tour",       label: "Tour com agência",       icon: "compass"  },
  { id: "manual",     label: "Adicionar manualmente",  icon: "edit-3"   },
  { id: "livre",      label: "Tempo livre",            icon: "sunset"   },
  { id: "hotel",      label: "Voltar ao hotel",        icon: "home"     },
  { id: "sugerir",    label: "Sugerir automaticamente",icon: "zap"      },
];

function AddItemMenu({
  diaNum, onClose, onPickCategory, onTempoLivre, onVoltarHotel, onSugerir, onManual,
}: AddItemMenuProps) {
  function handleOption(id: string) {
    if (id === "atrativo")    { onPickCategory("oQueFazer"); onClose(); return; }
    if (id === "gastronomia") { onPickCategory("restaurante"); onClose(); return; }
    if (id === "tour")        { onPickCategory("lucky"); onClose(); return; }
    if (id === "manual")      { onManual(); onClose(); return; }
    if (id === "livre")       { onTempoLivre(); onClose(); return; }
    if (id === "hotel")       { onVoltarHotel(); onClose(); return; }
    if (id === "sugerir")     { onSugerir(); onClose(); return; }
  }

  return (
    <View style={am.overlay} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={am.sheet}>
        <View style={am.handle} />
        <Text style={am.title}>Adicionar ao Dia {diaNum}</Text>

        {ADD_MENU_OPTIONS.map((opt) => (
          <Pressable
            key={opt.id}
            style={({ pressed }) => [am.option, pressed && { opacity: 0.75 }]}
            onPress={() => handleOption(opt.id)}
          >
            <View style={am.optIcon}>
              <Feather name={opt.icon as any} size={16} color={GOLD} />
            </View>
            <Text style={am.optLabel}>{opt.label}</Text>
            <Feather name="chevron-right" size={14} color={`${GOLD}50`} />
          </Pressable>
        ))}

        <Pressable onPress={onClose} style={am.closeBtn}>
          <Feather name="x" size={18} color="rgba(255,255,255,0.50)" />
        </Pressable>
      </View>
    </View>
  );
}

const am = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
    zIndex: 92,
  },
  sheet: {
    backgroundColor: "#15120E",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: "rgba(27,79,114,0.22)",
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 32,
    gap: 2,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignSelf: "center",
    marginBottom: 10,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: `${GOLD}B0`,
    letterSpacing: 1.1,
    marginBottom: 8,
    textAlign: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  optIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(27,79,114,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  optLabel: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#F5EFE0",
  },
  closeBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Item menu sheet — tap on itinerary item → info + 4 actions
// ─────────────────────────────────────────────────────────────────────────────

interface ItemMenuSheetProps {
  item:         SavedItem;
  diaNum:       number;
  onClose:      () => void;
  onReplace:    () => void;
  onDelete:     () => void;
  onShare:      () => void;
  onSeeDetails: () => void;
}

function ItemMenuSheet({
  item, diaNum, onClose, onReplace, onDelete, onShare, onSeeDetails,
}: ItemMenuSheetProps) {
  return (
    <View style={ms.overlay} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={ms.sheet}>
        <View style={ms.handle} />

        {/* Info row */}
        <View style={ms.info}>
          <View style={ms.infoThumb}>
            <ItemThumb image={item.image} categoria={item.categoria} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ms.infoEyebrow}>DIA {diaNum}</Text>
            <Text style={ms.infoTitle} numberOfLines={2}>{item.titulo}</Text>
            {item.localizacao ? (
              <View style={ms.infoLocRow}>
                <Feather name="map-pin" size={10} color={`${GOLD}90`} />
                <Text style={ms.infoLoc} numberOfLines={1}>{item.localizacao}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [ms.seeDetails, pressed && { opacity: 0.80 }]}
          onPress={onSeeDetails}
        >
          <Feather name="external-link" size={13} color={GOLD} />
          <Text style={ms.seeDetailsText}>Ver detalhes</Text>
        </Pressable>

        {/* Primary CTA */}
        <Pressable
          style={({ pressed }) => [ms.primaryCta, pressed && { opacity: 0.85 }]}
          onPress={() => {
            Alert.alert(
              "Em breve",
              "A compra de ingresso estará disponível em breve.",
            );
          }}
        >
          <Feather name="tag" size={14} color="#1A1109" />
          <Text style={ms.primaryCtaText}>Comprar ingresso</Text>
        </Pressable>

        {/* Secondary actions */}
        <View style={ms.actionsCol}>
          <Pressable
            style={({ pressed }) => [ms.action, pressed && { opacity: 0.75 }]}
            onPress={onShare}
          >
            <Feather name="share-2" size={15} color={GOLD} />
            <Text style={ms.actionText}>Compartilhar atração</Text>
            <Feather name="chevron-right" size={14} color={`${GOLD}50`} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [ms.action, pressed && { opacity: 0.75 }]}
            onPress={onReplace}
          >
            <Feather name="refresh-cw" size={15} color={GOLD} />
            <Text style={ms.actionText}>Substituir atração</Text>
            <Feather name="chevron-right" size={14} color={`${GOLD}50`} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [ms.action, pressed && { opacity: 0.75 }]}
            onPress={() => {
              Alert.alert(
                "Remover atração",
                `Remover "${item.titulo}" do Dia ${diaNum}?`,
                [
                  { text: "Cancelar", style: "cancel" },
                  { text: "Remover", style: "destructive", onPress: onDelete },
                ],
              );
            }}
          >
            <Feather name="trash-2" size={15} color="#E85C5C" />
            <Text style={[ms.actionText, { color: "#E85C5C" }]}>Excluir</Text>
            <Feather name="chevron-right" size={14} color="#E85C5C60" />
          </Pressable>
        </View>

        <Pressable onPress={onClose} style={ms.closeBtn}>
          <Text style={ms.closeText}>Fechar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const ms = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
    zIndex: 90,
  },
  sheet: {
    backgroundColor: "#15120E",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: "rgba(27,79,114,0.22)",
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignSelf: "center",
    marginBottom: 6,
  },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  infoThumb: {
    width: 70,
    height: 70,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  infoEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: `${GOLD}B0`,
    letterSpacing: 1.1,
  },
  infoTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: "#F5EFE0",
    lineHeight: 20,
    marginTop: 2,
  },
  infoLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  infoLoc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    flex: 1,
  },
  seeDetails: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.22)",
    backgroundColor: "rgba(27,79,114,0.06)",
  },
  seeDetailsText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: GOLD,
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: GOLD,
  },
  primaryCtaText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#1A1109",
    letterSpacing: 0.3,
  },
  actionsCol: {
    gap: 2,
    marginTop: 4,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  actionText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#F5EFE0",
  },
  closeBtn: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 4,
  },
  closeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Result phase — day-by-day itinerary
// ─────────────────────────────────────────────────────────────────────────────

interface ResultPhaseProps {
  result:          ItineraryResult;
  hotelItem:       SavedItem | null;
  /** Supabase-fetched fallback shown when no hotel is in saved places. */
  suggestedHotel?: SavedItem | null;
  totalPlaces:     number;
  editMode:        boolean;
  onToggleEdit:    () => void;
  onReplaceItem:   (diaNum: number, itemId: string, newItem: SavedItem) => void;
  onOpenItemMenu:  (diaNum: number, item: SavedItem) => void;
  onAddItem:       (diaNum: number) => void;
  onShareResult:   () => void;
  onExport:        () => void;
  isExporting:     boolean;
  scrollRef:       React.RefObject<ScrollView>;
}

// Rough per-person cost estimate derived from vibe + item counts.
// Numbers are per-night hotel, per-meal, per-activity in BRL.
function estimateCost(result: ItineraryResult): {
  low: number; high: number; perDayLow: number; perDayHigh: number;
} {
  const vibe: Vibe = result.preferences?.vibe ?? "moderado";
  const days   = Math.max(1, result.summary.totalDays);
  const nights = Math.max(0, days - 1);

  const HOTEL: Record<Vibe, [number, number]> = {
    tranquilo: [180, 320],
    moderado:  [400, 750],
    intenso:   [900, 2200],
  };
  const MEAL: Record<Vibe, [number, number]> = {
    tranquilo: [40, 80],
    moderado:  [100, 180],
    intenso:   [250, 550],
  };
  const ACTIVITY: Record<Vibe, [number, number]> = {
    tranquilo: [0, 40],
    moderado:  [30, 120],
    intenso:   [100, 300],
  };

  let restaurants = 0;
  let activities  = 0;
  for (const dia of result.days) {
    for (const periodo of dia.periodos) {
      for (const item of periodo.items) {
        if (item.categoria === "restaurante")       restaurants++;
        else if (item.categoria === "oQueFazer" ||
                 item.categoria === "lucky")         activities++;
      }
    }
  }
  const meals = Math.max(restaurants, days * 2);

  const [hLo, hHi] = HOTEL[vibe];
  const [mLo, mHi] = MEAL[vibe];
  const [aLo, aHi] = ACTIVITY[vibe];

  const low  = nights * hLo + meals * mLo + activities * aLo;
  const high = nights * hHi + meals * mHi + activities * aHi;

  return {
    low, high,
    perDayLow:  Math.round(low  / days),
    perDayHigh: Math.round(high / days),
  };
}

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function ResultPhase({
  result,
  hotelItem,
  suggestedHotel,
  totalPlaces,
  editMode,
  onToggleEdit,
  onReplaceItem,
  onOpenItemMenu,
  onAddItem,
  onShareResult,
  onExport,
  isExporting,
  scrollRef,
}: ResultPhaseProps) {
  // Use user's saved hotel first; fall back to Supabase-suggested hotel
  const displayHotel = hotelItem ?? suggestedHotel ?? null;
  const { totalDays, totalItems } = result.summary;
  const [dayOffsets, setDayOffsets]     = React.useState<Record<number, number>>({});
  const [activeDayChip, setActiveDayChip] = React.useState<number | null>(null);

  function handleWhatsApp() {
    const msg = encodeURIComponent(
      `Olá! Criei meu roteiro de ${totalDays} dias no Rio de Janeiro com o Lucky Trip. Pode me ajudar a refinar?`
    );
    Linking.openURL(`https://wa.me/?text=${msg}`);
  }

  function handleOpenMap() {
    const allItems = result.days.flatMap((d) => d.periodos.flatMap((p) => p.items));
    if (allItems.length === 0) return;

    if (allItems.length === 1) {
      const q = `${allItems[0].titulo} Rio de Janeiro`;
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`);
      return;
    }

    // Build Google Maps directions URL with origin + destination + up to 8 waypoints (Maps limit)
    const ordered = allItems.slice(0, 10);
    const origin      = encodeURIComponent(`${ordered[0].titulo} Rio de Janeiro`);
    const destination = encodeURIComponent(`${ordered[ordered.length - 1].titulo} Rio de Janeiro`);
    const waypoints   = ordered
      .slice(1, -1)
      .map((i) => encodeURIComponent(`${i.titulo} Rio de Janeiro`))
      .join("|");

    const url = waypoints.length > 0
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=walking`
      : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`;

    Linking.openURL(url);
  }

  function handleDayChipPress(diaNum: number) {
    setActiveDayChip(diaNum);
    const y = dayOffsets[diaNum] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }

  return (
    <>
      {/* ── Result Hero ── */}
      <View style={re.resultHero}>
        <Text style={re.resultHeroEyebrow}>Rio de Janeiro</Text>
        <Text style={re.resultHeroTitle}>
          {totalDays} {totalDays === 1 ? "dia" : "dias"} no Rio
        </Text>
        <Text style={re.resultHeroMeta}>
          {totalItems} {totalItems === 1 ? "experiência curada" : "experiências curadas"}
        </Text>

        {/* Day navigation chips */}
        {result.days.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={re.dayNavScroll}
            contentContainerStyle={re.dayNavRow}
          >
            {result.days.map((dia) => {
              const isActive = activeDayChip === dia.numero;
              return (
                <Pressable
                  key={dia.numero}
                  style={({ pressed }) => [
                    re.dayNavPill,
                    isActive && re.dayNavPillActive,
                    pressed && { opacity: 0.70 },
                  ]}
                  onPress={() => handleDayChipPress(dia.numero)}
                >
                  <Text style={[re.dayNavPillText, isActive && re.dayNavPillTextActive]}>
                    Dia {dia.numero}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Edit mode banner ── */}
      {editMode && (
        <View style={re.editBanner}>
          <Feather name="edit-2" size={12} color={GOLD} />
          <Text style={re.editBannerText}>Toque em um item para substituí-lo</Text>
          <Pressable onPress={onToggleEdit} hitSlop={8}>
            <Text style={re.editBannerDone}>Concluir</Text>
          </Pressable>
        </View>
      )}

      {/* ── Hotel card ── */}
      {displayHotel && (
        <Pressable
          style={re.hotelCard}
          onPress={() => router.push({ pathname: "/ondeFicar/hotel/[hotelId]", params: { hotelId: displayHotel.id } })}
        >
          {/* Thumbnail */}
          <View style={re.hotelThumb}>
            <Image source={displayHotel.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.38)"]}
              style={StyleSheet.absoluteFill}
            />
          </View>
          {/* Content */}
          <View style={re.hotelContent}>
            <Text style={re.hotelLabel}>{hotelItem ? "✦ Hotel selecionado" : "✦ Sugestão de hospedagem"}</Text>
            <Text style={re.hotelName} numberOfLines={1}>{displayHotel.titulo}</Text>
            {displayHotel.localizacao ? (
              <View style={re.hotelLocRow}>
                <Feather name="map-pin" size={9} color={`${GOLD}90`} />
                <Text style={re.hotelLoc} numberOfLines={1}>{displayHotel.localizacao}</Text>
              </View>
            ) : null}
          </View>
          <Feather name="chevron-right" size={16} color={`${GOLD}60`} />
        </Pressable>
      )}

      {/* ── Action row ── */}
      <View style={re.actionRow}>
        <Pressable
          style={({ pressed }) => [re.actionBtn, re.actionBtnEdit, pressed && { opacity: 0.82 }]}
          onPress={onToggleEdit}
        >
          <Feather name="edit-2" size={14} color={GOLD} />
          <Text style={[re.actionBtnText, { color: GOLD }]}>
            {editMode ? "Sair" : "Editar"}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [re.actionBtn, re.actionBtnWA, pressed && { opacity: 0.82 }]}
          onPress={handleWhatsApp}
        >
          <Feather name="message-circle" size={14} color={CREAM} />
          <Text style={re.actionBtnText}>WhatsApp</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [re.actionBtn, re.actionBtnExport, (pressed || isExporting) && { opacity: 0.70 }]}
          onPress={onExport}
          disabled={isExporting}
        >
          <Feather name="link" size={14} color={CREAM} />
          <Text style={re.actionBtnText}>{isExporting ? "Gerando..." : "Exportar"}</Text>
        </Pressable>
      </View>

      {/* ── Map CTA ── */}
      <Pressable style={({ pressed }) => [re.mapCta, pressed && { opacity: 0.80 }]} onPress={handleOpenMap}>
        <View style={re.mapCtaLeft}>
          <View style={re.mapCtaIcon}>
            <Feather name="map-pin" size={14} color={GOLD} />
          </View>
          <View>
            <Text style={re.mapCtaLabel}>Ver roteiro completo no mapa</Text>
            <Text style={re.mapCtaSub}>{totalPlaces} {totalPlaces === 1 ? "lugar selecionado" : "lugares selecionados"}</Text>
          </View>
        </View>
        <Feather name="arrow-right" size={15} color={`${GOLD}70`} />
      </Pressable>

      {/* ── Day cards ── */}
      {result.days.map((dia) => (
        <ResultDayCard
          key={`${dia.numero}-${dia.bairro}`}
          dia={dia}
          editMode={editMode}
          onReplaceItem={onReplaceItem}
          onOpenItemMenu={onOpenItemMenu}
          onAddItem={onAddItem}
          onLayout={(y) => setDayOffsets((prev) => ({ ...prev, [dia.numero]: y }))}
        />
      ))}

      {/* ── Custo estimado ── */}
      <CustoFooter result={result} />
    </>
  );
}

function CustoFooter({ result }: { result: ItineraryResult }) {
  const est = estimateCost(result);
  return (
    <View style={re.custoCard}>
      <View style={re.custoHeader}>
        <Feather name="dollar-sign" size={13} color={GOLD} />
        <Text style={re.custoLabel}>CUSTO ESTIMADO</Text>
      </View>
      <Text style={re.custoValue}>
        ~R$ {formatBRL(est.low)}–{formatBRL(est.high)}
      </Text>
      <Text style={re.custoSub}>
        por pessoa · ~R$ {formatBRL(est.perDayLow)}–{formatBRL(est.perDayHigh)}/dia
      </Text>
      <Text style={re.custoNote}>
        Estimativa do estilo escolhido — hospedagem, refeições e atrações.
        Lucky pode refinar com base no seu perfil.
      </Text>
    </View>
  );
}

function navigateToItem(item: SavedItem) {
  // ── Debug log — always fires to help diagnose routing issues ──
  console.log("[navigateToItem]", {
    id:           item.id,
    source_table: item.source_table,
    categoria:    item.categoria,
    isExternal:   item.isExternal ?? false,
    titulo:       item.titulo,
  });

  // ── External items: route by coordinates or Google Place ID, never by name ──
  if (item.isExternal) {
    if (item.placeId) {
      console.log("[navigateToItem] → Google Maps (place_id)", item.placeId);
      Linking.openURL(`https://www.google.com/maps/place/?q=place_id:${item.placeId}`);
      return;
    }
    if (item.lat && item.lng) {
      console.log("[navigateToItem] → Google Maps (coords)", item.lat, item.lng);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`);
      return;
    }
    // External item with no coordinates — cannot navigate
    console.warn("[navigateToItem] External item has no placeId or coords — showing fallback");
    Alert.alert("Em breve disponível", "Este lugar ainda não tem página de detalhes.");
    return;
  }

  // ── Internal items: must have a valid id ──
  if (!item.id) {
    console.warn("[navigateToItem] Item has no id — showing fallback");
    Alert.alert("Em breve disponível", "Este lugar ainda não tem página de detalhes.");
    return;
  }

  // Derive source_table: prefer explicit field, fall back to categoria mapping
  const table: SourceTable = item.source_table ?? sourceTableFromCategoria(item.categoria);

  console.log("[navigateToItem] → detail page", { table, id: item.id });

  // Hotels have their own dedicated detail route
  if (table === "stay_hotels") {
    router.push({ pathname: "/ondeFicar/hotel/[hotelId]", params: { hotelId: item.id } });
    return;
  }

  // All other tables → unified lugar detail route with explicit source_table
  router.push({
    pathname: "/lugar/[cityId]/[placeId]",
    params: {
      cityId:      "rio",
      placeId:     item.id,
      source_table: table,
      titulo:      item.titulo ?? "",
      localizacao: item.localizacao ?? "",
    },
  });
}

function getItemFallbackImage(categoria: SavedCategory): ReturnType<typeof require> {
  switch (categoria) {
    case "restaurante": return require("@/assets/images/restaurante1.png");
    case "hotel":       return require("@/assets/images/hotel1.png");
    default:            return require("@/assets/images/pao-acucar.png");
  }
}

// ItemThumb — renders item thumbnail with onError fallback.
// Prevents blank images when URIs fail (network, CORS, expired URL).
function ItemThumb({ image, categoria }: { image: unknown; categoria: SavedCategory }) {
  const [errored, setErrored] = React.useState(false);
  const fallback = getItemFallbackImage(categoria);
  const src = (!errored && image != null && image !== undefined && image !== 0)
    ? (image as ImageSourcePropType)
    : fallback;
  return (
    <>
      <Image
        source={src as ImageSourcePropType}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onError={() => setErrored(true)}
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.32)"]}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}

function ResultDayCard({
  dia,
  editMode,
  onReplaceItem,
  onOpenItemMenu,
  onAddItem,
  onLayout,
}: {
  dia:            DiaRoteiro;
  editMode:       boolean;
  onReplaceItem:  (diaNum: number, itemId: string, newItem: SavedItem) => void;
  onOpenItemMenu: (diaNum: number, item: SavedItem) => void;
  onAddItem:      (diaNum: number) => void;
  onLayout?:      (y: number) => void;
}) {
  // per-item duration overrides (minutes) — keys are item.id
  const [durationOverrides, setDurationOverrides] = React.useState<Record<string, number>>({});

  function adjustDuration(itemId: string, baseDur: string | undefined, delta: number) {
    setDurationOverrides((prev) => {
      const current = prev[itemId] ?? parseDuracao(baseDur);
      const next = Math.max(15, current + delta);
      return { ...prev, [itemId]: next };
    });
  }
  const weather = getDayWeather(dia.numero);
  const allItems = dia.periodos.flatMap((p) => p.items);
  const travelMinTotal = allItems.reduce((sum, it) => sum + parseDuracao(it.duracao), 0) || 90;
  const [collapsed, setCollapsed] = React.useState(false);

  function handleDayMap() {
    const places = allItems.slice(0, 4).map((i) => i.titulo).join(" + ");
    const query = `${places} ${dia.bairro} Rio de Janeiro`;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  }

  return (
    <View style={re.dayCard} onLayout={(e) => onLayout?.(e.nativeEvent.layout.y)}>
      {/* ── Day header (tappable to collapse) ── */}
      <Pressable
        style={({ pressed }) => [re.dayHeader, pressed && { opacity: 0.88 }]}
        onPress={() => setCollapsed((v) => !v)}
      >
        <View style={re.dayNumBadge}>
          <Text style={re.dayNumText}>DIA {dia.numero}</Text>
        </View>
        <Text style={re.dayBairro} numberOfLines={1}>{dia.bairro}</Text>
        <Feather name={weather} size={13} color="rgba(255,255,255,0.40)" />
        {!collapsed && (
          <View style={re.travelChip}>
            <Feather name="clock" size={10} color="rgba(255,255,255,0.40)" />
            <Text style={re.travelChipText}>{travelMinTotal} min</Text>
          </View>
        )}
        <Feather
          name={collapsed ? "chevron-down" : "chevron-up"}
          size={15}
          color="rgba(255,255,255,0.35)"
        />
      </Pressable>

      {/* ── Collapsed summary ── */}
      {collapsed && (
        <View style={re.dayCollapsedRow}>
          <Text style={re.dayCollapsedText}>
            {allItems.length} {allItems.length === 1 ? "lugar" : "lugares"} · {travelMinTotal} min
          </Text>
          <Feather name="clock" size={10} color="rgba(255,255,255,0.30)" />
        </View>
      )}

      {/* ── Period blocks ── */}
      {!collapsed && (
        <View style={re.dayBody}>
          {dia.periodos.map((periodo) => (
            <View key={periodo.periodo} style={re.periodSection}>
              {/* Period label row */}
              <View style={re.periodHeaderRow}>
                <Feather
                  name={PERIODO_ICON[periodo.periodo] as any}
                  size={11}
                  color={GOLD}
                />
                <Text style={re.periodLabel}>{PERIODO_LABEL[periodo.periodo]}</Text>
                <View style={re.periodDivider} />
              </View>

              {/* Items */}
              {periodo.items.map((item, idx) => {
                const timeStr   = getItemTime(periodo.periodo, periodo.items, idx, durationOverrides);
                const curDurMin = durationOverrides[item.id] ?? parseDuracao(item.duracao);
                const nextItem  = periodo.items[idx + 1];
                let travelLabel = "";
                if (nextItem) {
                  const aCoord = item.lat && item.lng
                    ? { lat: item.lat, lng: item.lng }
                    : bairroCoord(item.localizacao ?? dia.bairro);
                  const bCoord = nextItem.lat && nextItem.lng
                    ? { lat: nextItem.lat, lng: nextItem.lng }
                    : bairroCoord(nextItem.localizacao ?? dia.bairro);
                  const km  = haversineKm(aCoord, bCoord);
                  const min = walkMinutes(km);
                  travelLabel = formatTravel(km, min);
                }

                return (
                  <React.Fragment key={item.id}>
                    <Pressable
                      style={({ pressed }) => [re.itemRow, pressed && { opacity: 0.80 }]}
                      onPress={() => {
                        if (editMode) {
                          onReplaceItem(dia.numero, item.id, item);
                        } else {
                          onOpenItemMenu(dia.numero, item);
                        }
                      }}
                      onLongPress={() => navigateToItem(item)}
                    >
                      {/* Left: time */}
                      <View style={re.timeCol}>
                        <Text style={re.timeLabel}>{timeStr}</Text>
                      </View>

                      {/* Thumbnail */}
                      <View style={re.thumb}>
                        <ItemThumb image={item.image} categoria={item.categoria} />
                      </View>

                      {/* Info */}
                      <View style={re.itemInfo}>
                        <Text style={re.itemName} numberOfLines={1}>{item.titulo}</Text>
                        <View style={re.itemLocRow}>
                          <Feather name="map-pin" size={9} color={`${GOLD}80`} />
                          <Text style={re.itemLoc} numberOfLines={1}>
                            {item.localizacao ?? dia.bairro}
                          </Text>
                        </View>
                        {item.isExternal ? (
                          <View style={[re.catBadge, re.catBadgeExternal]}>
                            <Feather name="plus-circle" size={9} color={GOLD} />
                            <Text style={[re.catBadgeText, re.catBadgeTextExternal]}>
                              Adicionado por você
                            </Text>
                          </View>
                        ) : (
                          <View style={re.catBadge}>
                            <Text style={re.catBadgeText}>{CATEGORY_LABEL[item.categoria]}</Text>
                          </View>
                        )}
                      </View>

                      {editMode ? (
                        <View style={re.swapBtn}>
                          <Feather name="refresh-cw" size={13} color={GOLD} />
                        </View>
                      ) : (
                        <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.22)" />
                      )}
                    </Pressable>

                    {/* Duration controls */}
                    {!editMode && (
                      <View style={re.durationRow}>
                        <View style={re.timeColSpacer} />
                        <View style={re.durationPill}>
                          <Pressable
                            style={re.durBtn}
                            onPress={() => adjustDuration(item.id, item.duracao, -15)}
                            hitSlop={6}
                          >
                            <Text style={re.durBtnText}>−</Text>
                          </Pressable>
                          <Feather name="clock" size={9} color="rgba(255,255,255,0.45)" />
                          <Text style={re.durLabel}>
                            {curDurMin >= 60
                              ? `${Math.floor(curDurMin / 60)}h${curDurMin % 60 > 0 ? String(curDurMin % 60).padStart(2, "0") : ""}`
                              : `${curDurMin}min`}
                          </Text>
                          <Pressable
                            style={re.durBtn}
                            onPress={() => adjustDuration(item.id, item.duracao, +15)}
                            hitSlop={6}
                          >
                            <Text style={re.durBtnText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}

                    {/* Travel connector between items */}
                    {idx < periodo.items.length - 1 && (
                      <View style={re.travelConnector}>
                        <View style={re.timeColSpacer} />
                        <View style={re.connectorPill}>
                          <Feather name="navigation" size={9} color="rgba(255,255,255,0.40)" />
                          <Text style={re.connectorText}>
                            Deslocamento · {travelLabel}
                          </Text>
                        </View>
                      </View>
                    )}
                  </React.Fragment>
                );
              })}
          </View>
        ))}

        {/* ── Add item button ── */}
        <Pressable
          style={({ pressed }) => [re.addItemBtn, pressed && { opacity: 0.75 }]}
          onPress={() => onAddItem(dia.numero)}
        >
          <View style={re.addItemBtnIcon}>
            <Feather name="plus" size={14} color={GOLD} />
          </View>
          <Text style={re.addItemBtnText}>Adicionar ao Dia {dia.numero}</Text>
        </Pressable>

        {/* ── Per-day map button ── */}
        <Pressable
          style={({ pressed }) => [re.dayMapBtn, pressed && { opacity: 0.75 }]}
          onPress={handleDayMap}
        >
          <Feather name="map-pin" size={11} color={GOLD} />
          <Text style={re.dayMapBtnText}>Ver Dia {dia.numero} no mapa</Text>
          <Feather name="arrow-right" size={12} color={`${GOLD}55`} />
        </Pressable>
      </View>
      )}
    </View>
  );
}

const re = StyleSheet.create({
  // ── Hotel card ─────────────────────────────────────────────────────────────
  hotelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    marginBottom: 14,
  },
  hotelThumb: {
    width: 62,
    height: 62,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.35)",
    flexShrink: 0,
  },
  hotelContent: {
    flex: 1,
    gap: 3,
  },
  hotelLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: `${GOLD}90`,
    letterSpacing: 1.0,
  },
  hotelName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 15,
    color: CREAM,
    lineHeight: 20,
  },
  hotelLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  hotelLoc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.50)",
    flex: 1,
  },

  // ── Summary card ───────────────────────────────────────────────────────────
  summary: {
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 18,
    marginBottom: 14,
    gap: 6,
  },
  summaryTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: CREAM,
    lineHeight: 24,
  },
  summarySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.40)",
    lineHeight: 16,
  },
  dayPillsScroll: {
    marginTop: 8,
  },
  dayPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 4,
  },
  dayPillsLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.40)",
  },
  dayPill: {
    backgroundColor: "rgba(27,79,114,0.12)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dayPillActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  dayPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: GOLD,
  },
  dayPillTextActive: {
    color: DARK_BROWN,
  },

  // ── Action row ─────────────────────────────────────────────────────────────
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionBtnWA: {
    backgroundColor: "rgba(10,32,10,0.70)",
    borderColor: "rgba(40,120,40,0.20)",
  },
  actionBtnEdit: {
    backgroundColor: GLASS_BG,
    borderColor: "rgba(27,79,114,0.22)",
  },
  actionBtnExport: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.14)",
  },
  actionBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: CREAM,
  },

  // ── Map CTA ────────────────────────────────────────────────────────────────
  mapCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  mapCtaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  mapCtaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(27,79,114,0.12)",
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapCtaLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: CREAM,
  },
  mapCtaSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.40)",
    marginTop: 1,
  },

  // ── Day card ───────────────────────────────────────────────────────────────
  dayCard: {
    marginBottom: 24,
    borderRadius: 20,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: "hidden",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: GLASS_HEADER,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(27,79,114,0.10)",
  },
  dayNumBadge: {
    backgroundColor: "rgba(27,79,114,0.16)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.28)",
    flexShrink: 0,
  },
  dayNumText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: GOLD,
    letterSpacing: 1.5,
  },
  dayBairro: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 15,
    color: CREAM,
    flex: 1,
  },
  weatherIcon: {
    flexShrink: 0,
  },
  travelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  travelChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: "rgba(255,255,255,0.40)",
  },

  // ── Day body / periods ─────────────────────────────────────────────────────
  dayBody: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  periodSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  periodHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  periodLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: GOLD,
    letterSpacing: 0.8,
  },
  periodDivider: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(27,79,114,0.14)",
  },

  // ── Item row ───────────────────────────────────────────────────────────────
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  timeCol: {
    width: 42,
    alignItems: "flex-end",
    flexShrink: 0,
  },
  timeLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
  },
  thumb: {
    width: 88,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.35)",
    flexShrink: 0,
  },
  itemInfo: {
    flex: 1,
    gap: 5,
  },
  itemName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: CREAM,
    lineHeight: 17,
  },
  itemLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  itemLoc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    flex: 1,
  },
  catBadge: {
    backgroundColor: "rgba(27,79,114,0.10)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.18)",
    alignSelf: "flex-start",
  },
  catBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: `${GOLD}CC`,
    letterSpacing: 0.3,
  },
  catBadgeExternal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${GOLD}1A`,
    borderColor: `${GOLD}55`,
  },
  catBadgeTextExternal: {
    color: GOLD,
  },

  // ── Travel connector ───────────────────────────────────────────────────────
  travelConnector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    marginTop: 2,
  },
  timeColSpacer: {
    width: 42,
    flexShrink: 0,
  },
  connectorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    marginLeft: 4,
  },
  connectorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(27,79,114,0.10)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.22)",
    marginHorizontal: 20,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  editBannerText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.70)",
  },
  editBannerDone: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: GOLD,
  },
  swapBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(27,79,114,0.12)",
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Result Hero ────────────────────────────────────────────────────────────
  resultHero: {
    paddingVertical: 28,
    paddingBottom: 20,
    gap: 6,
  },
  resultHeroEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: GOLD,
    letterSpacing: 2.0,
  },
  resultHeroTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 34,
    color: CREAM,
    lineHeight: 42,
    marginTop: 2,
  },
  resultHeroMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.50)",
    lineHeight: 18,
    marginBottom: 4,
  },
  dayNavScroll: {
    marginTop: 16,
  },
  dayNavRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 4,
  },
  dayNavPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "rgba(27,79,114,0.10)",
    borderColor: "rgba(27,79,114,0.20)",
  },
  dayNavPillActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  dayNavPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: GOLD,
  },
  dayNavPillTextActive: {
    color: "#000000",
  },

  // ── Collapsible row ────────────────────────────────────────────────────────
  dayCollapsedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  dayCollapsedText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.38)",
  },

  // ── Per-day map button ─────────────────────────────────────────────────────
  dayMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(27,79,114,0.07)",
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.16)",
  },
  dayMapBtnText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: `${GOLD}CC`,
  },

  // ── Duration controls ────────────────────────────────────────────────────
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  durationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(27,79,114,0.08)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.14)",
  },
  durBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(27,79,114,0.14)",
  },
  durBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: GOLD,
    lineHeight: 18,
  },
  durLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    minWidth: 38,
    textAlign: "center",
  },

  // ── Add item button (per day) ────────────────────────────────────────────
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    marginBottom: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(27,79,114,0.30)",
    backgroundColor: "rgba(27,79,114,0.04)",
  },
  addItemBtnIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(27,79,114,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  addItemBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: `${GOLD}CC`,
    flex: 1,
  },

  // ── Custo estimado footer ────────────────────────────────────────────────
  custoCard: {
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.22)",
    padding: 18,
    marginTop: 6,
    marginBottom: 20,
    gap: 4,
  },
  custoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  custoLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: `${GOLD}CC`,
    letterSpacing: 1.2,
  },
  custoValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: CREAM,
    lineHeight: 30,
  },
  custoSub: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "rgba(255,255,255,0.70)",
  },
  custoNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.40)",
    lineHeight: 16,
    marginTop: 8,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function RoteiroScreen() {
  const insets    = useSafeAreaInsets();
  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const rioHero   = useRioHeroMedia("image");

  const params      = useLocalSearchParams<{ contextual?: string }>();
  const isContextual = params.contextual === "1";

  const { saved, user } = useGuia();

  const [result,            setResult]            = useState<ItineraryResult | null>(null);
  const [generating,        setGenerating]        = useState(false);
  const [editMode,          setEditMode]          = useState(false);
  const [isExporting,       setIsExporting]       = useState(false);
  const [replacingItem,     setReplacingItem]     = useState<{ item: SavedItem; diaNum: number } | null>(null);
  /** Open item menu sheet — set when user taps an itinerary row outside of editMode. */
  const [menuItem,          setMenuItem]          = useState<{ item: SavedItem; diaNum: number } | null>(null);
  /** Day number for the "+" add-item menu — null when closed. */
  const [addMenuDay,        setAddMenuDay]        = useState<number | null>(null);
  /** Google Places search modal — open via "Busca manual" in AddItemMenu. */
  const [placeSearchVisible, setPlaceSearchVisible] = useState(false);
  /** Day number targeted by the place search modal. */
  const [placeSearchDay,     setPlaceSearchDay]     = useState<number | null>(null);
  /** ID of the auto-saved user_itineraries row — set after generation, used by Share/Export to update rather than re-insert. */
  const [savedItineraryId,  setSavedItineraryId]  = useState<string | null>(null);
  /** Hotel suggestion fetched from Supabase when user has no hotel in their saved list. */
  const [suggestedHotel,    setSuggestedHotel]    = useState<SavedItem | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  function removeItem(diaNum: number, itemId: string) {
    setResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        summary: { ...prev.summary, totalItems: Math.max(0, prev.summary.totalItems - 1) },
        days: prev.days.map((dia) => {
          if (dia.numero !== diaNum) return dia;
          return {
            ...dia,
            periodos: dia.periodos.map((periodo) => ({
              ...periodo,
              items: periodo.items.filter((it) => it.id !== itemId),
            })),
          };
        }),
      };
    });
  }

  function shareSingleItem(item: SavedItem) {
    const msg = `Olha essa dica do The Lucky Trip:\n✦ ${item.titulo}${item.localizacao ? ` — ${item.localizacao}` : ""}`;
    Share.share({ message: msg }).catch(() => {});
  }

  function addItemToDay(diaNum: number, item: SavedItem, periodo: PeriodoDia = "tarde") {
    setResult((prev): ItineraryResult | null => {
      if (!prev) return prev;
      const updatedDays = prev.days.map((dia) => {
        if (dia.numero !== diaNum) return dia;
        const existsPeriodo = dia.periodos.find((p) => p.periodo === periodo);
        return {
          ...dia,
          periodos: existsPeriodo
            ? dia.periodos.map((p) =>
                p.periodo === periodo ? { ...p, items: [...p.items, item] } : p
              )
            : [...dia.periodos, { periodo, items: [item] }],
        };
      });
      return {
        ...prev,
        summary: { ...prev.summary, totalItems: prev.summary.totalItems + 1 },
        days: updatedDays,
      };
    });
  }

  function handleTempoLivre(diaNum: number) {
    const item: SavedItem = {
      id:          `livre-${diaNum}-${Date.now()}`,
      categoria:   "oQueFazer",
      titulo:      "Tempo livre",
      localizacao: "Rio de Janeiro",
      image:       require("@/assets/images/hero-rio.png"),
      duracao:     "60min",
    };
    addItemToDay(diaNum, item);
  }

  function handleVoltarHotel(diaNum: number) {
    const hotel = hotelItem ?? suggestedHotel;
    const item: SavedItem = {
      id:          `hotel-${diaNum}-${Date.now()}`,
      categoria:   "hotel",
      titulo:      hotel ? `Voltar — ${hotel.titulo}` : "Voltar ao hotel",
      localizacao: hotel?.localizacao ?? "Rio de Janeiro",
      image:       hotel?.image ?? require("@/assets/images/hotel1.png"),
      duracao:     "30min",
    };
    addItemToDay(diaNum, item, "noite" as PeriodoDia);
  }

  function replaceItem(diaNum: number, itemId: string, newItem: SavedItem) {
    setResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map((dia) => {
          if (dia.numero !== diaNum) return dia;
          return {
            ...dia,
            periodos: dia.periodos.map((periodo) => ({
              ...periodo,
              items: periodo.items.map((it) => (it.id === itemId ? newItem : it)),
            })),
          };
        }),
      };
    });
  }

  function openReplaceSheet(diaNum: number, _itemId: string, item: SavedItem) {
    setReplacingItem({ item, diaNum });
  }

  function buildShareLines(shareSlug?: string): string {
    if (!result) return "";
    const lines: string[] = [`✦ Roteiro Rio de Janeiro — The Lucky Trip\n`];
    if (shareSlug) lines.push(`Ver roteiro completo: https://theluckytrip.app/r/${shareSlug}\n`);
    for (const dia of result.days) {
      lines.push(`Dia ${dia.numero} — ${dia.bairro}`);
      for (const periodo of dia.periodos) {
        const label = PERIODO_LABEL[periodo.periodo];
        const itens = periodo.items.map((it) => `  • ${it.titulo} (${it.localizacao || dia.bairro})`).join("\n");
        if (itens) lines.push(`${label}\n${itens}`);
      }
      lines.push("");
    }
    return lines.join("\n").trim();
  }

  async function handleShare() {
    if (!result) return;
    let shareSlug: string | undefined;

    // 1. Persist (or mark public) and get a shareable slug
    try {
      shareSlug = Array.from({ length: 8 }, () => Math.random().toString(36)[2]).join("");

      if (savedItineraryId) {
        // Auto-save already ran — just mark public and attach the share slug
        const { error } = await supabase
          .from("user_itineraries")
          .update({ is_public: true, share_slug: shareSlug })
          .eq("id", savedItineraryId);
        if (error) shareSlug = undefined;
      } else {
        // Unauthenticated fallback — full insert (preserves existing behavior)
        const { data: itinerary, error: itinErr } = await supabase
          .from("user_itineraries")
          .insert({
            destination_id:   "rio-de-janeiro",
            destination_name: result.destination ?? "Rio de Janeiro",
            status:           "generated",
            is_public:        true,
            share_slug:       shareSlug,
            days_count:       result.summary.totalDays,
            items_count:      result.summary.totalItems,
            inspiration_tags: (result.preferences?.inspirations ?? []) as string[],
            travel_company:   null,
            budget_style:     result.preferences?.vibe ?? null,
            generated_at:     new Date().toISOString(),
          })
          .select("id")
          .single();

        if (itinErr || !itinerary) {
          shareSlug = undefined;
        } else {
          const roteiroItens = result.days.flatMap((dia) =>
            dia.periodos.flatMap((periodo, _pi) =>
              periodo.items.map((item, idx) => ({
                roteiro_id:        itinerary.id,
                user_itinerary_id: itinerary.id,
                name:              item.titulo,
                day_index:         dia.numero - 1,
                order_in_day:      idx,
                time_slot:         periodo.periodo,
                source:            item.isExternal ? "external" : "saved",
                ref_table:         item.isExternal ? "external" : null,
                place_id:          item.isExternal ? (item.placeId ?? null) : null,
                neighborhood:      item.localizacao ?? dia.bairro,
                address:           item.isExternal ? (item.address ?? null) : null,
                city:              "Rio de Janeiro",
                lat:               item.isExternal ? (item.lat ?? null) : null,
                lng:               item.isExternal ? (item.lng ?? null) : null,
              }))
            )
          );
          await supabase.from("roteiro_itens").insert(roteiroItens);
        }
      }
    } catch {
      shareSlug = undefined;
    }

    // 2. Build share content
    const shareText  = buildShareLines(shareSlug);
    const shareUrl   = shareSlug ? `https://theluckytrip.app/r/${shareSlug}` : undefined;
    const shareTitle = "Roteiro Rio de Janeiro — The Lucky Trip";

    // 3. Platform-aware sharing — always produces visible output
    const doNativeShare = async () => {
      try {
        await Share.share({
          message: shareText,
          url:     shareUrl,         // iOS only — adds a URL field
          title:   shareTitle,       // Android
        });
      } catch { /* user dismissed */ }
    };

    if (Platform.OS === "web") {
      // Web: try Web Share API first, then Alert fallback
      const canWebShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
      if (canWebShare) {
        try {
          await navigator.share({
            title: shareTitle,
            text:  shareText,
            url:   shareUrl,
          });
          return;
        } catch { /* dismissed or unsupported — fall through */ }
      }
      // Fallback for web browsers without Share API: show link in Alert
      Alert.alert(
        "Compartilhar roteiro",
        shareUrl
          ? `Seu roteiro está disponível em:\n\n${shareUrl}\n\nCopie o link e compartilhe.`
          : shareText.slice(0, 300),
        [{ text: "OK" }]
      );
    } else if (shareUrl) {
      // Native with URL: show Alert with URL + share button
      Alert.alert(
        "Roteiro salvo",
        `Link do seu roteiro:\n\n${shareUrl}`,
        [
          {
            text: "Compartilhar",
            onPress: doNativeShare,
          },
          { text: "Fechar", style: "cancel" },
        ]
      );
    } else {
      // Native without URL: open share sheet directly
      await doNativeShare();
    }
  }

  /**
   * Export — generates a shareable URL and shows it with a copy/share action.
   * Distinct from handleShare: does NOT open the native share sheet as primary action.
   * Primary action is to surface the URL so the user can copy or access it in a browser.
   */
  async function handleExport() {
    if (!result || isExporting) return;

    // Require authentication to export
    if (!user) {
      Alert.alert(
        "Faça login para exportar",
        "Crie uma conta gratuita para salvar e compartilhar seus roteiros.",
        [
          { text: "Entrar", onPress: () => router.push("/(tabs)/perfil") },
          { text: "Agora não", style: "cancel" },
        ]
      );
      return;
    }

    setIsExporting(true);
    let exportUrl: string | undefined;

    // 1. Generate slug + persist itinerary to Supabase
    try {
      const slug = Array.from({ length: 8 }, () => Math.random().toString(36)[2]).join("");

      if (savedItineraryId) {
        // Auto-save already ran — just mark public and attach the export slug
        const { error } = await supabase
          .from("user_itineraries")
          .update({ is_public: true, share_slug: slug })
          .eq("id", savedItineraryId);
        if (!error) exportUrl = `https://theluckytrip.app/r/${slug}`;
        else console.error("[Export] update error:", error.message);
      } else {
        // Insert for users where auto-save didn't run
        const { data: itinerary, error: itinErr } = await supabase
          .from("user_itineraries")
          .insert({
            destination_id:   "rio-de-janeiro",
            destination_name: result.destination ?? "Rio de Janeiro",
            status:           "generated",
            is_public:        true,
            share_slug:       slug,
            days_count:       result.summary.totalDays,
            items_count:      result.summary.totalItems,
            inspiration_tags: (result.preferences?.inspirations ?? []) as string[],
            travel_company:   null,
            budget_style:     result.preferences?.vibe ?? null,
            generated_at:     new Date().toISOString(),
          })
          .select("id")
          .single();

        if (!itinErr && itinerary) {
          const roteiroItens = result.days.flatMap((dia) =>
            dia.periodos.flatMap((periodo) =>
              periodo.items.map((item, idx) => ({
                roteiro_id:        itinerary.id,
                user_itinerary_id: itinerary.id,
                name:              item.titulo,
                day_index:         dia.numero - 1,
                order_in_day:      idx,
                time_slot:         periodo.periodo,
                source:            item.isExternal ? "external" : "saved",
                ref_table:         item.isExternal ? "external" : null,
                place_id:          item.isExternal ? (item.placeId ?? null) : null,
                neighborhood:      item.localizacao ?? dia.bairro,
                address:           item.isExternal ? (item.address ?? null) : null,
                city:              "Rio de Janeiro",
                lat:               item.isExternal ? (item.lat ?? null) : null,
                lng:               item.isExternal ? (item.lng ?? null) : null,
              }))
            )
          );
          await supabase.from("roteiro_itens").insert(roteiroItens);
          exportUrl = `https://theluckytrip.app/r/${slug}`;
        } else if (itinErr) {
          console.error("[Export] insert error:", itinErr.message);
        }
      }
    } catch (e) {
      console.error("[Export] unexpected error:", e);
    }

    // 2. Surface the URL
    if (!exportUrl) {
      Alert.alert(
        "Erro ao exportar",
        "Não foi possível gerar o link. Tente novamente.",
        [{ text: "OK" }]
      );
      setIsExporting(false);
      return;
    }

    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(exportUrl);
      } catch { /* clipboard not available */ }
      Alert.alert(
        "Link copiado!",
        `${exportUrl}\n\nCompartilhe este link para acessar o roteiro em qualquer dispositivo.`,
        [{ text: "OK" }]
      );
    } else {
      Alert.alert(
        "Roteiro exportado",
        "Link pronto para compartilhar:",
        [
          {
            text: "Compartilhar",
            onPress: () => Share.share({ message: exportUrl!, url: exportUrl, title: "Roteiro Rio de Janeiro — The Lucky Trip" }),
          },
          { text: "Fechar", style: "cancel" },
        ]
      );
    }
    setIsExporting(false);
  }

  const hotelItem   = saved.find((s) => s.categoria === "hotel") ?? null;
  const totalPlaces = result
    ? result.days.reduce((n, d) => n + d.periodos.reduce((m, p) => m + p.items.length, 0), 0)
    : saved.filter((s) => s.categoria !== "hotel").length;

  /** Fetches a hotel recommendation from Supabase when the user has none saved. */
  async function fetchSuggestedHotel(budget: BudgetStyle) {
    try {
      const { data } = await supabase
        .from("v_stay_neighborhoods_with_hotels")
        .select("neighborhood_name, neighborhood_slug, hotels")
        .eq("active", true)
        .order("display_order", { ascending: true })
        .limit(8);

      if (!data || data.length === 0) return;

      type HotelRow = { id: string; hotel_name: string; hotel_category: string; photo_url: string | null; neighborhood_slug: string | null; display_order: number };
      const allHotels: (HotelRow & { neighborhood_name: string })[] = (data as any[]).flatMap((n) =>
        ((n.hotels ?? []) as HotelRow[]).map((h) => ({ ...h, neighborhood_name: n.neighborhood_name as string }))
      );

      if (allHotels.length === 0) return;

      // Budget-matching heuristic using hotel_category keywords
      const luxuryKeywords  = ["luxo", "luxury", "resort", "grand", "palace"];
      const budgetKeywords  = ["hostel", "pousada", "budget", "econom"];

      let selected: typeof allHotels[0] | undefined;
      if (budget === "sofisticado") {
        selected = allHotels.find((h) => luxuryKeywords.some((k) => h.hotel_category?.toLowerCase().includes(k)));
      } else if (budget === "essencial") {
        selected = allHotels.find((h) => budgetKeywords.some((k) => h.hotel_category?.toLowerCase().includes(k)));
      }
      // conforto (or no match): use first curated hotel by display_order
      if (!selected) selected = allHotels[0];

      setSuggestedHotel({
        id:           selected.id,
        titulo:       selected.hotel_name,
        localizacao:  selected.neighborhood_name,
        image:        selected.photo_url ? { uri: selected.photo_url } : require("@/assets/images/rio-aerial-clean.png"),
        categoria:    "hotel",
        source_table: "stay_hotels",
      });
    } catch { /* silent — hotel suggestion is optional */ }
  }

  async function handleGenerate({
    nights, travelVibe, inspirations, budget, vibe,
  }: JourneyGenerateProps) {
    if (generating) return;
    setGenerating(true);

    // Fetch a hotel suggestion in the background when user has none saved
    if (!hotelItem) fetchSuggestedHotel(budget);

    try {
      const serializableItems = saved.map((s) => ({
        id:          s.id,
        titulo:      s.titulo,
        categoria:   s.categoria,
        localizacao: s.localizacao,
      }));

      const { data, error } = await supabase.functions.invoke("generate-itinerary", {
        body: {
          savedItems:   serializableItems,
          destination:  "Rio de Janeiro",
          preferences:  { inspirations, vibe, travelVibe, budget },
          requestedDays: nights,
        },
      });

      if (error || !data?.days) throw new Error(error?.message ?? "empty response");

      const savedMap = new Map(saved.map((s) => [s.id, s]));
      const hydratedDays: DiaRoteiro[] = (data.days as DiaRoteiro[]).map((day) => ({
        ...day,
        periodos: day.periodos.map((p) => ({
          ...p,
          items: p.items.map((item) => {
            const found = savedMap.get(item.id);
            if (found) {
              // Merge: engine data takes priority for display + classification.
              // Saved item provides routing fields (source_table, isExternal, placeId, lat, lng, address)
              // that the engine output does not carry.
              const engineCat   = (item.categoria as SavedCategory | undefined) ?? found.categoria;
              const edgeSrcTbl  = (item as any).source_table as SourceTable | undefined;
              const enginePhoto = (item as any).photo_url as string | null | undefined;
              return {
                ...found,
                // Engine-enriched classification — overrides save-time value
                categoria:    engineCat,
                // DB bairro preferred; fall back to saved value
                localizacao:  item.localizacao || found.localizacao,
                // Save-time source_table is authoritative for routing; engine value is fallback
                source_table: found.source_table ?? edgeSrcTbl ?? sourceTableFromCategoria(engineCat),
                // Real photo from Step F when available; fall back to saved image
                image:        enginePhoto ? { uri: enginePhoto } : found.image,
                // Step F enrichment fields — additive, not in SavedItem schema before this merge
                ...(enginePhoto              != null && { photo_url: enginePhoto }),
                ...((item as any).descricao  != null && { descricao: (item as any).descricao }),
                ...((item as any).duracao    != null && { duracao:   (item as any).duracao   }),
              } as SavedItem;
            }
            // Engine introduced a complement item not in the saved list.
            // Use engine categoria + source_table; use real Supabase photo when available.
            const cat = (item.categoria as SavedCategory | undefined) ?? "oQueFazer";
            const edgeSourceTable = (item as any).source_table as string | undefined;
            const compPhoto = (item as any).photo_url as string | null | undefined;
            return {
              ...item,
              // Real Supabase photo wins; fall back to category static PNG.
              // Same priority rule as Path A (saved items) — never discard a real photo.
              image:        compPhoto ? { uri: compPhoto } : getItemFallbackImage(cat),
              source_table: (edgeSourceTable as SourceTable | undefined) ?? sourceTableFromCategoria(cat),
              ...(compPhoto != null && { photo_url: compPhoto }),
              ...(((item as any).descricao)  != null && { descricao: (item as any).descricao }),
              ...(((item as any).duracao)    != null && { duracao:   (item as any).duracao   }),
            } as SavedItem;
          }).filter(Boolean),
        })),
      }));

      // ── Auto-save for authenticated users ─────────────────────────────────
      // Persists the itinerary header + items to Supabase before showing the result.
      // Share/Export will UPDATE this row rather than inserting a duplicate.
      // Failures are silent — the user still sees the generated itinerary.
      let autoSavedId: string | null = null;
      if (user) {
        try {
          const itemCount = hydratedDays.reduce(
            (n, d) => n + d.periodos.reduce((m, p) => m + p.items.length, 0),
            0,
          );
          const { data: itin, error: itinErr } = await supabase
            .from("user_itineraries")
            .insert({
              user_id:          user.id,
              destination_id:   "rio-de-janeiro",
              destination_name: data.destination ?? "Rio de Janeiro",
              status:           "generated",
              is_public:        false,
              days_count:       data.summary?.totalDays ?? hydratedDays.length,
              items_count:      data.summary?.totalItems ?? itemCount,
              inspiration_tags: (inspirations ?? []) as string[],
              budget_style:     vibe ?? null,
              generated_at:     new Date().toISOString(),
            })
            .select("id")
            .single();

          if (!itinErr && itin) {
            autoSavedId = itin.id as string;
            const roteiroItens = hydratedDays.flatMap((dia) =>
              dia.periodos.flatMap((periodo) =>
                periodo.items.map((item, idx) => ({
                  roteiro_id:        itin.id,
                  user_itinerary_id: itin.id,
                  name:              item.titulo,
                  day_index:         dia.numero - 1,
                  order_in_day:      idx,
                  time_slot:         periodo.periodo,
                  source:            item.isExternal ? "external" : "saved",
                  ref_table:         item.isExternal ? "external" : null,
                  place_id:          item.isExternal ? (item.placeId ?? null) : null,
                  neighborhood:      item.localizacao ?? dia.bairro,
                  address:           item.isExternal ? (item.address ?? null) : null,
                  city:              "Rio de Janeiro",
                  lat:               item.isExternal ? (item.lat ?? null) : null,
                  lng:               item.isExternal ? (item.lng ?? null) : null,
                }))
              )
            );
            await supabase.from("roteiro_itens").insert(roteiroItens);
          }
        } catch { /* auto-save failure is silent — result still shows */ }
      }

      setResult({
        destination: data.destination ?? "Rio de Janeiro",
        source:      "trip_saved_places",
        preferences: { inspirations, vibe },
        summary:     data.summary,
        days:        hydratedDays,
      });
      if (autoSavedId) setSavedItineraryId(autoSavedId);
    } catch (_) {
      const prefs: ItineraryPreferences = { inspirations, vibe };
      setResult(buildItinerary(saved, prefs));
    } finally {
      setGenerating(false);
    }
  }

  const phase: "journey" | "loading" | "result" =
    generating ? "loading" : result ? "result" : "journey";

  const ROTEIRO_BG_POOL = [
    require("@/assets/images/hero-rio.png"),
    require("@/assets/images/lapa.png"),
    require("@/assets/images/pao-acucar.png"),
    require("@/assets/images/map-rio-portrait.png"),
    require("@/assets/images/cristo.png"),
  ];

  return (
    <View style={sc.root}>

      {/* ── Cinematic background — rotating pool, hotel image pinned as first if saved ── */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
        <RotatingBackground
          pool={rioHero && rioHero.length > 0
            ? rioHero.map((item) => ({ uri: item.public_url }))
            : ROTEIRO_BG_POOL}
          firstSource={(hotelItem ?? suggestedHotel)?.image ?? null}
          blurRadius={phase === "result" ? 14 : 0}
        />
        <LinearGradient
          colors={
            phase === "result"
              ? ["rgba(10,8,5,0.50)", "rgba(10,8,5,0.72)", "rgba(10,8,5,0.92)"]
              : ["rgba(0,0,0,0.05)", "rgba(0,0,0,0.28)", "rgba(0,0,0,0.60)"]
          }
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* ── Header (hidden in journey phase) ── */}
      {phase !== "journey" && (
        <View style={{ paddingTop: topPad }}>
          <ScreenHeader
            phase={phase}
            onBack={() => { setResult(null); setGenerating(false); setEditMode(false); setSavedItineraryId(null); }}
            onShare={handleShare}
          />
        </View>
      )}

      {/* ── Phase content ── */}
      {phase === "journey" && (
        <TripFlow
          savedCount={saved.length}
          isContextual={isContextual}
          onGenerate={handleGenerate}
        />
      )}

      {phase === "loading" && <LoadingPhase />}

      {phase === "result" && (
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: "transparent" }}
          contentContainerStyle={[sc.content, { paddingBottom: bottomPad + 96 }]}
        >
          <ResultPhase
            result={result!}
            hotelItem={hotelItem}
            suggestedHotel={suggestedHotel}
            totalPlaces={totalPlaces}
            editMode={editMode}
            onToggleEdit={() => setEditMode((v) => !v)}
            onReplaceItem={openReplaceSheet}
            onOpenItemMenu={(diaNum, item) => setMenuItem({ item, diaNum })}
            onAddItem={(diaNum) => setAddMenuDay(diaNum)}
            onShareResult={handleShare}
            onExport={handleExport}
            isExporting={isExporting}
            scrollRef={scrollRef}
          />
        </ScrollView>
      )}

      {/* ── Assistente Lucky (FAB) — only in result phase ── */}
      {phase === "result" && !replacingItem && !menuItem && !addMenuDay && (
        <Pressable
          style={({ pressed }) => [
            sc.luckyFab,
            { bottom: bottomPad + 24 },
            pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
          ]}
          onPress={() => {
            router.push("/lucky");
          }}
        >
          <Text style={sc.luckyFabIcon}>✦</Text>
          <Text style={sc.luckyFabLabel}>Lucky</Text>
        </Pressable>
      )}

      {/* ── Replace sheet overlay ── */}
      {replacingItem && (
        <ReplaceSheet
          item={replacingItem.item}
          diaNum={replacingItem.diaNum}
          onClose={() => setReplacingItem(null)}
          onReplace={(diaNum, itemId, newItem) => {
            replaceItem(diaNum, itemId, newItem);
            setReplacingItem(null);
          }}
        />
      )}

      {/* ── Item menu sheet ── */}
      {menuItem && (
        <ItemMenuSheet
          item={menuItem.item}
          diaNum={menuItem.diaNum}
          onClose={() => setMenuItem(null)}
          onSeeDetails={() => {
            const it = menuItem.item;
            setMenuItem(null);
            navigateToItem(it);
          }}
          onShare={() => {
            shareSingleItem(menuItem.item);
            setMenuItem(null);
          }}
          onReplace={() => {
            const { item, diaNum } = menuItem;
            setMenuItem(null);
            openReplaceSheet(diaNum, item.id, item);
          }}
          onDelete={() => {
            const { item, diaNum } = menuItem;
            removeItem(diaNum, item.id);
            setMenuItem(null);
          }}
        />
      )}

      {/* ── Add item menu ── */}
      {addMenuDay !== null && (
        <AddItemMenu
          diaNum={addMenuDay}
          onClose={() => setAddMenuDay(null)}
          onPickCategory={(categoria) => {
            const diaNum = addMenuDay;
            setAddMenuDay(null);
            setReplacingItem({ item: {
              id: `new-${diaNum}-${Date.now()}`,
              categoria,
              titulo: "",
              localizacao: "",
              image: require("@/assets/images/hero-rio.png"),
            }, diaNum });
          }}
          onTempoLivre={() => handleTempoLivre(addMenuDay)}
          onVoltarHotel={() => handleVoltarHotel(addMenuDay)}
          onSugerir={() => {
            setAddMenuDay(null);
            router.push("/lucky");
          }}
          onManual={() => {
            const day = addMenuDay;
            setAddMenuDay(null);
            setPlaceSearchDay(day);
            setPlaceSearchVisible(true);
          }}
        />
      )}

      {/* ── Google Places search modal ("Busca manual") ── */}
      <PlaceSearchModal
        visible={placeSearchVisible}
        onClose={() => {
          setPlaceSearchVisible(false);
          setPlaceSearchDay(null);
        }}
        onSelectPlace={(place: SelectedPlace) => {
          setPlaceSearchVisible(false);
          if (!placeSearchDay || !result) return;
          const newItem: SavedItem = {
            id:          place.place_id,
            titulo:      place.titulo,
            localizacao: place.localizacao,
            categoria:   "oQueFazer",
            source_table:"o_que_fazer_rio",
            image:       getItemFallbackImage("oQueFazer"),
            isExternal:  true,
            placeId:     place.place_id,
            address:     place.localizacao,
            lat:         place.lat,
            lng:         place.lng,
          };
          addItemToDay(newItem, placeSearchDay);
          setPlaceSearchDay(null);
        }}
      />
    </View>
  );
}

const sc = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#100D09",
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  heroWatermark: {
    position: "absolute",
    right: -8,
    bottom: 60,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 64,
    lineHeight: 68,
    color: `${C.darkBrown}07`,
    textAlign: "right",
    letterSpacing: -2,
  },
  heroAccent: {
    position: "absolute",
    top: "30%",
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: `${GOLD}06`,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  loadingIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${GOLD}12`,
    borderWidth: 1,
    borderColor: `${GOLD}30`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  loadingText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: CREAM,
    textAlign: "center",
    lineHeight: 28,
  },
  loadingSubText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    lineHeight: 20,
  },
  loadingDots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  loadingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: GOLD,
  },

  // ── Lucky FAB (result phase) ─────────────────────────────────────────────
  luckyFab: {
    position: "absolute",
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: GOLD,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 16,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 10,
    zIndex: 80,
  },
  luckyFabIcon: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: "#1A1109",
    lineHeight: 20,
  },
  luckyFabLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: "#1A1109",
    letterSpacing: 0.3,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ContextualFlow styles
// ─────────────────────────────────────────────────────────────────────────────

const cf = StyleSheet.create({
  stepRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
    alignItems: "center",
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  stepDotDone: {
    backgroundColor: `${GOLD}40`,
    borderColor: `${GOLD}60`,
  },
  stepNum: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
  },
  stepNumActive: {
    color: C.darkBrown,
  },
  dateRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 14,
  },
  dateBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: GLASS_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dateBtnActive: {
    borderColor: GOLD,
  },
  dateBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.40)",
  },
  dateBtnTextSet: {
    color: CREAM,
  },
  skipBtn: {
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 12,
  },
  skipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.38)",
  },
  companionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 12,
  },
  companionCard: {
    width: "46%",
    backgroundColor: GLASS_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 14,
  },
  companionCardActive: {
    borderColor: GOLD,
    backgroundColor: `${GOLD}14`,
  },
  companionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  companionLabelActive: {
    color: CREAM,
    fontFamily: "Inter_600SemiBold",
  },
  budgetGrid: {
    gap: 14,
    marginTop: 12,
  },
  budgetCard: {
    backgroundColor: GLASS_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 24,
  },
  budgetCardActive: {
    borderColor: GOLD,
    backgroundColor: `${GOLD}18`,
  },
  budgetLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: "rgba(255,255,255,0.92)",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  budgetLabelActive: {
    color: CREAM,
    fontFamily: "Inter_700Bold",
  },
  budgetDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.62)",
    lineHeight: 19,
  },
});

