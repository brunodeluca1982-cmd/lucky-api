/**
 * diario.tsx — Diário de Viagem (placeholder)
 *
 * Entrada no Perfil > Diário de Viagem.
 * Módulo em desenvolvimento — estrutura visual já presente.
 */

import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";

const GOLD = "#1B4F72";

export default function DiarioScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top + 8;
  const botPad = Platform.OS === "web" ? 32 : insets.bottom + 24;

  return (
    <View style={[s.root, { paddingTop: topPad, paddingBottom: botPad }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle} suppressHighlighting>Diário de Viagem</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Conteúdo placeholder */}
      <View style={s.body}>
        <View style={s.iconWrap}>
          <Feather name="book-open" size={36} color={GOLD} />
        </View>
        <Text style={s.title} suppressHighlighting>Em breve</Text>
        <Text style={s.subtitle} suppressHighlighting>
          Registre memórias, fotos e anotações de cada viagem.{"\n"}
          Esse módulo estará disponível em breve.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: "#FFFFFF",
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(27,79,114,0.10)",
    borderWidth: 1,
    borderColor: "rgba(27,79,114,0.30)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.50)",
    textAlign: "center",
    lineHeight: 22,
  },
});
