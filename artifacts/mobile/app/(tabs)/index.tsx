// app/(tabs)/index.tsx — HomeScreen v3 (features completas)
import React, { useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useHeroComposed, HeroComposedItem } from "@/hooks/useHeroComposed";
import { useAmigos } from "@/hooks/useFriends";
import { useGuia, type SavedItem } from "@/context/GuiaContext";

// ═══════════════════════════════════════════════════════════════════════════
// LOGO ASSET
// ═══════════════════════════════════════════════════════════════════════════
const LOGO_WHITE = require("@/assets/images/logo_symbol_white.png");

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const PETROL = "#1B4F72";
const AREIA = "#F5F0E8";
const { width: W, height: H } = Dimensions.get("window");
const SUPABASE = "https://bkwlximkadmlnbgjcrdp.supabase.co";
const FALLBACK = `${SUPABASE}/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg`;
const RIO_DESTINO_ID = "7f047742-427f-4b11-8286-781af899c57d";
const EDGE_FUNCTION_URL = `${SUPABASE}/functions/v1/parse-social-caption`;
const PENDING_PLACES_KEY = "@luckytrip/pending_places";

// ═══════════════════════════════════════════════════════════════════════════
// VIDEO LINK TYPES & UTILS
// ═══════════════════════════════════════════════════════════════════════════
type VideoPlatform = "youtube" | "tiktok" | "instagram" | "invalid";

type VideoLinkState =
  | { status: "idle" }
  | { status: "needs_caption"; platform: "tiktok" | "instagram"; url: string }
  | { status: "loading" }
  | { status: "success"; places: Array<{ nome: string; tipo: string; confianca: number }> }
  | { status: "lucky_message"; message: string; destination?: string }
  | { status: "error"; message: string };

function detectPlatform(input: string): { platform: VideoPlatform; url?: string } {
  const text = input.trim();

  // YouTube (watch, shorts, youtu.be)
  if (/youtube\.com\/(watch|shorts)|youtu\.be\//.test(text)) {
    return { platform: "youtube", url: text };
  }

  // TikTok
  if (/tiktok\.com|vm\.tiktok/.test(text)) {
    return { platform: "tiktok", url: text };
  }

  // Instagram
  if (/instagram\.com|instagr\.am/.test(text)) {
    return { platform: "instagram", url: text };
  }

  // Invalid
  return { platform: "invalid" };
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════
type AgoraItem = { id: string; titulo: string; sub: string; tag: string; foto: string };
type LucklistItem = { id: string; titulo: string; sub: string; foto: string };

// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════
function useHeroPhotos() {
  const [photos, setPhotos] = useState<string[]>([FALLBACK]);

  useEffect(() => {
    supabase.storage.from("media").list("rio-de-janeiro/hero/foto").then(({ data }) => {
      if (data && data.length > 0) {
        const urls = data
          .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f.name))
          .map(f => `${SUPABASE}/storage/v1/object/public/media/rio-de-janeiro/hero/foto/${f.name}`);
        if (urls.length > 0) setPhotos(shuffleArray(urls));
      }
    });
  }, []);

  return photos;
}

// Builds full Supabase storage URL from relative path
function buildMediaUrl(path: string | null | undefined): string {
  if (!path) return FALLBACK;
  if (path.startsWith("http")) return path;
  return `${SUPABASE}/storage/v1/object/public/media/${path}`;
}

// Hook para buscar "Agora no Rio" de destino_destaques
function useAgoraNoRio(destinoId: string) {
  const [items, setItems] = useState<AgoraItem[]>([]);

  useEffect(() => {
    supabase
      .from("destino_destaques")
      .select("id, lugar_id, titulo_override, ordem, lugares(id, nome, hero_image_url, bairro_id, bairros(nome))")
      .eq("destino_id", destinoId)
      .eq("ativo", true)
      .order("ordem")
      .limit(6)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const mapped: AgoraItem[] = data.map((item: any) => ({
            id: item.lugar_id || item.id,
            titulo: item.titulo_override || item.lugares?.nome || "Lugar",
            sub: item.lugares?.bairros?.nome || "",
            tag: "AGORA",
            foto: buildMediaUrl(item.lugares?.hero_image_url),
          }));
          setItems(mapped);
        }
      });
  }, [destinoId]);

  return items;
}

