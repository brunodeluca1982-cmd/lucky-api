import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { RotatingBackground } from "@/components/RotatingBackground";
import { useRioHeroMedia } from "@/hooks/useHeroMedia";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import Colors from "@/constants/colors";
import { getDeviceId } from "@/utils/deviceId";

const C    = Colors.light;
const GOLD = "#1B4F72";

const LOGO_MARK = require("@/assets/images/logo-symbol.png");

const LUCKY_BG_POOL = [
  require("@/assets/images/lapa.png"),
  require("@/assets/images/secret1.png"),
  require("@/assets/images/secret2.png"),
  require("@/assets/images/hotel2.png"),
  require("@/assets/images/rio-aerial-clean.png"),
];

const FREE_LIMIT         = 2;
const RESPONSES_USED_KEY = "@luckytrip/lucky_responses_v2";
const IS_PREMIUM_KEY     = "@luckytrip/lucky_premium_v2";

const SUGGESTED_PROMPTS = [
  "O que fazer hoje no Rio?",
  "Melhores restaurantes em Ipanema",
  "Onde ficar para gastronomia?",
  "Lugares bons para ir sozinha",
  "Ideias românticas no Rio",
  "O que fazer com amigos no fim de semana?",
];

interface Message {
  role:    "user" | "assistant";
  content: string;
}

// ── Lucky screen ───────────────────────────────────────────────────────────────

