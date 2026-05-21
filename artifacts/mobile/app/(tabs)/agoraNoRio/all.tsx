// app/(tabs)/agoraNoRio/all.tsx — Lista de todos os eventos/atividades
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

export default function AgoraNoRioAllScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 0 : insets.top;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Agora no Rio</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Placeholder */}
      <View style={styles.placeholder}>
        <Feather name="calendar" size={48} color="rgba(255,255,255,0.3)" />
        <Text style={styles.placeholderText}>Em breve</Text>
        <Text style={styles.placeholderSub}>Lista completa de eventos e atividades</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#FFF",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  placeholderText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    color: "#FFF",
  },
  placeholderSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
});