// Hook para buscar lucklists do destino
function useLucklists(destinoId: string) {
  const [items, setItems] = useState<LucklistItem[]>([]);

  useEffect(() => {
    // Primeiro busca a lucklist do destino
    supabase
      .from("lucklists")
      .select("id, titulo, subtitulo, capa_url")
      .eq("destino_id", destinoId)
      .eq("ativo", true)
      .order("ordem")
      .limit(1)
      .single()
      .then(({ data: lucklist }) => {
        if (!lucklist) return;

        // Depois busca os lugares dessa lucklist
        supabase
          .from("lucklist_lugares")
          .select("lugar_id, lugares(id, nome, hero_image_url, bairro_id, bairros(nome))")
          .eq("lucklist_id", lucklist.id)
          .limit(6)
          .then(({ data }) => {
            if (data && data.length > 0) {
              const mapped: LucklistItem[] = data.map((item: any) => ({
                id: item.lugar_id || item.id,
                titulo: item.lugares?.nome || "Lugar",
                sub: item.lugares?.bairros?.nome || "",
                foto: buildMediaUrl(item.lugares?.hero_image_url),
              }));
              setItems(mapped);
            }
          });
      });
  }, [destinoId]);

  return items;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function TopBar({ top, onMusicPress, onGalleryPress }: { top: number; onMusicPress: () => void; onGalleryPress: () => void }) {
  return (
    <View style={[styles.topBar, { paddingTop: top + 8 }]}>
      {/* Espaço vazio no lugar do botão voltar (home não tem tela anterior) */}
      <View style={styles.topLeftSpacer} />
      {/* Logo cursiva oficial */}
      <Image source={LOGO_WHITE} style={styles.logo} resizeMode="contain" />
      <View style={styles.topRight}>
        <Pressable style={styles.iconBtn} onPress={onMusicPress}>
          <Ionicons name="musical-notes" size={18} color="#FFF" />
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={onGalleryPress}>
          <Ionicons name="play" size={16} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HeroDestaque: carrossel com swipe horizontal + auto-play
// ═══════════════════════════════════════════════════════════════════════════
function HeroDestaque({
  top,
  items,
  carouselIdx,
  setCarouselIdx,
  flatListRef,
  rioPhotos,
  rioBgIdx,
}: {
  top: number;
  items: HeroComposedItem[];
  carouselIdx: number;
  setCarouselIdx: (idx: number) => void;
  flatListRef: React.RefObject<FlatList | null>;
  rioPhotos: string[];
  rioBgIdx: number;
}) {
  // Handle swipe end — update carouselIdx
  const onMomentumScrollEnd = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    if (idx !== carouselIdx && idx >= 0 && idx < items.length) {
      setCarouselIdx(idx);
    }
  };

  // Render each hero slide
  const renderItem = ({ item, index }: { item: HeroComposedItem; index: number }) => {
    const isAmigo = item.source_table === "amigos";
    const isDestino = item.source_table === "destinos";
    const isRio = isDestino && item.route.type === "cidade" &&
                  (item.route.slug === "rio-de-janeiro" || item.route.slug === "rio");

    // Para Rio, usar foto rotativa do bucket; para outros, usar photo_url do item
    const photoUrl = isRio ? (rioPhotos[rioBgIdx] || item.photo_url || FALLBACK) : (item.photo_url || FALLBACK);

    const handlePress = () => {
      switch (item.route.type) {
        case "cidade":
          router.push({ pathname: "/cidade/[id]", params: { id: item.route.slug } });
          break;
        case "amigo":
          router.push({ pathname: "/amigo/[slug]", params: { slug: item.route.slug } });
          break;
        case "lugar":
          router.push({ pathname: "/lugar/[id]", params: { id: item.route.lugarId } });
          break;
        case "lucklist":
          router.push({ pathname: "/(tabs)/luckyList/[id]", params: { id: item.route.slug } });
          break;
      }
    };

    // Determinar kicker baseado no tipo
    const kicker = isAmigo ? "VIAJE COM" : item.badge.toUpperCase();

    return (
      <Pressable style={styles.heroSlide} onPress={handlePress}>
        <Image source={{ uri: photoUrl }} style={styles.heroDestaqueImage} />
        <LinearGradient
          colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.5)", "rgba(10,10,10,1)"]}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroTitleContainer, { paddingTop: top + 70 }]}>
          <Text style={styles.heroKicker}>{kicker}</Text>
          <Text style={styles.heroTitleText}>{item.titulo}</Text>
          <Text style={styles.heroSub}>{item.localizacao.toUpperCase()}</Text>
        </View>
      </Pressable>
    );
  };

  if (items.length === 0) {
    return (
      <View style={styles.heroDestaque}>
        <Image source={{ uri: FALLBACK }} style={styles.heroDestaqueImage} />
        <LinearGradient colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.5)", "rgba(10,10,10,1)"]} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
        <View style={[styles.heroTitleContainer, { paddingTop: top + 70 }]}>
          <Text style={styles.heroKicker}>DESTINO</Text>
          <Text style={styles.heroTitleText}>Rio de Janeiro</Text>
          <Text style={styles.heroSub}>Carregando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.heroDestaque}>
      <FlatList
        ref={flatListRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
        initialScrollIndex={0}
      />
      {/* Dots indicator */}
      <View style={styles.dotsContainer}>
        {items.slice(0, 8).map((_, i) => (
          <View key={i} style={[styles.dot, i === carouselIdx && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

function InputBar() {
  const { save } = useGuia();
  const [linkValue, setLinkValue] = useState("");
  const [captionValue, setCaptionValue] = useState("");
  const [state, setState] = useState<VideoLinkState>({ status: "idle" });
  const [modalVisible, setModalVisible] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleSubmitLink = () => {
    const { platform, url } = detectPlatform(linkValue);

    if (platform === "invalid") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake();
      setState({ status: "error", message: "Cole um link de vídeo do YouTube, TikTok ou Instagram" });
      setTimeout(() => setState({ status: "idle" }), 3000);
      return;
    }

    if (platform === "youtube") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      processVideo("youtube", url!);
    } else {
      // TikTok ou Instagram → precisa de caption
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setState({ status: "needs_caption", platform, url: url! });
    }
  };

  const handleSubmitWithCaption = () => {
    if (state.status !== "needs_caption") return;
    if (!captionValue.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    processVideo(state.platform, state.url, captionValue.trim());
  };

  const processVideo = async (platform: "youtube" | "tiktok" | "instagram", url: string, caption?: string) => {
    setState({ status: "loading" });
    setModalVisible(true);

    try {
      // Get session if exists (for userId), but don't require it
      const { data: { session } } = await supabase.auth.getSession();

      const body: Record<string, any> = {
        platform,
        url,
        destinoSlug: "rio-de-janeiro",
        userId: session?.user?.id ?? null, // null if not logged in
      };

      if (caption) {
        body.caption = caption;
      }

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && { "Authorization": `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Erro ${response.status}`);
      }

      const data = await response.json();

      if (data.type === "places_found") {
        // Save locally for anonymous users
        if (!session) {
          const existing = await AsyncStorage.getItem(PENDING_PLACES_KEY);
          const pending = existing ? JSON.parse(existing) : [];
          pending.push(...data.places.map((p: any) => ({ ...p, addedAt: Date.now() })));
          await AsyncStorage.setItem(PENDING_PLACES_KEY, JSON.stringify(pending));
        }
        setState({ status: "success", places: data.places });
      } else if (data.type === "place_found" && data.place) {
        // Lugar único reconhecido: salvar e navegar para Viagem
        const p = data.place;
        const savedItem: SavedItem = {
          id: p.id,
          titulo: p.nome,
          categoria: p.categoria === "restaurante" ? "restaurante" : "oQueFazer",
          localizacao: p.bairro || "Rio de Janeiro",
          image: p.hero_image_url ? { uri: p.hero_image_url } : undefined,
          source_table: "lugares",
        };
        save(savedItem);
        setModalVisible(false);
        router.push("/(tabs)/viagem");
        return;
      } else if (data.type === "destination_recognized") {
        setState({ status: "lucky_message", message: data.message, destination: data.destination });
      } else {
        // Não reconhecido: mensagem amigável
        setState({ status: "lucky_message", message: "Em breve teremos! Estamos expandindo nossa curadoria." });
      }
    } catch (err: any) {
      console.error("[VideoLink] Error:", err);
      setState({ status: "error", message: err.message || "Erro ao processar. Tente novamente." });
    }
  };

  const resetState = () => {
    setLinkValue("");
    setCaptionValue("");
    setState({ status: "idle" });
    setModalVisible(false);
  };

  const goToViagem = () => {
    resetState();
    router.push({ pathname: "/(tabs)/viagem", params: { highlightLast: "true" } } as any);
  };

  const detectedPlatform = detectPlatform(linkValue).platform;

  return (
    <>
      <Animated.View style={[styles.inputWrap, { transform: [{ translateX: shakeAnim }] }]}>
        <View style={styles.inputBar}>
          <View style={styles.socialIcons}>
            <View style={[styles.socialIcon, { backgroundColor: "#E1306C" }, detectedPlatform === "instagram" && styles.socialIconActive]}>
              <Ionicons name="logo-instagram" size={14} color="#FFF" />
            </View>
            <View style={[styles.socialIcon, { backgroundColor: "#000" }, detectedPlatform === "tiktok" && styles.socialIconActive]}>
              <Ionicons name="logo-tiktok" size={14} color="#FFF" />
            </View>
            <View style={[styles.socialIcon, { backgroundColor: "#FF0000" }, detectedPlatform === "youtube" && styles.socialIconActive]}>
              <Ionicons name="logo-youtube" size={14} color="#FFF" />
            </View>
          </View>
          <TextInput
            style={styles.inputText}
            placeholder="Cole um link do YouTube, TikTok ou Instagram"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={linkValue}
            onChangeText={setLinkValue}
            onSubmitEditing={handleSubmitLink}
            returnKeyType="go"
            autoCapitalize="none"
            autoCorrect={false}
            editable={state.status === "idle" || state.status === "error"}
          />
          {state.status === "loading" && (
            <ActivityIndicator size="small" color="#FFF" style={{ marginLeft: 8 }} />
          )}
        </View>

        {/* Error message */}
        {state.status === "error" && (
          <Text style={styles.inputError}>{state.message}</Text>
        )}

        {/* Caption input for TikTok/Instagram */}
        {state.status === "needs_caption" && (
          <View style={styles.captionContainer}>
            <Text style={styles.captionHint}>
              ℹ️ Pra ler esse vídeo, cola também a legenda:
            </Text>
            <TextInput
              style={styles.captionInput}
              placeholder="Cole a legenda do post aqui..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={captionValue}
              onChangeText={setCaptionValue}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <Pressable style={styles.captionSubmitBtn} onPress={handleSubmitWithCaption}>
              <Text style={styles.captionSubmitText}>Encontrar lugares</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>

      {/* Loading/Result Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.videoModalOverlay}>
          <View style={styles.videoModalContent}>
            {state.status === "loading" && (
              <>
                <Text style={styles.videoModalTitle}>Olhando esse vídeo</Text>
                <Text style={styles.videoModalTitleLine2}>pra você...</Text>
                <ActivityIndicator size="large" color={PETROL} style={{ marginTop: 24 }} />
              </>
            )}

            {state.status === "success" && (
              <>
                <Ionicons name="checkmark-circle" size={48} color="#27AE60" />
                <Text style={styles.videoModalSuccessTitle}>
                  {state.places.length} {state.places.length === 1 ? "lugar encontrado" : "lugares encontrados"}!
                </Text>
                <View style={styles.videoModalPlacesList}>
                  {state.places.slice(0, 5).map((place, idx) => (
                    <View key={idx} style={styles.videoModalPlaceItem}>
                      <Ionicons name="location" size={16} color={PETROL} />
                      <Text style={styles.videoModalPlaceName}>{place.nome}</Text>
                    </View>
                  ))}
                </View>
                <Pressable style={styles.videoModalPrimaryBtn} onPress={goToViagem}>
                  <Text style={styles.videoModalPrimaryBtnText}>Ver minha viagem</Text>
                </Pressable>
                <Pressable style={styles.videoModalSecondaryBtn} onPress={resetState}>
                  <Text style={styles.videoModalSecondaryBtnText}>Adicionar outro vídeo</Text>
                </Pressable>
              </>
            )}

            {state.status === "lucky_message" && (
              <>
                {state.destination && (
                  <Text style={styles.videoModalDestination}>{state.destination}</Text>
                )}
                <Text style={styles.videoModalLuckyMessage}>{state.message}</Text>
                <Pressable style={styles.videoModalSecondaryBtn} onPress={resetState}>
                  <Text style={styles.videoModalSecondaryBtnText}>Tentar outro vídeo</Text>
                </Pressable>
              </>
            )}

            {state.status === "error" && modalVisible && (
              <>
                <Ionicons name="close-circle" size={48} color="#E74C3C" />
                <Text style={styles.videoModalErrorTitle}>Ops!</Text>
                <Text style={styles.videoModalErrorMessage}>{state.message}</Text>
                <Pressable style={styles.videoModalPrimaryBtn} onPress={resetState}>
                  <Text style={styles.videoModalPrimaryBtnText}>Tentar novamente</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function SectionHeader({ label, right, onPress }: { label: string; right?: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {right && (
        <Pressable style={styles.seeAll} onPress={onPress}>
          <Text style={styles.seeAllText}>{right}</Text>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.6)" />
        </Pressable>
      )}
    </View>
  );
}

function ViajeComEles() {
  const { amigos } = useAmigos();

  // Divide nome em nome + sobrenome para exibição
  const formatNome = (nome: string) => {
    const partes = nome.split(" ");
    return { nome: partes[0], sobrenome: partes.slice(1).join(" ") };
  };

  if (amigos.length === 0) return null;

  return (
    <View style={styles.sectionFrameOuter}>
      <BlurView intensity={40} tint="dark" style={styles.sectionBlur}>
        <View style={styles.sectionFrameInner}>
          <View style={styles.viajeHeader}>
            <Text style={styles.sectionLabel}>VIAJE COM ELES</Text>
            <Pressable style={styles.seeAll} onPress={() => router.push("/amigo/all")}>
              <Text style={styles.seeAllText}>Ver todos</Text>
              <Ionicons name="chevron-forward" size={14} color={PETROL} />
            </Pressable>
          </View>
          <View style={styles.viajeRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.amigosRow}>
              {amigos.map(a => {
                const { nome, sobrenome } = formatNome(a.nome);
                return (
                  <Pressable key={a.id} style={styles.amigoItem} onPress={() => router.push(`/amigo/${a.slug}`)}>
                    <Image source={{ uri: a.foto_url || FALLBACK }} style={styles.amigoFoto} />
                    <Text style={styles.amigoNome}>{nome}</Text>
                    <Text style={styles.amigoSobrenome}>{sobrenome}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {/* Seta à direita */}
            <Pressable style={styles.viajeArrow} onPress={() => router.push("/amigo/all")}>
              <Ionicons name="chevron-forward" size={20} color={PETROL} />
            </Pressable>
          </View>
        </View>
      </BlurView>
    </View>
  );
}

function AgoraNoDestino({ destinoNome, destinoId }: { destinoNome: string; destinoId: string }) {
  const items = useAgoraNoRio(destinoId);
  const nomeFormatado = destinoNome === "Rio de Janeiro" ? "RIO" : destinoNome.toUpperCase();

  if (items.length === 0) return null;

  return (
    <View style={styles.sectionFrameOuter}>
      <BlurView intensity={40} tint="dark" style={styles.sectionBlur}>
        <View style={styles.sectionFrameInner}>
          <View style={styles.agoraHeader}>
            <View>
              <Text style={styles.sectionLabel}>AGORA NO {nomeFormatado}</Text>
              <Text style={styles.agoraUpdated}>Atualizado agora</Text>
            </View>
            <Pressable style={styles.seeAll} onPress={() => router.push("/(tabs)/agoraNoRio/all")}>
              <Text style={styles.seeAllText}>Ver todos</Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRowFrame}>
            {items.map(item => (
              <Pressable key={item.id} style={styles.card} onPress={() => router.push(`/lugar/${item.id}`)}>
                <Image source={{ uri: item.foto }} style={styles.cardImg} />
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={StyleSheet.absoluteFill} />
                <View style={styles.cardTag}>
                  <Text style={styles.cardTagText}>{item.tag}</Text>
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.titulo}</Text>
                  <View style={styles.cardLoc}>
                    <Ionicons name="location-outline" size={10} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.cardLocText}>{item.sub}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </BlurView>
    </View>
  );
}

function LucklistsSection({ destinoNome, items }: { destinoNome: string; items: LucklistItem[] }) {
  const nomeFormatado = destinoNome === "Rio de Janeiro" ? "DO RIO" : `DE ${destinoNome.toUpperCase()}`;

  if (items.length === 0) return null;

  return (
    <View style={styles.sectionFrameOuter}>
      <BlurView intensity={40} tint="dark" style={styles.sectionBlur}>
        <View style={styles.sectionFrameInner}>
          <SectionHeader label={`LUCKLISTS ${nomeFormatado}`} right="Ver todos >" onPress={() => router.push("/(tabs)/luckyList/all")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRowFrame}>
            {items.map(item => (
              <Pressable key={item.id} style={styles.card} onPress={() => router.push(`/lugar/${item.id}`)}>
                <Image source={{ uri: item.foto }} style={styles.cardImg} />
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={StyleSheet.absoluteFill} />
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.titulo}</Text>
                  <Text style={styles.cardSub}>{item.sub}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </BlurView>
    </View>
  );
}

function TrilhaDaViagem() {
  const bars = useRef(Array.from({ length: 12 }, () => new Animated.Value(Math.random()))).current;

  useEffect(() => {
    bars.forEach((bar, i) => {
      const animate = () => {
        Animated.sequence([
          Animated.timing(bar, { toValue: Math.random(), duration: 200 + i * 30, useNativeDriver: false }),
          Animated.timing(bar, { toValue: Math.random() * 0.5 + 0.2, duration: 200 + i * 30, useNativeDriver: false }),
        ]).start(animate);
      };
      animate();
    });
  }, []);

  return (
    <View style={styles.trilhaSection}>
      <Text style={styles.sectionLabel}>TRILHA DA VIAGEM</Text>
      <Pressable style={styles.trilhaCard} onPress={() => router.push("/trilha")}>
        <Image source={{ uri: FALLBACK }} style={styles.trilhaThumb} />
        <View style={styles.trilhaText}>
          <Text style={styles.trilhaTitle}>Rio de Janeiro</Text>
          <Text style={styles.trilhaSub}>A trilha sonora perfeita para a cidade.</Text>
          <Text style={styles.trilhaPlaylist}>Playlist by The Lucky Trip</Text>
        </View>
        <View style={styles.playBtn}>
          <Ionicons name="play" size={18} color="#FFF" />
        </View>
        <View style={styles.waveform}>
          {bars.map((bar, i) => (
            <Animated.View
              key={i}
              style={[styles.waveBar, { height: bar.interpolate({ inputRange: [0, 1], outputRange: [4, 20] }) }]}
            />
          ))}
        </View>
      </Pressable>
    </View>
  );
}

// ── Music Modal ──────────────────────────────────────────────────────────────
function MusicModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.musicModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Trilhas Sonoras</Text>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </Pressable>
          </View>
          <Pressable style={styles.playlistItem}>
            <Image source={{ uri: FALLBACK }} style={styles.playlistThumb} />
            <View style={styles.playlistInfo}>
              <Text style={styles.playlistName}>Rio de Janeiro</Text>
              <Text style={styles.playlistSub}>Trilha Sonora • 42 músicas</Text>
            </View>
            <View style={styles.playlistPlay}>
              <Ionicons name="play" size={20} color="#FFF" />
            </View>
          </Pressable>
          <Text style={styles.comingSoonText}>Mais playlists em breve...</Text>
        </View>
      </View>
    </Modal>
  );
}

// ── Gallery Modal ────────────────────────────────────────────────────────────
function GalleryModal({ visible, onClose, photos }: { visible: boolean; onClose: () => void; photos: string[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.galleryContainer}>
        <Pressable style={styles.galleryClose} onPress={onClose}>
          <Ionicons name="close" size={28} color="#FFF" />
        </Pressable>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / W);
            setCurrentIdx(idx);
          }}
          renderItem={({ item }) => (
            <Image source={{ uri: item }} style={styles.galleryImage} resizeMode="contain" />
          )}
          keyExtractor={(item, i) => i.toString()}
        />
        <View style={styles.galleryDots}>
          <Text style={styles.galleryCounter}>{currentIdx + 1} / {photos.length}</Text>
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 0 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const photos = useHeroPhotos();
  const { items: heroItems, loading: heroLoading } = useHeroComposed();
  const lucklistItems = useLucklists(RIO_DESTINO_ID);
  const [musicModalVisible, setMusicModalVisible] = useState(false);
  const [galleryModalVisible, setGalleryModalVisible] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // SISTEMA 1 — BACKGROUND (13 segundos, todas as fotos do bucket hero/foto)
  // ═══════════════════════════════════════════════════════════════════════════
  const [bgIdx, setBgIdx] = useState(0);
  const bgIdxRef = useRef(0);
  const bgFade = useRef(new Animated.Value(1)).current;

  useEffect(() => { bgIdxRef.current = bgIdx; }, [bgIdx]);

  useEffect(() => {
    if (photos.length <= 1) return;
    const interval = setInterval(() => {
      const nextIdx = (bgIdxRef.current + 1) % photos.length;
      bgFade.setValue(0);
      setBgIdx(nextIdx);
      Animated.timing(bgFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 13000);
    return () => clearInterval(interval);
  }, [photos.length]);

  const currentBgPhoto = photos[bgIdx] || FALLBACK;

  // ═══════════════════════════════════════════════════════════════════════════
  // SISTEMA 2 — CARROSSEL DE DESTAQUES (5 segundos, swipeable)
  // ═══════════════════════════════════════════════════════════════════════════
  const [carouselIdx, setCarouselIdx] = useState(0);
  const carouselIdxRef = useRef(0);
  const heroFlatListRef = useRef<FlatList>(null);

  useEffect(() => { carouselIdxRef.current = carouselIdx; }, [carouselIdx]);

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (heroItems.length <= 1) return;
    const interval = setInterval(() => {
      const nextIdx = (carouselIdxRef.current + 1) % heroItems.length;
      setCarouselIdx(nextIdx);
      // Scroll FlatList to the new index
      heroFlatListRef.current?.scrollToIndex({ index: nextIdx, animated: true });
    }, 5000);
    return () => clearInterval(interval);
  }, [heroItems.length]);

  // Nome do destino atual (para seções dinâmicas)
  const currentItem = heroItems[carouselIdx];
  const destinoNome = currentItem?.source_table === "destinos" ? currentItem.titulo : "Rio de Janeiro";

  return (
    <View style={styles.root}>
      {/* ═══ BACKGROUND: só visível abaixo do primeiro terço ═══ */}
      <View style={styles.bgContainer}>
        <Animated.Image source={{ uri: currentBgPhoto }} style={[styles.bgImage, { opacity: bgFade }]} resizeMode="cover" />
        <View style={styles.overlay} />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.55)"]} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
      </View>

      {/* ═══ HERO DESTAQUE: primeiro terço com crossFade próprio ═══ */}
      <HeroDestaque
        top={top}
        items={heroItems}
        carouselIdx={carouselIdx}
        setCarouselIdx={setCarouselIdx}
        flatListRef={heroFlatListRef}
        rioPhotos={photos}
        rioBgIdx={bgIdx}
      />

      {/* TopBar */}
      <TopBar top={top} onMusicPress={() => setMusicModalVisible(true)} onGalleryPress={() => setGalleryModalVisible(true)} />

      {/* Modals */}
      <MusicModal visible={musicModalVisible} onClose={() => setMusicModalVisible(false)} />
      <GalleryModal visible={galleryModalVisible} onClose={() => setGalleryModalVisible(false)} photos={photos} />

      {/* Content */}
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: bottom + 90, paddingTop: H * 0.38 }} showsVerticalScrollIndicator={false}>
        {/* Input */}
        <InputBar />

        {/* Sections */}
        <ViajeComEles />
        <AgoraNoDestino destinoNome={destinoNome} destinoId={RIO_DESTINO_ID} />
        <LucklistsSection destinoNome={destinoNome} items={lucklistItems} />
        <TrilhaDaViagem />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A" },
  scroll: { flex: 1 },

  // Background (só visível abaixo do primeiro terço)
  bgContainer: { position: "absolute", top: H * 0.38, left: 0, right: 0, bottom: 0, overflow: "hidden" },
  bgImage: { position: "absolute", width: W, height: H, top: -H * 0.38 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },

  // HeroDestaque (primeiro terço - fundo sólido, crossFade próprio)
  heroDestaque: { position: "absolute", top: 0, left: 0, right: 0, height: H * 0.38, backgroundColor: "#000", zIndex: 5 },
  heroSlide: { width: W, height: H * 0.38 },
  heroDestaqueImage: { position: "absolute", width: "100%", height: "100%" },

  // TopBar
  topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  topLeftSpacer: { width: 40 },
  logo: { width: 36, height: 36 },
  topRight: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },

  // Hero Title (at top)
  heroTitleContainer: { paddingHorizontal: 20 },
  heroKicker: { fontFamily: "Inter_500Medium", fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.8)", marginBottom: 6 },
  heroTitleText: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 38, color: "#FFF", marginBottom: 6 },
  heroSub: { fontFamily: "Inter_400Regular", fontSize: 15, color: "rgba(255,255,255,0.9)", marginBottom: 6 },
  heroPais: { fontFamily: "Inter_500Medium", fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.7)" },
  dotsContainer: { position: "absolute", bottom: 16, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dots: { flexDirection: "row", gap: 4, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { width: 18, backgroundColor: "#FFF" },

  // Input - glass style
  inputWrap: { paddingHorizontal: 16, marginBottom: 12 },
  inputBar: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, height: 44, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  socialIcons: { flexDirection: "row", gap: 4 },
  socialIcon: { width: 28, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center", opacity: 0.6 },
  socialIconActive: { opacity: 1, transform: [{ scale: 1.1 }] },
  inputPlaceholder: { flex: 1, marginLeft: 10, fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.6)" },
  inputText: { flex: 1, marginLeft: 10, fontFamily: "Inter_400Regular", fontSize: 13, color: "#FFF" },
  inputError: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#E74C3C", marginTop: 6, marginLeft: 4 },

  // Caption input for TikTok/Instagram
  captionContainer: { marginTop: 12, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  captionHint: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 8 },
  captionInput: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 8, padding: 12, fontFamily: "Inter_400Regular", fontSize: 14, color: "#FFF", minHeight: 80, textAlignVertical: "top" },
  captionSubmitBtn: { backgroundColor: PETROL, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  captionSubmitText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#FFF" },

  // Video Link Modal
  videoModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  videoModalContent: { backgroundColor: AREIA, borderRadius: 20, padding: 28, width: W - 48, alignItems: "center" },
  videoModalTitle: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 24, color: PETROL, textAlign: "center" },
  videoModalTitleLine2: { fontFamily: "PlayfairDisplay_400Regular_Italic", fontSize: 24, color: PETROL, textAlign: "center", marginBottom: 8 },
  videoModalSuccessTitle: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 20, color: PETROL, marginTop: 16, textAlign: "center" },
  videoModalPlacesList: { width: "100%", marginTop: 16, marginBottom: 20 },
  videoModalPlaceItem: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  videoModalPlaceName: { fontFamily: "Inter_500Medium", fontSize: 14, color: "#333" },
  videoModalDestination: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: PETROL, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 },
  videoModalLuckyMessage: { fontFamily: "PlayfairDisplay_400Regular", fontSize: 17, color: "#333", lineHeight: 26, textAlign: "center", marginBottom: 20 },
  videoModalErrorTitle: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 20, color: "#333", marginTop: 12 },
  videoModalErrorMessage: { fontFamily: "Inter_400Regular", fontSize: 14, color: "#666", textAlign: "center", marginTop: 8, marginBottom: 20, lineHeight: 20 },
  videoModalPrimaryBtn: { backgroundColor: PETROL, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: "100%", alignItems: "center" },
  videoModalPrimaryBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#FFF" },
  videoModalSecondaryBtn: { paddingVertical: 12, marginTop: 8 },
  videoModalSecondaryBtnText: { fontFamily: "Inter_500Medium", fontSize: 14, color: PETROL },

  // Sections - compact
  sectionCompact: { marginBottom: 8 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, marginBottom: 8 },
  sectionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1.5, color: "rgba(255,255,255,0.7)", textTransform: "uppercase" },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { fontFamily: "Inter_500Medium", fontSize: 12, color: "rgba(255,255,255,0.6)" },

  // Glassmorphism frame (estilo iOS widget / Instagram)
  sectionFrameOuter: {
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  sectionBlur: {
    borderRadius: 20,
    overflow: "hidden",
  },
  sectionFrameInner: {
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  cardsRowFrame: { paddingHorizontal: 12, gap: 10 },

  // Viaje com eles
  viajeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, marginBottom: 8 },
  viajeRow: { flexDirection: "row", alignItems: "center" },
  viajeArrow: { width: 32, height: 56, alignItems: "center", justifyContent: "center", marginRight: 6 },
  amigosRow: { paddingLeft: 14, gap: 12, alignItems: "center" },
  amigoItem: { alignItems: "center", width: 60 },
  amigoFoto: { width: 56, height: 56, borderRadius: 28, marginBottom: 6 },
  amigoNome: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#FFF", textAlign: "center" },
  amigoSobrenome: { fontFamily: "Inter_400Regular", fontSize: 10, color: "rgba(255,255,255,0.7)", textAlign: "center" },

  // Agora no Rio
  agoraHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 14, marginBottom: 8 },
  agoraUpdated: { fontFamily: "Inter_400Regular", fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2 },

  // Cards 120x120
  cardsRow: { paddingHorizontal: 16, gap: 10 },
  card: { width: 120, height: 120, borderRadius: 10, overflow: "hidden", backgroundColor: "#1A1A1A" },
  cardImg: { width: "100%", height: "100%" },
  cardTag: { position: "absolute", top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: PETROL },
  cardTagText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#FFF", letterSpacing: 0.5 },
  cardContent: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 8 },
  cardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#FFF", lineHeight: 16 },
  cardSub: { fontFamily: "Inter_400Regular", fontSize: 9, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  cardLoc: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  cardLocText: { fontFamily: "Inter_400Regular", fontSize: 9, color: "rgba(255,255,255,0.7)" },

  // Trilha
  trilhaSection: { paddingHorizontal: 16, marginBottom: 8 },
  trilhaCard: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 10, gap: 10 },
  trilhaThumb: { width: 48, height: 48, borderRadius: 8 },
  trilhaText: { flex: 1 },
  trilhaTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#FFF" },
  trilhaSub: { fontFamily: "Inter_400Regular", fontSize: 10, color: "rgba(255,255,255,0.6)" },
  trilhaPlaylist: { fontFamily: "Inter_400Regular", fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  playBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: PETROL, alignItems: "center", justifyContent: "center" },
  waveform: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 20 },
  waveBar: { width: 3, borderRadius: 1.5, backgroundColor: PETROL },

  // Music Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  musicModal: { backgroundColor: "#1A1A1A", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: "#FFF" },
  modalClose: { padding: 4 },
  playlistItem: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 12, gap: 12 },
  playlistThumb: { width: 56, height: 56, borderRadius: 8 },
  playlistInfo: { flex: 1 },
  playlistName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#FFF" },
  playlistSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  playlistPlay: { width: 40, height: 40, borderRadius: 20, backgroundColor: PETROL, alignItems: "center", justifyContent: "center" },
  comingSoonText: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 20 },

  // Gallery Modal
  galleryContainer: { flex: 1, backgroundColor: "#000" },
  galleryClose: { position: "absolute", top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  galleryImage: { width: W, height: H },
  galleryDots: { position: "absolute", bottom: 50, left: 0, right: 0, alignItems: "center" },
  galleryCounter: { fontFamily: "Inter_500Medium", fontSize: 14, color: "#FFF" },
});
