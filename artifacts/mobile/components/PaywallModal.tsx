/**
 * PaywallModal.tsx
 *
 * Reusable premium conversion modal — 3 types:
 *   "discovery" — Lucky List locked item tap
 *   "lucky"     — Lucky AI usage limit (3rd question)
 *   "depth"     — Save 2nd+ place / generate / edit itinerary
 *
 * All CTAs route to the Subscription screen.
 * The modal is globally driven from GuiaContext (paywallVisible/paywallType).
 */

import React from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useGuia, type PaywallType } from "@/context/GuiaContext";

const GOLD       = "#1B4F72";
const GOLD_ALPHA = "rgba(27,79,114,0.14)";
const GOLD_BDR   = "rgba(27,79,114,0.28)";
const LOGO_MARK  = require("@/assets/images/logo-symbol.png");

// ── Content per paywall type ───────────────────────────────────────────────────

interface PaywallContent {
  title:     string;
  body:      string;
  cta:       string;
  secondary?: string;
  tertiary?:  string;
}

const CONTENT: Record<PaywallType, PaywallContent> = {
  discovery: {
    title:    "Esse lugar não aparece no Google",
    body:     "Só quem conhece o Rio de verdade chega aqui. Este é um dos 127 endereços da Lucky List.",
    cta:      "Desbloquear agora",
    secondary: "Ver planos e benefícios",
    tertiary:  "Só quer testar? Acesso por 7 dias",
  },
  lucky: {
    title:    "Você chegou muito perto",
    body:     "Continue com o Lucky para refinar sua viagem com inteligência e acessar respostas ilimitadas.",
    cta:      "Desbloquear agora",
    secondary: "Prefere ajuda humana?",
  },
  depth: {
    title:    "Organize sua viagem completa",
    body:     "Desbloqueie o Lucky Premium para salvar, planejar e personalizar sua experiência.",
    cta:      "Desbloquear agora",
  },
};

// ── PaywallModal ──────────────────────────────────────────────────────────────

export default function PaywallModal() {
  const { paywallVisible, paywallType, hidePaywall } = useGuia();
  const content = CONTENT[paywallType];

  function goToSubscription(plan?: "weekly") {
    hidePaywall();
    router.push(plan === "weekly"
      ? { pathname: "/subscription", params: { plan: "weekly" } }
      : "/subscription",
    );
  }

  function goToConcierge() {
    hidePaywall();
    router.push("/lucky");
  }

  return (
    <Modal
      visible={paywallVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={hidePaywall}
    >
      <Pressable style={styles.backdrop} onPress={hidePaywall}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.logoWrap}>
              <Image source={LOGO_MARK} style={styles.logo} resizeMode="contain" />
            </View>
            <Pressable onPress={hidePaywall} hitSlop={12} style={styles.closeBtn}>
              <Feather name="x" size={18} color="rgba(255,255,255,0.45)" />
            </Pressable>
          </View>

          {/* Badge */}
          <View style={styles.badge}>
            <Feather name="lock" size={11} color={GOLD} />
            <Text style={styles.badgeText}>Lucky Premium</Text>
          </View>

          {/* Title + body */}
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.body}>{content.body}</Text>

          {/* Benefits (discovery only) */}
          {paywallType === "discovery" && (
            <View style={styles.benefitsList}>
              {[
                "127 segredos selecionados por quem vive o Rio",
                "Roteiros prontos ou criados para você com IA",
                "Salve, organize e acesse offline",
              ].map((b) => (
                <View key={b} style={styles.benefitRow}>
                  <Feather name="check" size={13} color={GOLD} />
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Primary CTA */}
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            onPress={() => goToSubscription()}
          >
            <Text style={styles.ctaText}>{content.cta}</Text>
          </Pressable>

          {/* Secondary CTA */}
          {content.secondary && (
            <Pressable
              style={({ pressed }) => [styles.secondaryCta, pressed && { opacity: 0.7 }]}
              onPress={paywallType === "lucky" ? goToConcierge : () => goToSubscription()}
            >
              <Text style={styles.secondaryCtaText}>{content.secondary}</Text>
            </Pressable>
          )}

          {/* Weekly small link (discovery only) */}
          {paywallType === "discovery" && (
            <Pressable
              style={({ pressed }) => [styles.weeklyLink, pressed && { opacity: 0.6 }]}
              onPress={() => goToSubscription("weekly")}
            >
              <Text style={styles.weeklyLinkText}>{content.tertiary}</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent:  "flex-end",
  },
  sheet: {
    backgroundColor: "#0F0A06",
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom:     40,
    paddingTop:        20,
    borderWidth:       1,
    borderColor:       GOLD_BDR,
    borderBottomWidth: 0,
  },
  sheetHeader: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   20,
  },
  logoWrap: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: GOLD_ALPHA,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     GOLD_BDR,
  },
  logo: {
    width:  22,
    height: 22,
  },
  closeBtn: {
    padding: 4,
  },
  badge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    alignSelf:         "flex-start",
    backgroundColor:   GOLD_ALPHA,
    borderRadius:      20,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       GOLD_BDR,
    marginBottom:      16,
  },
  badgeText: {
    fontFamily:    "Inter_500Medium",
    fontSize:      11,
    color:         GOLD,
    letterSpacing: 0.4,
  },
  title: {
    fontFamily:    "PlayfairDisplay_700Bold",
    fontSize:      22,
    color:         "#FFFFFF",
    lineHeight:    30,
    letterSpacing: -0.3,
    marginBottom:  12,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize:   15,
    color:      "rgba(255,255,255,0.65)",
    lineHeight: 24,
    marginBottom: 22,
  },
  benefitsList: {
    gap:          10,
    marginBottom: 24,
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
  cta: {
    backgroundColor: GOLD,
    borderRadius:    14,
    paddingVertical: 10,
    alignItems:      "center",
    marginBottom:    12,
  },
  ctaText: {
    fontFamily:    "Inter_600SemiBold",
    fontSize:      14,
    color:         "#000000",
    letterSpacing: 0.1,
  },
  secondaryCta: {
    paddingVertical: 10,
    alignItems:      "center",
  },
  secondaryCtaText: {
    fontFamily: "Inter_400Regular",
    fontSize:   14,
    color:      "rgba(255,255,255,0.45)",
    textDecorationLine: "underline",
  },
  weeklyLink: {
    paddingVertical: 6,
    alignItems:      "center",
    marginTop:       2,
  },
  weeklyLinkText: {
    fontFamily: "Inter_400Regular",
    fontSize:   12,
    color:      "rgba(255,255,255,0.30)",
  },
});
