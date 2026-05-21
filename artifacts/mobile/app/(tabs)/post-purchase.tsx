/**
 * post-purchase.tsx — Post-subscription success screen.
 *
 * Flow:
 *  1. Read ?session_id from URL params (set by Stripe success_url).
 *  2. Call GET /api/stripe/verify-session?session_id=... (with Bearer JWT).
 *     - This endpoint verifies payment with Stripe directly and provisions
 *       app_metadata in Supabase — no webhook dependency for the happy path.
 *  3. On success: refresh Supabase session so JWT carries updated app_metadata,
 *     then call markPremium() for local cache.
 *  4. On failure / timeout: show error with a "Contact support" link.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useGuia } from "@/context/GuiaContext";
import { supabase } from "@/lib/supabase";

const GOLD      = "#1B4F72";
const GOLD_DIM  = "rgba(27,79,114,0.14)";
const GOLD_BDR  = "rgba(27,79,114,0.30)";
const LOGO_MARK = require("@/assets/images/logo-symbol.png");

const UNLOCKS = [
  "127 endereços exclusivos desbloqueados",
  "Lucky AI sem limite de perguntas",
  "Roteiros personalizados disponíveis",
];

const POLL_INTERVAL_MS = 2_500;
const MAX_POLLS        = 14; // ~35 seconds

export default function PostPurchaseScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top + 24;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { session_id: sessionId } = useLocalSearchParams<{ session_id?: string }>();
  const { markPremium }           = useGuia();

  const [status,  setStatus]  = useState<"verifying" | "confirmed" | "error">("verifying");
  const [errMsg,  setErrMsg]  = useState<string | null>(null);
  const pollCount             = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      // If no session_id was provided (e.g. direct nav), skip verification
      if (!sessionId) {
        await markPremium();
        setStatus("confirmed");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setErrMsg("Sessão expirada. Faça login novamente.");
        setStatus("error");
        return;
      }

      const apiBase =
        process.env.EXPO_PUBLIC_API_ORIGIN ||
        process.env.EXPO_PUBLIC_APP_ORIGIN ||
        (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

      async function poll() {
        if (cancelled) return;
        if (pollCount.current >= MAX_POLLS) {
          setErrMsg(
            "A confirmação está demorando. Se o pagamento foi aprovado, " +
            "aguarde alguns minutos e reabra o app."
          );
          setStatus("error");
          return;
        }
        pollCount.current += 1;

        try {
          const res = await fetch(
            `${apiBase}/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`,
            {
              headers: { Authorization: `Bearer ${session.access_token}` },
            }
          );

          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error ?? `HTTP ${res.status}`);
          }

          const data = await res.json();

          if (data.confirmed) {
            if (cancelled) return;
            // Refresh session so JWT includes updated app_metadata
            await supabase.auth.refreshSession();
            await markPremium();
            setStatus("confirmed");
          } else {
            // Not confirmed yet — retry
            setTimeout(poll, POLL_INTERVAL_MS);
          }
        } catch (err: any) {
          if (cancelled) return;
          if (pollCount.current < MAX_POLLS) {
            setTimeout(poll, POLL_INTERVAL_MS);
          } else {
            setErrMsg(err?.message ?? "Erro ao verificar pagamento.");
            setStatus("error");
          }
        }
      }

      await poll();
    }

    verify();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (status === "verifying") {
    return (
      <View style={[s.root, { paddingTop: topPad, paddingBottom: botPad + 32 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.logoArea}>
          <View style={s.logoWrap}>
            <Image source={LOGO_MARK} style={s.logo} resizeMode="contain" />
          </View>
        </View>
        <ActivityIndicator size="large" color={GOLD} style={{ marginBottom: 20 }} />
        <Text style={s.verifyingText}>Confirmando seu pagamento…</Text>
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={[s.root, { paddingTop: topPad, paddingBottom: botPad + 32 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.logoArea}>
          <View style={s.logoWrap}>
            <Feather name="alert-circle" size={32} color={GOLD} />
          </View>
        </View>
        <Text style={[s.title, { fontSize: 22, marginBottom: 12 }]}>Verificando pagamento</Text>
        <Text style={[s.body, { marginBottom: 24 }]}>
          {errMsg ?? "Não foi possível confirmar o pagamento."}
        </Text>
        <Pressable
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
          onPress={() => router.replace("/(tabs)/")}
        >
          <Text style={s.ctaText}>Ir para o início</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.secondaryCta, pressed && { opacity: 0.7 }]}
          onPress={() => router.replace("/(tabs)/subscription")}
        >
          <Text style={s.secondaryCtaText}>Ver planos</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: topPad, paddingBottom: botPad + 32 }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.logoArea}>
        <View style={s.logoWrap}>
          <Image source={LOGO_MARK} style={s.logo} resizeMode="contain" />
        </View>
        <View style={s.starBadge}>
          <Feather name="star" size={12} color={GOLD} />
          <Text style={s.starText}>Lucky Premium</Text>
        </View>
      </View>

      <Text style={s.title}>Você agora é Lucky Premium</Text>
      <Text style={s.tagline}>Agora você vê o Rio como quem mora aqui.</Text>
      <Text style={s.body}>
        Os lugares que não aparecem no mapa comum agora estão abertos para você.
      </Text>

      <View style={s.unlockCard}>
        {UNLOCKS.map((u) => (
          <View key={u} style={s.unlockRow}>
            <Feather name="check-circle" size={15} color={GOLD} />
            <Text style={s.unlockText}>{u}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
        onPress={() =>
          router.push({ pathname: "/luckyList/[id]", params: { id: "rio" } })
        }
      >
        <Text style={s.ctaText}>Ver a Lucky List</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [s.secondaryCta, pressed && { opacity: 0.7 }]}
        onPress={() => router.replace("/(tabs)/")}
      >
        <Text style={s.secondaryCtaText}>Ir para o início</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex:              1,
    backgroundColor:   "#000000",
    paddingHorizontal: 28,
    alignItems:        "center",
    justifyContent:    "center",
  },
  logoArea: {
    alignItems:   "center",
    gap:          12,
    marginBottom: 32,
  },
  logoWrap: {
    width:           64,
    height:          64,
    borderRadius:    32,
    backgroundColor: GOLD_DIM,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     GOLD_BDR,
  },
  logo: {
    width:  38,
    height: 38,
  },
  starBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    backgroundColor:   GOLD_DIM,
    borderRadius:      20,
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       GOLD_BDR,
  },
  starText: {
    fontFamily:    "Inter_500Medium",
    fontSize:      12,
    color:         GOLD,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily:    "PlayfairDisplay_700Bold",
    fontSize:      26,
    color:         "#FFFFFF",
    textAlign:     "center",
    lineHeight:    36,
    letterSpacing: -0.3,
    marginBottom:  10,
  },
  tagline: {
    fontFamily:   "Inter_500Medium",
    fontSize:     16,
    color:        GOLD,
    textAlign:    "center",
    marginBottom: 12,
  },
  body: {
    fontFamily:   "Inter_400Regular",
    fontSize:     15,
    color:        "rgba(255,255,255,0.55)",
    textAlign:    "center",
    lineHeight:   24,
    marginBottom: 28,
  },
  unlockCard: {
    backgroundColor: "#0F0A06",
    borderRadius:    14,
    padding:         18,
    gap:             12,
    borderWidth:     1,
    borderColor:     "rgba(27,79,114,0.15)",
    marginBottom:    32,
    width:           "100%",
  },
  unlockRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  unlockText: {
    fontFamily: "Inter_400Regular",
    fontSize:   14,
    color:      "rgba(255,255,255,0.72)",
    flex:       1,
  },
  cta: {
    backgroundColor: GOLD,
    borderRadius:    14,
    paddingVertical: 17,
    alignItems:      "center",
    width:           "100%",
    marginBottom:    12,
  },
  ctaText: {
    fontFamily:    "Inter_600SemiBold",
    fontSize:      17,
    color:         "#000000",
    letterSpacing: 0.1,
  },
  secondaryCta: {
    paddingVertical: 10,
    alignItems:      "center",
  },
  secondaryCtaText: {
    fontFamily:         "Inter_400Regular",
    fontSize:           15,
    color:              "rgba(255,255,255,0.40)",
    textDecorationLine: "underline",
  },
  verifyingText: {
    fontFamily: "Inter_400Regular",
    fontSize:   16,
    color:      "rgba(255,255,255,0.55)",
    textAlign:  "center",
  },
});
