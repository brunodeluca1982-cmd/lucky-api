/**
 * colar-video.tsx — Tela para colar links/captions de vídeos sociais
 *
 * Integra com Edge Function parse-social-caption para extrair lugares
 * mencionados em vídeos do YouTube, TikTok e Instagram.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useGuia, type SavedItem } from "@/context/GuiaContext";

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

const AREIA = "#F5F0E8";
const PETROLEO = "#1B4F72";
const EDGE_FUNCTION_URL = "https://bkwlximkadmlnbgjcrdp.supabase.co/functions/v1/parse-social-caption";
const STORAGE_BASE = "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/";
const FALLBACK_IMAGE = require("@/assets/images/hero-rio.png");

type PlatformTab = "youtube" | "tiktok" | "instagram";

interface PlaceFound {
  id: string;
  nome: string;
  categoria: string;
  bairro: string | null;
  hero_image_url: string | null;
  slug: string;
}

type ResultType =
  | { type: "place_found"; place: PlaceFound }
  | { type: "destination_recognized"; message: string; destination: string }
  | { type: "nothing_found"; message: string };

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function ColarVideoScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ destinoSlug?: string }>();
  const destinoSlug = params.destinoSlug || "rio-de-janeiro";
  const { save } = useGuia();

  const [activeTab, setActiveTab] = useState<PlatformTab>("youtube");
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Auto-detect platform and submit when pasting URL ────────────────────────
  useEffect(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const isYouTube = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)/i.test(trimmed);
    const isTikTok = /tiktok\.com\//i.test(trimmed);
    const isInstagram = /instagram\.com\//i.test(trimmed);

    if (isYouTube || isTikTok || isInstagram) {
      if (isYouTube) setActiveTab("youtube");
      else if (isTikTok) setActiveTab("tiktok");
      else setActiveTab("instagram");

      const timer = setTimeout(() => {
        submitToEdgeFunction();
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [inputValue]);

  // ── Submit to Edge Function ─────────────────────────────────────────────────
  const submitToEdgeFunction = async () => {
    if (!inputValue.trim()) {
      setError("Cole um link ou legenda primeiro");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Pega sessão SE existir, mas não bloqueia se não tiver
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;

      // Token: do user logado OU anon key como fallback
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
      const accessToken = session?.access_token || anonKey;

      const body: Record<string, any> = {
        platform: activeTab,
        destinoSlug,
        userId, // pode ser null se não logado
      };

      if (activeTab === "youtube") {
        body.url = inputValue.trim();
      } else {
        body.caption = inputValue.trim();
      }

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "apikey": anonKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error("Edge function error:", err);
      setError(err.message || "Erro ao processar");
    } finally {
      setLoading(false);
    }
  };

  // ── Reset to try again ──────────────────────────────────────────────────────
  const resetForm = () => {
    setInputValue("");
    setResult(null);
    setError(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={PETROLEO} />
        </Pressable>
        <Text style={styles.headerTitle}>Adicionar do vídeo</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Show result or form */}
          {result ? (
            <ResultView result={result} onReset={resetForm} onSave={save} />
          ) : (
            <>
              {/* Tabs */}
              <View style={styles.tabs}>
                {(["youtube", "tiktok", "instagram"] as PlatformTab[]).map((tab) => (
                  <Pressable
                    key={tab}
                    style={[styles.tab, activeTab === tab && styles.tabActive]}
                    onPress={() => {
                      setActiveTab(tab);
                      setInputValue("");
                      setError(null);
                    }}
                  >
                    <Ionicons
                      name={`logo-${tab}` as any}
                      size={18}
                      color={activeTab === tab ? PETROLEO : "#999"}
                    />
                    <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    activeTab !== "youtube" && styles.inputMultiline,
                  ]}
                  placeholder={
                    activeTab === "youtube"
                      ? "Cole o link do YouTube"
                      : `Cole a legenda do ${activeTab === "tiktok" ? "TikTok" : "Instagram"}`
                  }
                  placeholderTextColor="#999"
                  value={inputValue}
                  onChangeText={setInputValue}
                  multiline={activeTab !== "youtube"}
                  numberOfLines={activeTab !== "youtube" ? 6 : 1}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Error */}
              {error && (
                <Text style={styles.errorText}>{error}</Text>
              )}

              {/* Submit Button */}
              <Pressable
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={submitToEdgeFunction}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Encontrar lugares</Text>
                )}
              </Pressable>

              {/* Helper text */}
              <Text style={styles.helperText}>
                {activeTab === "youtube"
                  ? "Cole a URL completa do vídeo do YouTube"
                  : "Cole a legenda/descrição do vídeo com os lugares mencionados"}
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESULT VIEW COMPONENT — Editorial Design
// ══════════════════════════════════════════════════════════════════════════════

