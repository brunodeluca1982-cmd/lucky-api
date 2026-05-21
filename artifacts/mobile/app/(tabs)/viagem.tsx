/**
 * viagem.tsx — "Minha Viagem" — premium trip planning dashboard.
 *
 * Layout order:
 *   Header → ActionArea (chips → AI CTA) → SavedGrid | EmptyHint → RoteiroSection
 *
 * Background:
 *   Empty  → static blurred Rio image + cinematic gradient
 *   Saved  → rotating fade through saved item images + cinematic gradient
 *
 * Style: dark editorial cinematic — matches luckyBlock / Home dark sections.
 *   rgba(0,0,0,x) panels · gold accent · cream text · no solid terracotta blocks.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useGuia, sourceTableFromCategoria } from "@/context/GuiaContext";
import type { SavedCategory, SavedItem } from "@/context/GuiaContext";
import { buildRoteiro, PERIODO_LABEL, PERIODO_ICON } from "@/utils/buildRoteiro";
import type { DiaRoteiro, DiaPeriodo } from "@/utils/buildRoteiro";
import { supabase } from "@/lib/supabase";
import { getNeighborhoodImage } from "@/data/neighborhoodImages";

const C      = Colors.light;
const AREIA  = "#F5F0E8";
const PETROL = "#1B4F72";
const { width: SCREEN_W } = Dimensions.get("window");

// Rio photos for rotating background
const RIO_BG_PHOTOS = [
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg" },
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero02.jpg" },
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero03.jpg" },
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero04.jpg" },
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero05.jpg" },
];
const FALLBACK_BG = RIO_BG_PHOTOS[0];

// ─────────────────────────────────────────────────────────────────────────────
// Category label map
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<SavedCategory, string> = {
  oQueFazer:    "Experiência",
  restaurante:  "Restaurante",
  hotel:        "Hotel",
  lucky:        "Lucky List",
  atividade:    "Atividade",
  praia:        "Praia",
  compras:      "Compras",
  dica_secreta: "Dica Secreta",
  bar:          "Bar",
  cafe:         "Café",
};

// ─────────────────────────────────────────────────────────────────────────────
// Background — fades between saved images (or static fallback)
// ─────────────────────────────────────────────────────────────────────────────

function SceneBackground({ images }: { images: ImageSourcePropType[] }) {
  // Always use Rio photos as background with loop
  const bgImages = RIO_BG_PHOTOS;
  const [idx, setIdx] = useState(0);
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Cycle through Rio photos every 8s (igual home)
  useEffect(() => {
    if (bgImages.length <= 1) return;
    const timer = setInterval(() => {
      setIdx((prev) => (prev + 1) % bgImages.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [bgImages.length]);

  const src = bgImages[idx] ?? bgImages[0];

  function handleDisplay() {
    Animated.timing(overlayAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }

  return (
    <>
      {/* Warm amber base — renders instantly */}
      <LinearGradient
        colors={["#2D1A08", "#1A0E04"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Rio photos with blur 22 */}
      <ExpoImage
        source={src}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#1A0E04" }]}
        contentFit="cover"
        blurRadius={22}
        transition={{ duration: 800, effect: "cross-dissolve" }}
        onDisplay={handleDisplay}
      />
      {/* Dark overlay 0.45 */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: overlayAnim }]}
        pointerEvents="none"
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]} />
      </Animated.View>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action area — Row 1: social chips · Row 2: AI primary CTA
// ─────────────────────────────────────────────────────────────────────────────

