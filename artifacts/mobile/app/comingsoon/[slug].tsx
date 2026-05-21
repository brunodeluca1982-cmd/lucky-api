import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { RotatingBackground } from "@/components/RotatingBackground";

const CITY_LABELS: Record<string, { cidade: string; pais: string }> = {
  kyoto:     { cidade: "Kyoto",     pais: "Japão" },
  santorini: { cidade: "Santorini", pais: "Grécia" },
};

export default function ComingSoonScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();

  const label = CITY_LABELS[slug ?? ""] ?? {
    cidade: slug ?? "Destino",
    pais:   "Em Breve",
  };

  return (
    <View style={s.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <RotatingBackground />
        <LinearGradient
          colors={["rgba(0,0,0,0.70)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.82)"]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.85)" />
        </Pressable>
      </View>

      <View style={s.body}>
        <View style={s.badge}>
          <Text style={s.badgeText}>EM BREVE</Text>
        </View>

        <Text style={s.cidade}>{label.cidade}</Text>
        <Text style={s.pais}>{label.pais}</Text>

        <Text style={s.desc}>
          Estamos curadoria{"\n"}essa experiência com carinho.{"\n"}Fique de olho!
        </Text>

        <Pressable
          style={({ pressed }) => [s.btn, pressed && { opacity: 0.78 }]}
          onPress={() => router.back()}
        >
          <Text style={s.btnText}>Voltar ao início</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0D0803",
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    marginTop: -40,
  },
  badge: {
    backgroundColor: "rgba(27,79,114,0.14)",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.40)",
  },
  badgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "#1B4F72",
    letterSpacing: 2.5,
  },
  cidade: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 52,
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 60,
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.90)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
    marginBottom: 10,
  },
  pais: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 32,
  },
  desc: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 48,
  },
  btn: {
    backgroundColor: "rgba(27,79,114,0.16)",
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.45)",
    borderRadius: 28,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  btnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#1B4F72",
    letterSpacing: 0.5,
  },
});