function ResultView({
  result,
  onReset,
  onSave,
}: {
  result: ResultType;
  onReset: () => void;
  onSave: (item: SavedItem) => boolean;
}) {
  // Extrair place se for place_found (para useEffect incondicional)
  const placeFound = result.type === "place_found" ? result.place : null;

  // Guard: garantir que onSave seja chamado apenas UMA VEZ
  const savedOnceRef = useRef(false);

  // Salva no contexto quando place_found (hook incondicional)
  useEffect(() => {
    if (savedOnceRef.current) return;
    if (!placeFound) return;

    // Construir URL completa se for path relativo
    const heroUri = placeFound.hero_image_url
      ? placeFound.hero_image_url.startsWith("http")
        ? placeFound.hero_image_url
        : `${STORAGE_BASE}${placeFound.hero_image_url}`
      : null;

    const savedItem: SavedItem = {
      id: placeFound.id,
      titulo: placeFound.nome,
      categoria:
        placeFound.categoria === "restaurante" ? "restaurante"
        : placeFound.categoria === "hotel" ? "hotel"
        : placeFound.categoria === "lucky" ? "lucky"
        : "oQueFazer",
      localizacao: placeFound.bairro || "Rio de Janeiro",
      image: heroUri ? { uri: heroUri } : FALLBACK_IMAGE,
      source_table: "lugares",
    };
    savedOnceRef.current = true;
    onSave(savedItem);
  }, [placeFound?.id]);

  // ── place_found: tela editorial ──
  if (result.type === "place_found") {
    const { place } = result;

    return (
      <View style={styles.resultContainer}>
        <Feather name="check-circle" size={32} color={PETROLEO} style={{ marginBottom: 24 }} />

        <Text style={styles.resultTitle}>Encontrei o {place.nome}</Text>
        <Text style={styles.resultSubtitle}>
          Já adicionei à sua viagem.{"\n"}Quer um roteiro com ele?
        </Text>

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.push("/(tabs)/roteiro")}
        >
          <Text style={styles.primaryBtnText}>Montar roteiro com este lugar →</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.6 }]}
          onPress={onReset}
        >
          <Text style={styles.secondaryBtnText}>Adicionar outro vídeo →</Text>
        </Pressable>
      </View>
    );
  }

  // ── destination_recognized: editorial message ──
  if (result.type === "destination_recognized") {
    return (
      <View style={styles.resultContainer}>
        <Feather name="map-pin" size={32} color={PETROLEO} style={{ marginBottom: 24 }} />

        <Text style={styles.resultTitle}>{result.destination}</Text>
        <Text style={styles.resultSubtitle}>{result.message}</Text>

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.push("/(tabs)/roteiro")}
        >
          <Text style={styles.primaryBtnText}>Explorar {result.destination} →</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.6 }]}
          onPress={onReset}
        >
          <Text style={styles.secondaryBtnText}>Tentar outro vídeo →</Text>
        </Pressable>
      </View>
    );
  }

  // ── nothing_found ──
  return (
    <View style={styles.resultContainer}>
      <Feather name="search" size={32} color={PETROLEO} style={{ marginBottom: 24, opacity: 0.5 }} />

      <Text style={styles.resultTitle}>Não encontrei lugares</Text>
      <Text style={styles.resultSubtitle}>{result.message}</Text>

      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.7 }]}
        onPress={onReset}
      >
        <Text style={styles.primaryBtnText}>Tentar outro vídeo →</Text>
      </Pressable>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AREIA,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 18,
    color: PETROLEO,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: "rgba(27, 79, 114, 0.1)",
  },
  tabText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#999",
  },
  tabTextActive: {
    color: PETROLEO,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#333",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  inputMultiline: {
    minHeight: 140,
    textAlignVertical: "top",
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#E74C3C",
    marginBottom: 16,
    textAlign: "center",
  },
  submitBtn: {
    backgroundColor: PETROLEO,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#FFF",
  },
  helperText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    lineHeight: 18,
  },

  // Result styles — Editorial Design
  resultContainer: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 8,
  },
  resultTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 22,
    color: PETROLEO,
    marginBottom: 12,
    textAlign: "center",
    lineHeight: 30,
  },
  resultSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: PETROLEO,
    opacity: 0.6,
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 22,
  },
  // Option A: transparent bg, petroleo border
  primaryBtn: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: PETROLEO,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  primaryBtnText: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 15,
    color: PETROLEO,
  },
  secondaryBtn: {
    paddingVertical: 12,
  },
  secondaryBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: PETROLEO,
    textDecorationLine: "underline",
  },
});
