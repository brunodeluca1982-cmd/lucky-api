/**
 * SplashOverlay.tsx — Branded session splash screen.
 *
 * Logic:
 *   - _sessionShown is a plain module-level boolean.
 *     It is initialised to `false` each time the JS process starts (app launch).
 *     It is never written to disk, so it resets on every cold start.
 *
 *   - First mount  → show splash, wait 1.5 s, fade out 400 ms, unmount.
 *   - Every subsequent mount in the same session → renders nothing immediately.
 *   - Tab / screen navigation never re-mounts this component (it lives in the
 *     root layout), so the flag is only relevant for true process restarts.
 */

import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";

const LOGO_ASSET = require("../assets/images/logo_symbol_white.png");
const HOLD_MS    = 1500;   // how long the splash stays at full opacity
const FADE_MS    = 400;    // fade-out duration

// Azul Petróleo (Petroleum Blue)
const AZUL_PETROLEO = "#1B6B6B";

// Module-level flag — lives in the JS process lifetime only.
// Automatically false on every fresh app launch; never touches AsyncStorage.
let _sessionShown = false;

export function SplashOverlay() {
  // If already shown this session skip immediately — no state change needed.
  const [visible, setVisible] = useState(!_sessionShown);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (_sessionShown) return;    // second mount guard (shouldn't happen but safe)
    _sessionShown = true;         // mark now so any StrictMode double-invoke is ignored

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }, HOLD_MS);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
      <View style={styles.bg}>
        <Image
          source={LOGO_ASSET}
          style={styles.logo}
          resizeMode="contain"
          tintColor={AZUL_PETROLEO}
        />
        <Text style={styles.title}>THE LUCKY TRIP</Text>
        <Text style={styles.tagline}>INTELIGÊNCIA HUMANA EM VIAGENS</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  bg: {
    flex: 1,
    backgroundColor: "#F5F0E8",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 24,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    letterSpacing: 6,
    color: "#2C2C2C",
    marginBottom: 8,
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    letterSpacing: 3,
    color: "#8A8A8A",
  },
});
