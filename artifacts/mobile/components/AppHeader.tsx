import React from "react";
import { Image, Platform, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const C = Colors.light;

// Cursive L. brand mark — RGBA PNG with white strokes on transparent background.
// Pixels are white (255,255,255) with alpha derived from original logo darkness.
// No tintColor or CSS filter needed — the asset renders white natively everywhere.
const LOGO_MARK = require("../assets/images/logo-symbol.png");

interface AppHeaderProps {
  transparent?: boolean;
}

export function AppHeader({ transparent = false }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: topPad },
        transparent && styles.transparent,
      ]}
    >
      <View style={styles.inner}>
        {/*
          Cursive L. watermark — white brand mark at low opacity.
          Feels like a signature on the photographic surface, not a UI icon.
          No tintColor, no filter — asset is natively white, just reduced opacity.
        */}
        <Image
          source={LOGO_MARK}
          style={styles.logoMark}
          resizeMode="contain"
        />
        <Pressable
          style={styles.avatarBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(tabs)/perfil");
          }}
          hitSlop={8}
        >
          <Feather name="music" size={16} color={C.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  transparent: {
    backgroundColor: "transparent",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  logoMark: {
    // RGBA asset: 2622×748 (ratio ~3.5:1) — L. mark only, no tagline text.
    // White strokes on transparent bg — renders correctly on any background.
    // opacity: 0.65 → legible signature feel, premium without dominating.
    height: 28,
    width: 96,
    opacity: 0.65,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
});