function SocialChip({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        act.socialChip,
        pressed && { opacity: 0.65, transform: [{ scale: 0.95 }] },
      ]}
      onPress={onPress}
    >
      <Feather name={icon} size={13} color="rgba(255,255,255,0.75)" />
      <Text style={act.socialLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// URL paste sheet — user pastes an Instagram/TikTok URL → edge function extracts location
// ─────────────────────────────────────────────────────────────────────────────

function UrlPasteSheet({
  source,
  onClose,
  onAdd,
}: {
  source:  "instagram" | "tiktok";
  onClose: () => void;
  onAdd:   (item: SavedItem) => void;
}) {
  const [url,     setUrl]     = useState("");
  const [loading, setLoading] = useState(false);

  const placeholder = source === "instagram"
    ? "https://www.instagram.com/p/..."
    : "https://vm.tiktok.com/...";

  const isValidUrl = url.trim().startsWith("http");

  async function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed.startsWith("http")) {
      Alert.alert("URL inválida", "Cole o link completo do post (começa com https://).");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("lucky-trip-ai", {
        body: { url: trimmed, source },
      });
      if (error || !data?.titulo) throw new Error(error?.message ?? "sem resposta");
      const item: SavedItem = {
        id:          data.id ?? `ext-${Date.now()}`,
        categoria:   (data.categoria as SavedCategory) ?? "oQueFazer",
        titulo:      data.titulo,
        localizacao: data.bairro ?? data.localizacao ?? "Rio de Janeiro",
        image:       data.photo_url
          ? { uri: data.photo_url }
          : getNeighborhoodImage(data.bairro ?? ""),
      };
      onAdd(item);
      onClose();
    } catch {
      Alert.alert(
        "Não consegui identificar o local",
        "Verifique se o link é público e tente novamente. Se o problema persistir, adicione o lugar manualmente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={up.overlay} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={up.sheet}>
        <View style={up.handle} />
        <View style={up.header}>
          <Feather
            name={source === "instagram" ? "instagram" : "video"}
            size={16}
            color={PETROL}
          />
          <Text style={up.title}>
            {source === "instagram" ? "Colar link do Instagram" : "Colar link do TikTok"}
          </Text>
        </View>
        <Text style={up.hint}>
          Abra o post no {source === "instagram" ? "Instagram" : "TikTok"}, copie o link e cole abaixo. A Lucky extrai automaticamente o lugar.
        </Text>
        <TextInput
          style={up.input}
          value={url}
          onChangeText={setUrl}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.30)"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          autoFocus
        />
        <Pressable
          style={({ pressed }) => [
            up.submitBtn,
            (!isValidUrl || loading) && up.submitBtnDisabled,
            pressed && isValidUrl && { opacity: 0.85 },
          ]}
          onPress={handleSubmit}
          disabled={!isValidUrl || loading}
        >
          {loading ? (
            <ActivityIndicator color="#1A1109" size="small" />
          ) : (
            <>
              <Feather name="search" size={14} color="#1A1109" />
              <Text style={up.submitText}>Identificar lugar</Text>
            </>
          )}
        </Pressable>
        <Pressable onPress={onClose} style={up.cancelBtn}>
          <Text style={up.cancelText}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const up = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.60)",
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
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignSelf: "center",
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#F5EFE0",
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 19,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#F5EFE0",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PETROL,
    paddingVertical: 14,
    borderRadius: 14,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#1A1109",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "rgba(255,255,255,0.40)",
  },
});

function ActionArea({
  hasSaved,
  onInstagram,
  onTikTok,
}: {
  hasSaved: boolean;
  onInstagram: () => void;
  onTikTok:    () => void;
}) {
  return (
    <View style={act.wrap}>
      {/* Row 1 — social import chips */}
      <View style={act.socialRow}>
        <SocialChip icon="instagram" label="Instagram" onPress={onInstagram} />
        <SocialChip icon="video"     label="TikTok"    onPress={onTikTok} />
      </View>

      {/* Row 2 — primary AI CTA (dark glass panel, gold accent) */}
      <Pressable
        style={({ pressed }) => [
          act.aiBtn,
          pressed && { opacity: 0.82, transform: [{ scale: 0.985 }] },
        ]}
        onPress={() =>
          hasSaved
            ? router.push({ pathname: "/roteiro", params: { contextual: "1" } })
            : router.push("/roteiro")
        }
      >
        <View style={act.aiLeft}>
          <View style={act.aiIconWrap}>
            <Feather name="zap" size={15} color={PETROL} />
          </View>
          <View>
            <Text style={act.aiLabel}>Criar roteiro inteligente</Text>
            <Text style={act.aiSub}>Baseado nos seus lugares salvos</Text>
          </View>
        </View>
        <Feather name="arrow-right" size={15} color={`${PETROL}90`} />
      </Pressable>
    </View>
  );
}

