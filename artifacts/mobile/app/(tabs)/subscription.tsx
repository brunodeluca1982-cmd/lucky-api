/**
 * subscription.tsx — Lucky Premium subscription screen.
 *
 * Shows annual (highlighted), monthly, and weekly (small link) plans.
 * CTA → create-checkout → post-purchase.
 *
 * Navigated to from paywalls and any premium CTA in the app.
 * Accepts optional ?plan=weekly to pre-select the weekly plan.
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import { useGuia } from "@/context/GuiaContext";
import { supabase } from "@/lib/supabase";

const GOLD      = "#1B4F72";
const GOLD_DIM  = "rgba(27,79,114,0.14)";
const GOLD_BDR  = "rgba(27,79,114,0.30)";
const LOGO_MARK = require("@/assets/images/logo-symbol.png");

type Plan = "annual" | "monthly" | "weekly" | "one_time";

const PLANS = {
  annual: {
    label:      "Anual",
    price:      "R$19,90/mês",
    subPrice:   "R$97 cobrados por ano",
    highlights: ["Mais escolhido", "Economize 40%"],
    plan_id:    "annual",
  },
  monthly: {
    label:    "Mensal",
    price:    "R$29,90/mês",
    subPrice: "Cancele quando quiser",
    plan_id:  "monthly",
  },
} as const;

const BENEFITS = [
  "127 endereços da Lucky List desbloqueados",
  "Lucky AI ilimitado — perguntas sem limite",
  "Roteiros personalizados com IA",
  "Salve e organize quantos lugares quiser",
  "Acesso offline",
];

export default function SubscriptionScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 67 : insets.top + 12;
  const botPad  = Platform.OS === "web" ? 34 : insets.bottom;
  const params  = useLocalSearchParams<{ plan?: string }>();
  const { user } = useAuth();
  const { markPremium } = useGuia();

  const defaultPlan: Plan = params.plan === "weekly" ? "weekly" : "annual";
  const [selected,   setSelected]   = useState<Plan>(defaultPlan);
  const [loading,    setLoading]    = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [restoring,  setRestoring]  = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  async function handleStart() {
    if (loading) return;

    if (!user) {
      Alert.alert("Login necessário", "Faça login para continuar");
      return;
    }

    setErrorMsg(null);
    setLoading(true);
    try {
      // Get JWT to authenticate with the API server
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        setErrorMsg("Sessão expirada. Faça login novamente.");
        setLoading(false);
        return;
      }

      // Base URL for the API server.
      // EXPO_PUBLIC_API_ORIGIN targets the Replit API server when the frontend
      // is hosted elsewhere (e.g. Netlify). Falls back to APP_ORIGIN for Replit dev.
      const apiBase =
        process.env.EXPO_PUBLIC_API_ORIGIN ||
        process.env.EXPO_PUBLIC_APP_ORIGIN ||
        (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

      const appOrigin = process.env.EXPO_PUBLIC_APP_ORIGIN
        || (process.env.EXPO_PUBLIC_EXPO_DOMAIN ? `https://${process.env.EXPO_PUBLIC_EXPO_DOMAIN}` : "");

      const res = await fetch(`${apiBase}/api/stripe/checkout`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          plan:        selected,
          success_url: `${appOrigin}/post-purchase?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url:  `${appOrigin}/subscription`,
        }),
      });

      const data = await res.json();

      if (data.url) {
        // On native, typeof window is "object" (RN has a window global) but
        // window.location is undefined — always use Linking.openURL on native.
        if (Platform.OS === "web") {
          window.location.href = data.url;
        } else {
          await Linking.openURL(data.url);
        }
      } else {
        console.error("Checkout error response:", data);
        setErrorMsg("Erro ao iniciar pagamento. Tente novamente.");
      }
    } catch (err: any) {
      console.error("Checkout fetch error:", err);
      setErrorMsg(err?.message ?? "Erro de conexão. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    if (restoring || !user) return;
    setRestoreMsg(null);
    setRestoring(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        setRestoreMsg("Sessão expirada. Faça login novamente.");
        return;
      }
      const apiBase =
        process.env.EXPO_PUBLIC_API_ORIGIN ||
        process.env.EXPO_PUBLIC_APP_ORIGIN ||
        (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");
      const res = await fetch(`${apiBase}/api/stripe/sync-subscription`, {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      const data = await res.json();
      if (data.synced) {
        await supabase.auth.refreshSession();
        await markPremium();
        setRestoreMsg("Acesso restaurado! Você já é Lucky Premium.");
        setTimeout(() => router.replace("/(tabs)/"), 1800);
      } else if (data.reason === "no_customer") {
        setRestoreMsg("Nenhuma compra encontrada nesta conta.");
      } else {
        setRestoreMsg("Nenhuma assinatura ativa encontrada.");
      }
    } catch {
      setRestoreMsg("Erro de conexão. Tente novamente.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: botPad + 32 }]}
      >
        {/* Back */}
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={18} color="rgba(255,255,255,0.55)" />
          <Text style={s.backText}>Voltar</Text>
        </Pressable>

        {/* Logo + heading */}
        <View style={s.header}>
          <View style={s.logoWrap}>
            <Image source={LOGO_MARK} style={s.logo} resizeMode="contain" />
          </View>
          <Text style={s.eyebrow}>LUCKY PREMIUM</Text>
          <Text style={s.title}>Veja o Rio como{"\n"}quem mora aqui</Text>
          <Text style={s.subtitle}>
            Uma curadoria editorial feita à mão — agora com IA, roteiros e acesso total.
          </Text>
        </View>

        {/* Benefits */}
        <View style={s.benefitsCard}>
          {BENEFITS.map((b) => (
            <View key={b} style={s.benefitRow}>
              <Feather name="check" size={14} color={GOLD} />
              <Text style={s.benefitText}>{b}</Text>
            </View>
          ))}
        </View>

        {/* Plan selection */}
        <Text style={s.plansLabel}>Escolha seu plano</Text>

        {/* Annual plan (highlighted) */}
        <Pressable
          style={[s.planCard, selected === "annual" && s.planCardSelected]}
          onPress={() => setSelected("annual")}
        >
          <View style={s.planCardInner}>
            <View style={s.planLeft}>
              <View style={[s.radio, selected === "annual" && s.radioSelected]}>
                {selected === "annual" && <View style={s.radioDot} />}
              </View>
              <View>
                <Text style={s.planLabel}>{PLANS.annual.label}</Text>
                <Text style={s.planSub}>{PLANS.annual.subPrice}</Text>
              </View>
            </View>
            <Text style={s.planPrice}>{PLANS.annual.price}</Text>
          </View>
          {/* Highlight badges */}
          <View style={s.planBadges}>
            {PLANS.annual.highlights.map((h) => (
              <View key={h} style={s.planBadge}>
                <Text style={s.planBadgeText}>{h}</Text>
              </View>
            ))}
          </View>
        </Pressable>

        {/* Monthly plan */}
        <Pressable
          style={[s.planCard, s.planCardMonthly, selected === "monthly" && s.planCardSelected]}
          onPress={() => setSelected("monthly")}
        >
          <View style={s.planCardInner}>
            <View style={s.planLeft}>
              <View style={[s.radio, selected === "monthly" && s.radioSelected]}>
                {selected === "monthly" && <View style={s.radioDot} />}
              </View>
              <View>
                <Text style={s.planLabel}>{PLANS.monthly.label}</Text>
                <Text style={s.planSub}>{PLANS.monthly.subPrice}</Text>
              </View>
            </View>
            <Text style={s.planPrice}>{PLANS.monthly.price}</Text>
          </View>
        </Pressable>

        {/* Main CTA */}
        <Pressable
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }, loading && s.ctaLoading]}
          onPress={handleStart}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color="#000" />
            : <Text style={s.ctaText}>Começar agora</Text>
          }
        </Pressable>

        {errorMsg && (
          <Text style={s.errorText}>{errorMsg}</Text>
        )}

        <Text style={s.micro}>7 dias grátis · Cancele quando quiser</Text>

        {/* Weekly small link */}
        <Pressable
          style={({ pressed }) => [s.weeklyLink, pressed && { opacity: 0.6 }]}
          onPress={() => {
            setSelected("weekly");
            setTimeout(handleStart, 100);
          }}
        >
          <Text style={s.weeklyLinkText}>Acesso por 7 dias — R$9,90</Text>
        </Pressable>

        {/* Restore purchase */}
        {user && (
          <Pressable
            style={({ pressed }) => [s.restoreLink, pressed && { opacity: 0.6 }]}
            onPress={handleRestore}
            disabled={restoring}
          >
            {restoring
              ? <ActivityIndicator size="small" color="rgba(255,255,255,0.28)" />
              : <Text style={s.restoreLinkText}>Já sou assinante — Restaurar acesso</Text>
            }
          </Pressable>
        )}
        {restoreMsg && (
          <Text style={[
            s.errorText,
            restoreMsg.startsWith("Acesso") && { color: "#4CAF50" },
          ]}>
            {restoreMsg}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: "#000000",
  },
  scroll: {
    paddingHorizontal: 24,
  },
  backBtn: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            6,
    marginBottom:   24,
    alignSelf:      "flex-start",
  },
  backText: {
    fontFamily: "Inter_400Regular",
    fontSize:   14,
    color:      "rgba(255,255,255,0.55)",
  },
  header: {
    alignItems:   "center",
    marginBottom: 28,
    gap:          10,
  },
  logoWrap: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: GOLD_DIM,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     GOLD_BDR,
    marginBottom:    6,
  },
  logo: {
    width:  32,
    height: 32,
  },
  eyebrow: {
    fontFamily:    "Inter_500Medium",
    fontSize:      10,
    color:         GOLD,
    letterSpacing: 3,
  },
  title: {
    fontFamily:    "PlayfairDisplay_700Bold",
    fontSize:      28,
    color:         "#FFFFFF",
    textAlign:     "center",
    lineHeight:    38,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize:   15,
    color:      "rgba(255,255,255,0.55)",
    textAlign:  "center",
    lineHeight: 24,
    maxWidth:   280,
  },
  benefitsCard: {
    backgroundColor: "#0F0A06",
    borderRadius:    16,
    padding:         20,
    gap:             12,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.08)",
    marginBottom:    28,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems:    "flex-start",
    gap:           10,
  },
  benefitText: {
    fontFamily: "Inter_400Regular",
    fontSize:   14,
    color:      "rgba(255,255,255,0.72)",
    lineHeight: 22,
    flex:       1,
  },
  plansLabel: {
    fontFamily:    "Inter_500Medium",
    fontSize:      12,
    color:         "rgba(255,255,255,0.40)",
    letterSpacing: 1.2,
    marginBottom:  12,
  },
  planCard: {
    backgroundColor: "#0F0A06",
    borderRadius:    14,
    padding:         16,
    borderWidth:     2,
    borderColor:     "rgba(255,255,255,0.08)",
    marginBottom:    10,
  },
  planCardMonthly: {
    marginBottom: 24,
  },
  planCardSelected: {
    borderColor:     GOLD,
    backgroundColor: "rgba(27,79,114,0.06)",
  },
  planCardInner: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
  },
  planLeft: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           12,
  },
  radio: {
    width:           20,
    height:          20,
    borderRadius:    10,
    borderWidth:     2,
    borderColor:     "rgba(255,255,255,0.25)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  radioSelected: {
    borderColor: GOLD,
  },
  radioDot: {
    width:           9,
    height:          9,
    borderRadius:    4.5,
    backgroundColor: GOLD,
  },
  planLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   15,
    color:      "#FFFFFF",
  },
  planSub: {
    fontFamily: "Inter_400Regular",
    fontSize:   12,
    color:      "rgba(255,255,255,0.40)",
    marginTop:  2,
  },
  planPrice: {
    fontFamily: "Inter_600SemiBold",
    fontSize:   15,
    color:      GOLD,
  },
  planBadges: {
    flexDirection: "row",
    gap:           8,
    marginTop:     10,
  },
  planBadge: {
    backgroundColor:   GOLD_DIM,
    borderRadius:      20,
    paddingHorizontal: 10,
    paddingVertical:   3,
    borderWidth:       1,
    borderColor:       GOLD_BDR,
  },
  planBadgeText: {
    fontFamily:    "Inter_500Medium",
    fontSize:      11,
    color:         GOLD,
    letterSpacing: 0.3,
  },
  cta: {
    backgroundColor: GOLD,
    borderRadius:    14,
    paddingVertical: 17,
    alignItems:      "center",
    marginBottom:    10,
  },
  ctaLoading: {
    opacity: 0.7,
  },
  ctaText: {
    fontFamily:    "Inter_600SemiBold",
    fontSize:      17,
    color:         "#000000",
    letterSpacing: 0.1,
  },
  errorText: {
    fontFamily:   "Inter_400Regular",
    fontSize:     13,
    color:        "#FF6B6B",
    textAlign:    "center",
    marginBottom: 10,
  },
  micro: {
    fontFamily: "Inter_400Regular",
    fontSize:   13,
    color:      "rgba(255,255,255,0.35)",
    textAlign:  "center",
    marginBottom: 20,
  },
  weeklyLink: {
    alignItems:    "center",
    paddingBottom: 8,
  },
  weeklyLinkText: {
    fontFamily:         "Inter_400Regular",
    fontSize:           13,
    color:              "rgba(255,255,255,0.28)",
    textDecorationLine: "underline",
  },
  restoreLink: {
    alignItems:   "center",
    paddingTop:   16,
    paddingBottom: 4,
    minHeight:    32,
  },
  restoreLinkText: {
    fontFamily:         "Inter_400Regular",
    fontSize:           12,
    color:              "rgba(255,255,255,0.22)",
    textDecorationLine: "underline",
  },
});