export default function LuckyScreen() {
  const insets    = useSafeAreaInsets();
  const topPad    = Platform.OS === "web" ? 67 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const rioHero   = useRioHeroMedia("image");

  const scrollRef = useRef<ScrollView>(null);

  const [messages,         setMessages]         = useState<Message[]>([]);
  const [responsesUsed,    setResponsesUsed]    = useState(0);
  const [isPremium,        setIsPremium]        = useState(false);
  const [loading,          setLoading]          = useState(false);
  const [inputText,        setInputText]        = useState("");
  const [deviceId,         setDeviceId]         = useState<string | null>(null);
  // showSecondHint: true after the 2nd free answer is delivered (editorial nudge, no button)
  const [showSecondHint,   setShowSecondHint]   = useState(false);

  const isAtLimit = !isPremium && responsesUsed >= FREE_LIMIT;

  // ── Init: load count from AsyncStorage + sync from Supabase lucky_usage ──
  useEffect(() => {
    (async () => {
      const [id, countStr, premiumStr] = await Promise.all([
        getDeviceId(),
        AsyncStorage.getItem(RESPONSES_USED_KEY),
        AsyncStorage.getItem(IS_PREMIUM_KEY),
      ]);
      setDeviceId(id);

      const localCount = countStr ? parseInt(countStr, 10) : 0;

      // Check premium from AsyncStorage cache first (fast path)
      if (premiumStr === "true") {
        setIsPremium(true);
        setResponsesUsed(localCount);
        return;
      }

      // Fetch premium status (from Supabase app_metadata) and usage count in parallel.
      // app_metadata is admin-only writeable — safe to trust for premium gating.
      const [premiumResult, usageResult] = await Promise.allSettled([
        supabase.auth.getUser(),
        supabase
          .from("lucky_usage")
          .select("question_count")
          .eq("device_id", id)
          .maybeSingle(),
      ]);

      // Premium check: read app_metadata set by the webhook handler
      if (premiumResult.status === "fulfilled") {
        const meta = premiumResult.value.data?.user?.app_metadata as Record<string, any> | undefined;
        const validPlan  = meta?.plan_type === "premium" || meta?.plan_type === "vip";
        const notExpired = meta?.access_until ? new Date(meta.access_until) > new Date() : false;
        if (validPlan && notExpired) {
          setIsPremium(true);
          await AsyncStorage.setItem(IS_PREMIUM_KEY, "true");
        }
      }

      // Usage count: use the higher of local (AsyncStorage) vs server (Supabase)
      // Server is authoritative — prevents gaming by clearing AsyncStorage
      let serverCount = 0;
      if (usageResult.status === "fulfilled" && usageResult.value.data) {
        serverCount = (usageResult.value.data as { question_count: number }).question_count ?? 0;
      }
      const authoritative = Math.max(localCount, serverCount);
      setResponsesUsed(authoritative);
      if (authoritative !== localCount) {
        await AsyncStorage.setItem(RESPONSES_USED_KEY, String(authoritative));
      }
    })();
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }, []);

  const sendQuery = useCallback(
    async (query: string) => {
      if (!query.trim() || loading || isAtLimit || !deviceId) return;

      Keyboard.dismiss();
      const userMsg: Message = { role: "user", content: query.trim() };
      const priorHistory     = messages.slice();

      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setLoading(true);
      scrollToBottom();

      try {
        // Call lucky-concierge with Supabase-grounded context
        // Use raw fetch so we control status code handling ourselves.
        // supabase.functions.invoke() throws on any non-2xx, hiding 402 limitReached.
        const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
        const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
        const rawRes = await fetch(`${supabaseUrl}/functions/v1/lucky-concierge`, {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${supabaseAnon}`,
            "apikey":        supabaseAnon,
          },
          body: JSON.stringify({
            query:       userMsg.content,
            history:     priorHistory.map((m) => ({ role: m.role, content: m.content })),
            deviceId,
            destination: "Rio de Janeiro",
          }),
        });

        const data = await rawRes.json().catch(() => ({}));
        console.log("[Lucky] status:", rawRes.status, "data keys:", Object.keys(data));

        // 402 = server-side limit reached (authoritative enforcement)
        if (rawRes.status === 402 || data?.limitReached) {
          console.log("[Lucky] GATE: limit reached");
          const newCount = Math.max(responsesUsed, data?.questionCount ?? FREE_LIMIT);
          setResponsesUsed(newCount);
          await AsyncStorage.setItem(RESPONSES_USED_KEY, String(newCount));
          setLoading(false);
          scrollToBottom();
          return;
        }

        if (!rawRes.ok || data?.error) {
          const errMsg = data?.error ?? `HTTP ${rawRes.status}`;
          console.error("[Lucky] server error:", errMsg);
          throw new Error(errMsg);
        }

        const reply = data?.reply ?? "Desculpe, não consegui processar sua pergunta.";
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

        // Sync count: use server's authoritative count
        const newCount = data?.questionCount ?? responsesUsed + 1;
        setResponsesUsed(newCount);
        await AsyncStorage.setItem(RESPONSES_USED_KEY, String(newCount));

        // Show subtle editorial hint after 2nd free answer (question 2 only, not blocked)
        if (!isPremium && newCount === FREE_LIMIT) {
          setShowSecondHint(true);
        }

        // Update premium status from server if changed
        if (data?.isPremium && !isPremium) {
          setIsPremium(true);
          await AsyncStorage.setItem(IS_PREMIUM_KEY, "true");
        }
      } catch (err) {
        const errMsg = (err as Error)?.message ?? "unknown";
        console.error("[Lucky] CATCH:", errMsg);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Hmm, algo deu errado. Tente novamente em instantes." },
        ]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    },
    [loading, isAtLimit, deviceId, messages, responsesUsed, isPremium, scrollToBottom],
  );

  const handleUpgrade = useCallback(() => {
    router.push("/subscription");
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <View style={styles.bg}>
      <RotatingBackground
        pool={rioHero && rioHero.length > 0
          ? rioHero.map((item) => ({ uri: item.public_url }))
          : LUCKY_BG_POOL}
        blurRadius={22}
      />
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={bottomPad + 60}
        >
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              { paddingTop: topPad + 8, paddingBottom: bottomPad + 120 },
            ]}
          >
            {/* ── Header ── */}
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <View>
                  <Text style={styles.eyebrow}>Concierge</Text>
                  <Text style={styles.title}>Lucky</Text>
                </View>
                <Image
                  source={LOGO_MARK}
                  style={styles.logoMark}
                  resizeMode="contain"
                />
              </View>
              {!hasMessages && (
                <Text style={styles.subtitle}>
                  Pergunte sobre o Rio, peça sugestões ou deixe{"\n"}me guiar a sua viagem.
                </Text>
              )}
              {/* No counter badge during free questions — premium moment is question 3 only */}
              {isPremium && (
                <View style={styles.premiumBadge}>
                  <Feather name="star" size={11} color={GOLD} />
                  <Text style={styles.premiumBadgeText}>Lucky Premium</Text>
                </View>
              )}
            </View>

            {/* ── Entry prompts ── */}
            {!hasMessages && (
              <View style={styles.promptsSection}>
                <Text style={styles.promptsLabel}>Sugestões</Text>
                <View style={styles.promptsGrid}>
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <Pressable
                      key={prompt}
                      style={({ pressed }) => [
                        styles.promptChip,
                        pressed && styles.promptChipPressed,
                      ]}
                      onPress={() => sendQuery(prompt)}
                    >
                      <Text style={styles.promptChipText}>{prompt}</Text>
                      <Feather name="arrow-right" size={12} color={GOLD} />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* ── Message thread ── */}
            {messages.map((msg, i) => (
              <View key={i} style={styles.messageBlock}>
                {msg.role === "user" ? (
                  <View style={styles.userBubbleRow}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userBubbleText}>{msg.content}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.luckyCard}>
                    <View style={styles.luckyCardHeader}>
                      <View style={styles.luckyAvatar}>
                        <Image source={LOGO_MARK} style={styles.luckyAvatarLogo} resizeMode="contain" />
                      </View>
                      <Text style={styles.luckyCardLabel}>Lucky</Text>
                    </View>
                    <Text style={styles.luckyCardText}>{msg.content}</Text>
                  </View>
                )}
              </View>
            ))}

            {/* ── Loading ── */}
            {loading && (
              <View style={styles.loadingCard}>
                <View style={styles.luckyCardHeader}>
                  <View style={styles.luckyAvatar}>
                    <Image source={LOGO_MARK} style={styles.luckyAvatarLogo} resizeMode="contain" />
                  </View>
                  <Text style={styles.luckyCardLabel}>Lucky</Text>
                </View>
                <View style={styles.loadingDots}>
                  <ActivityIndicator size="small" color={GOLD} />
                  <Text style={styles.loadingText}>Consultando a curadoria...</Text>
                </View>
              </View>
            )}

            {/* ── Subtle editorial nudge after 2nd answer (no button, no pressure) ── */}
            {showSecondHint && !isAtLimit && !loading && (
              <Text style={styles.secondHint}>
                Posso refinar isso ainda mais para você.
              </Text>
            )}

            {/* ── Paywall ── */}
            {isAtLimit && !loading && (
              <View style={styles.paywallCard}>
                <View style={styles.paywallTop}>
                  <Image
                    source={LOGO_MARK}
                    style={styles.paywallLogo}
                    resizeMode="contain"
                  />
                  <View style={styles.paywallBadge}>
                    <Feather name="lock" size={11} color={GOLD} />
                    <Text style={styles.paywallBadgeText}>Lucky Premium</Text>
                  </View>
                </View>
                <Text style={styles.paywallTitle}>Você chegou muito perto</Text>
                <Text style={styles.paywallBody}>
                  Continue com o Lucky para refinar sua viagem com inteligência e
                  acessar respostas ilimitadas.
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.paywallCTA,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={handleUpgrade}
                >
                  <Text style={styles.paywallCTAText}>Desbloquear agora</Text>
                </Pressable>
                <Text style={styles.paywallSub}>Cancele quando quiser · Sem taxas ocultas</Text>
                <Pressable
                  style={({ pressed }) => [styles.paywallSecondary, pressed && { opacity: 0.6 }]}
                  onPress={() => router.push("/subscription")}
                >
                  <Text style={styles.paywallSecondaryText}>Prefere ajuda humana?</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>

          {/* ── Input bar ── */}
          {!isAtLimit && (
            <View style={[styles.inputBar, { paddingBottom: bottomPad + 12 }]}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Pergunte sobre o Rio..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                onSubmitEditing={() => sendQuery(inputText)}
                returnKeyType="send"
                editable={!loading}
                multiline={false}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.sendBtn,
                  (!inputText.trim() || loading) && styles.sendBtnDisabled,
                  pressed && inputText.trim() && !loading && { opacity: 0.8 },
                ]}
                onPress={() => sendQuery(inputText)}
                disabled={!inputText.trim() || loading}
              >
                <Feather
                  name="send"
                  size={18}
                  color={!inputText.trim() || loading ? "rgba(255,255,255,0.30)" : "#FFFFFF"}
                />
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  content: {
    paddingHorizontal: 20,
  },

  // Header
  header: {
    marginBottom: 32,
    gap:          12,
  },
  headerTop: {
    flexDirection:  "row",
    alignItems:     "flex-start",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontFamily:    "Inter_500Medium",
    fontSize:      11,
    color:         GOLD,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom:  4,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize:   38,
    color:      "#FFFFFF",
    lineHeight: 44,
  },
  logoMark: {
    height:  28,
    width:   96,
    opacity: 0.70,
    marginTop: 10,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize:   15,
    color:      "rgba(255,255,255,0.60)",
    lineHeight: 23,
  },
  premiumBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    alignSelf:         "flex-start",
    backgroundColor:   "rgba(27,79,114,0.12)",
    borderRadius:      20,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       "rgba(27,79,114,0.22)",
  },
  premiumBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   12,
    color:      GOLD,
  },

  // Prompts
  promptsSection: {
    marginBottom: 10,
  },
  promptsLabel: {
    fontFamily:    "Inter_500Medium",
    fontSize:      11,
    color:         "rgba(255,255,255,0.40)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom:  12,
  },
  promptsGrid: {
    gap: 8,
  },
  promptChip: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    backgroundColor:   "rgba(255,255,255,0.07)",
    borderRadius:      16,
    paddingHorizontal: 16,
    paddingVertical:   13,
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.12)",
  } as never,
  promptChipPressed: {
    backgroundColor: "rgba(255,255,255,0.13)",
    borderColor:     "rgba(27,79,114,0.45)",
  },
  promptChipText: {
    fontFamily: "Inter_500Medium",
    fontSize:   14,
    color:      "rgba(255,255,255,0.88)",
    flex:       1,
  },

  // Messages
  messageBlock: {
    marginBottom: 14,
  },
  userBubbleRow: {
    flexDirection:  "row",
    justifyContent: "flex-end",
  },
  userBubble: {
    backgroundColor:         "rgba(255,255,255,0.14)",
    borderRadius:            16,
    borderBottomRightRadius: 4,
    paddingHorizontal:       14,
    paddingVertical:         10,
    maxWidth:                "80%",
    borderWidth:             1,
    borderColor:             "rgba(255,255,255,0.20)",
  },
  userBubbleText: {
    fontFamily: "Inter_400Regular",
    fontSize:   14,
    color:      "#FFFFFF",
    lineHeight: 20,
  },

  // Lucky response card
  luckyCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius:    18,
    padding:         18,
    gap:             12,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.14)",
  },
  luckyCardHeader: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  luckyAvatar: {
    width:           52,
    height:          26,
    borderRadius:    8,
    backgroundColor: `${GOLD}18`,
    borderWidth:     1,
    borderColor:     `${GOLD}38`,
    alignItems:      "center",
    justifyContent:  "center",
    paddingHorizontal: 4,
  },
  luckyAvatarLogo: {
    width:   44,
    height:  14,
    opacity: 0.85,
  },
  luckyCardLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   13,
    color:      "rgba(255,255,255,0.80)",
  },
  luckyCardText: {
    fontFamily: "Inter_400Regular",
    fontSize:   15,
    color:      "#FFFFFF",
    lineHeight: 23,
  },

  // Loading
  loadingCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius:    18,
    padding:         18,
    gap:             12,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.14)",
    marginBottom:    14,
  },
  loadingDots: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize:   14,
    color:      "rgba(255,255,255,0.55)",
  },

  // Subtle editorial hint after question 2
  secondHint: {
    fontFamily:    "Inter_400Regular",
    fontSize:      13,
    fontStyle:     "italic",
    color:         "rgba(255,255,255,0.42)",
    textAlign:     "center",
    marginTop:     4,
    marginBottom:  20,
    paddingHorizontal: 24,
  },

  // Paywall
  paywallCard: {
    backgroundColor: "rgba(0,0,0,0.46)",
    borderRadius:    20,
    padding:         24,
    gap:             14,
    marginTop:       8,
    borderWidth:     1,
    borderColor:     "rgba(27,79,114,0.30)",
  },
  paywallTop: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   2,
  },
  paywallLogo: {
    height:  22,
    width:   78,
    opacity: 0.85,
  },
  paywallBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    backgroundColor:   "rgba(27,79,114,0.16)",
    borderRadius:      20,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       "rgba(27,79,114,0.30)",
  },
  paywallBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   11,
    color:      GOLD,
  },
  paywallTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize:   22,
    color:      "#FFFFFF",
    lineHeight: 28,
  },
  paywallBody: {
    fontFamily: "Inter_400Regular",
    fontSize:   14,
    color:      "rgba(255,255,255,0.72)",
    lineHeight: 22,
  },
  paywallCTA: {
    backgroundColor: GOLD,
    borderRadius:    14,
    paddingVertical: 15,
    alignItems:      "center",
    marginTop:       4,
  },
  paywallCTAText: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   15,
    color:      "#000000",
  },
  paywallSub: {
    fontFamily:   "Inter_400Regular",
    fontSize:     12,
    color:        "rgba(255,255,255,0.45)",
    textAlign:    "center",
    marginBottom: 10,
  },
  paywallSecondary: {
    paddingVertical: 6,
    alignItems:      "center",
  },
  paywallSecondaryText: {
    fontFamily:         "Inter_400Regular",
    fontSize:           13,
    color:              "rgba(255,255,255,0.35)",
    textDecorationLine: "underline",
  },

  // Input bar
  inputBar: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: 16,
    paddingTop:        12,
    backgroundColor:   "rgba(0,0,0,0.44)",
    borderTopWidth:    1,
    borderTopColor:    "rgba(255,255,255,0.10)",
  },
  input: {
    flex:              1,
    backgroundColor:   "rgba(255,255,255,0.10)",
    borderRadius:      14,
    paddingHorizontal: 16,
    paddingVertical:   12,
    fontFamily:        "Inter_400Regular",
    fontSize:          15,
    color:             "#FFFFFF",
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.15)",
  },
  sendBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: GOLD,
    alignItems:      "center",
    justifyContent:  "center",
  },
  sendBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
});