const act = StyleSheet.create({
  wrap: {
    gap: 10,
    marginBottom: 28,
  },

  // Social chips — glass, cream tint
  socialRow: {
    flexDirection: "row",
    gap: 8,
  },
  socialChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  socialLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
  },

  // AI CTA — dark glass, gold accent (matches home's luckyBlock aesthetic)
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.26)",
    borderWidth: 1,
    borderColor: `${PETROL}28`,
    boxShadow: `0px 4px 20px rgba(27,79,114,0.12)`,
  },
  aiLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  aiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${PETROL}14`,
    borderWidth: 1,
    borderColor: `${PETROL}30`,
    alignItems: "center",
    justifyContent: "center",
  },
  aiLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.cream,
    letterSpacing: 0.1,
  },
  aiSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.48)",
    marginTop: 1,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Saved places — compact horizontal scroll
// ─────────────────────────────────────────────────────────────────────────────

const CARD_W = Math.round((SCREEN_W - 48 - 10) / 2.6);
const CARD_H = Math.round(CARD_W * 1.3);

function SavedCard({
  item,
  onRemove,
}: {
  item: SavedItem;
  onRemove: (id: string) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        sc.card,
        { width: CARD_W, height: CARD_H },
        pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
      ]}
      onPress={() => {
        const table = item.source_table ?? sourceTableFromCategoria(item.categoria);
        console.log("[viagem tap]", { id: item.id, source_table: table, titulo: item.titulo });
        // UUID regex — real Supabase IDs are 36-char UUIDs; static hotel IDs are h1/h2 etc.
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
        if (table === "stay_hotels" && isUUID) {
          router.push({ pathname: "/ondeFicar/hotel/[hotelId]", params: { hotelId: item.id } });
        } else {
          router.push({
            pathname: "/lugar/[cityId]/[placeId]",
            params: { cityId: "rio", placeId: item.id, source_table: table },
          });
        }
      }}
    >
      <ExpoImage source={item.image} style={[StyleSheet.absoluteFillObject, { backgroundColor: "#1A0E04" }]} contentFit="cover" />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.62)"]}
        locations={[0.28, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Pressable
        style={sc.removeBtn}
        onPress={(e) => { e.stopPropagation?.(); onRemove(item.id); }}
        hitSlop={8}
      >
        <Feather name="x" size={9} color="rgba(255,255,255,0.80)" />
      </Pressable>
      <View style={sc.footer}>
        <Text style={sc.catLabel} numberOfLines={1}>
          {CATEGORY_LABEL[item.categoria].toUpperCase()}
        </Text>
        <Text style={sc.name} numberOfLines={2}>{item.titulo}</Text>
      </View>
    </Pressable>
  );
}

const sc = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#100D09",
    marginRight: 10,
    justifyContent: "flex-end",
  },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.20)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  footer: {
    padding: 10,
    gap: 3,
  },
  catLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    color: PETROL,
    letterSpacing: 1.2,
  },
  name: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 12,
    color: C.cream,
    lineHeight: 16,
  },
});

function SavedSection({
  saved,
  onRemove,
}: {
  saved: SavedItem[];
  onRemove: (id: string) => void;
}) {
  // Group saved items by city (cityId field, default "rio")
  const groups = React.useMemo(() => {
    const map = new Map<string, { label: string; items: SavedItem[] }>();
    for (const item of saved) {
      const city = (item as any).cityId ?? "rio";
      const label = (item as any).cityLabel ?? "Rio de Janeiro";
      if (!map.has(city)) map.set(city, { label, items: [] });
      map.get(city)!.items.push(item);
    }
    return Array.from(map.values());
  }, [saved]);

  return (
    <View style={ss.wrap}>
      {groups.map((group, gi) => (
        <View key={gi} style={ss.group}>
          {/* Destination header */}
          <View style={ss.destRow}>
            <Feather name="map-pin" size={11} color={PETROL} />
            <Text style={ss.destLabel}>{group.label}</Text>
            <View style={ss.dot} />
            <Text style={ss.sublabel}>
              {group.items.length === 1 ? "1 lugar" : `${group.items.length} lugares`}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={ss.scroll}
            decelerationRate="fast"
          >
            {group.items.map((item) => (
              <SavedCard key={item.id} item={item} onRemove={onRemove} />
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

const ss = StyleSheet.create({
  wrap: {
    gap: 20,
    marginBottom: 4,
  },
  group: {
    gap: 10,
  },
  destRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  destLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
    letterSpacing: 0.3,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.30)",
  },
  sublabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
  },
  scroll: {
    paddingRight: 8,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Empty hint — dark glass, cream text, gold icon
// ─────────────────────────────────────────────────────────────────────────────

function EmptyHint() {
  return (
    <View style={eh.wrap}>
      <View style={eh.iconRing}>
        <Feather name="bookmark" size={20} color={PETROL} />
      </View>
      <View style={eh.body}>
        <Text style={eh.title}>Nenhum lugar salvo ainda</Text>
        <Text style={eh.desc}>
          Toque no{" "}
          <Text style={eh.bold}>marcador</Text>
          {" "}em qualquer cartão para guardar aqui.
        </Text>
      </View>
    </View>
  );
}

const eh = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  iconRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: `${PETROL}12`,
    borderWidth: 1,
    borderColor: `${PETROL}28`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.cream,
  },
  desc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.50)",
    lineHeight: 20,
  },
  bold: {
    fontFamily: "Inter_600SemiBold",
    color: PETROL,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Roteiro Base — dark glass cards matching home's luckyBlock aesthetic
// ─────────────────────────────────────────────────────────────────────────────

function PeriodoBlock({ periodo, items }: DiaPeriodo) {
  const label = PERIODO_LABEL[periodo];
  const icon  = PERIODO_ICON[periodo] as keyof typeof Feather.glyphMap;
  return (
    <View style={rot.periodoWrap}>
      <View style={rot.periodoHeader}>
        <Feather name={icon} size={10} color={PETROL} />
        <Text style={rot.periodoLabel}>{label}</Text>
      </View>
      {items.map((item) => (
        <View key={item.id} style={rot.itemRow}>
          <View style={rot.itemDot} />
          <Text style={rot.itemNome} numberOfLines={1}>{item.titulo}</Text>
        </View>
      ))}
    </View>
  );
}

function DiaCard({ dia }: { dia: DiaRoteiro }) {
  return (
    <View style={rot.diaCard}>
      <View style={rot.diaHeader}>
        <Text style={rot.diaNum}>DIA {dia.numero}</Text>
        <Text style={rot.diaBairro}>{dia.bairro}</Text>
      </View>
      <View style={rot.separator} />
      {dia.periodos.map((p) => (
        <PeriodoBlock key={p.periodo} {...p} />
      ))}
    </View>
  );
}

function RoteiroSection({ dias }: { dias: DiaRoteiro[] }) {
  if (dias.length === 0) return null;
  return (
    <View style={rot.wrap}>
      <View style={rot.titleRow}>
        <Text style={rot.sectionLabel}>Roteiro Base</Text>
        <View style={rot.pill}>
          <Text style={rot.pillText}>{dias.length} {dias.length === 1 ? "dia" : "dias"}</Text>
        </View>
      </View>
      {dias.map((dia) => (
        <DiaCard key={dia.bairro} dia={dia} />
      ))}
    </View>
  );
}

const rot = StyleSheet.create({
  wrap: {
    marginTop: 28,
    gap: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  pill: {
    backgroundColor: `${PETROL}10`,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `${PETROL}24`,
  },
  pillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: PETROL,
  },
  diaCard: {
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: `${PETROL}18`,
    paddingHorizontal: 18,
    paddingVertical: 16,
    boxShadow: `0px 2px 12px rgba(0,0,0,0.20)`,
  },
  diaHeader: {
    marginBottom: 10,
    gap: 1,
  },
  diaNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: PETROL,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  diaBairro: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 20,
    color: C.cream,
    lineHeight: 26,
  },
  separator: {
    height: 1,
    backgroundColor: `${PETROL}14`,
    marginBottom: 12,
  },
  periodoWrap: {
    marginBottom: 10,
  },
  periodoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 5,
  },
  periodoLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: PETROL,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  itemDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    flexShrink: 0,
  },
  itemNome: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    flex: 1,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function MinhaViagemScreen() {
  const insets    = useSafeAreaInsets();
  const topPad    = Platform.OS === "web" ? 67 : insets.top + 12;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const params    = useLocalSearchParams<{ highlightLast?: string }>();

  const { saved, unsave, save } = useGuia();
  const totalSaved              = saved.length;
  const bgImages                = saved.map((s) => s.image);
  const dias                    = buildRoteiro(saved);

  // URL paste sheet — "instagram" | "tiktok" | null
  const [pasteSource, setPasteSource] = useState<"instagram" | "tiktok" | null>(null);

  // Highlight last added item (from video link feature)
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightFade = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (params.highlightLast === "true" && saved.length > 0) {
      const lastItem = saved[saved.length - 1];
      setHighlightId(lastItem.id);

      // Fade in the badge
      Animated.sequence([
        Animated.timing(highlightFade, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(highlightFade, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setHighlightId(null));

      // Clear the param to avoid re-triggering
      router.setParams({ highlightLast: undefined } as any);
    }
  }, [params.highlightLast, saved.length]);

  return (
    <View style={s.root}>

      {/* ── Cinematic background — always present ── */}
      <SceneBackground images={bgImages} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.content,
          { paddingTop: topPad + 8, paddingBottom: bottomPad + 90 },
        ]}
      >

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.eyebrow}>VIAGEM</Text>
          <View style={s.titleRow}>
            <Text style={s.title}>Minha Viagem</Text>
            {totalSaved > 0 && (
              <View style={s.countBadge}>
                <Text style={s.countText}>{totalSaved}</Text>
              </View>
            )}
          </View>
          <Text style={s.subtitle}>
            {totalSaved === 0
              ? "Suas ideias salvas para a próxima viagem"
              : totalSaved === 1
                ? "1 lugar salvo · Rio de Janeiro"
                : `${totalSaved} lugares salvos · Rio de Janeiro`}
          </Text>
        </View>

        {/* ── Thin rule ── */}
        <View style={s.rule} />

        {/* ── Actions (social chips → AI CTA) ── */}
        <ActionArea
          hasSaved={totalSaved > 0}
          onInstagram={() => setPasteSource("instagram")}
          onTikTok={() => setPasteSource("tiktok")}
        />

        {/* ── Saved places or empty hint ── */}
        {totalSaved > 0 ? (
          <SavedSection saved={saved} onRemove={unsave} />
        ) : (
          <EmptyHint />
        )}

        {/* ── Roteiro Base ── */}
        <RoteiroSection dias={dias} />

      </ScrollView>

      {/* ── URL paste sheet (Instagram / TikTok) ── */}
      {pasteSource && (
        <UrlPasteSheet
          source={pasteSource}
          onClose={() => setPasteSource(null)}
          onAdd={(item) => { save(item); }}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen-level styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1A0E04",
  },
  content: {
    paddingHorizontal: 24,
  },

  // Header — cream text on dark cinematic background
  header: {
    gap: 5,
    marginBottom: 22,
  },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: PETROL,
    letterSpacing: 2.5,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 36,
    color: C.cream,
    lineHeight: 42,
  },
  countBadge: {
    backgroundColor: `${PETROL}22`,
    borderRadius: 14,
    minWidth: 28,
    height: 28,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    borderWidth: 1,
    borderColor: `${PETROL}40`,
  },
  countText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: PETROL,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13.5,
    color: "rgba(255,255,255,0.50)",
    lineHeight: 20,
  },

  // Rule
  rule: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 22,
  },
});
