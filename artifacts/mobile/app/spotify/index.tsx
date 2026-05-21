// app/spotify/index.tsx — Conexão com Spotify
import React, { useRef, useEffect } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";

const { width: W, height: H } = Dimensions.get("window");
const PETROL = "#1B4F72";
const SPOTIFY_GREEN = "#1DB954";
const SUPABASE = "https://bkwlximkadmlnbgjcrdp.supabase.co";
const FALLBACK = `${SUPABASE}/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg`;

const FEATURES = [
  {
    icon: "headphones",
    title: "Playlists por destino",
    desc: "Trilhas sonoras curadas para cada cidade que você visita",
  },
  {
    icon: "heart",
    title: "Salvar músicas",
    desc: "Adicione músicas à sua biblioteca do Spotify direto do app",
  },
  {
    icon: "users",
    title: "Amigos que ouviram",
    desc: "Veja quais amigos do app ouviram a mesma música",
  },
  {
    icon: "zap",
    title: "Coincidências",
    desc: "Descubra conexões: Bruno e Di Ferrero ouviram Lulu Santos no mesmo lugar",
  },
];

function AnimatedWaveform() {
  const bars = useRef(Array.from({ length: 20 }, () => new Animated.Value(Math.random()))).current;

  useEffect(() => {
    bars.forEach((bar, i) => {
      const animate = () => {
        Animated.sequence([
          Animated.timing(bar, { toValue: Math.random(), duration: 300 + i * 20, useNativeDriver: false }),
          Animated.timing(bar, { toValue: Math.random() * 0.4 + 0.2, duration: 300 + i * 20, useNativeDriver: false }),
        ]).start(animate);
      };
      animate();
    });
  }, []);

  return (
    <View style={styles.waveformLarge}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBarLarge,
            { height: bar.interpolate({ inputRange: [0, 1], outputRange: [8, 50] }) },
          ]}
        />
      ))}
    </View>
  );
}

export default function SpotifyScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 0 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Background */}
      <Image source={{ uri: FALLBACK }} style={styles.bg} blurRadius={30} />
      <View style={styles.overlay} />
      <LinearGradient colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.95)"]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Waveform Animation */}
        <AnimatedWaveform />

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.kicker}>TRILHA DA VIAGEM</Text>
          <Text style={styles.title}>Conecte com Spotify</Text>
          <Text style={styles.subtitle}>
            Descubra a trilha sonora perfeita para cada destino e veja o que seus amigos estão ouvindo.
          </Text>
        </View>

        {/* Spotify Button */}
        <Pressable style={styles.spotifyBtn}>
          <Ionicons name="logo-spotify" size={24} color="#000" />
          <Text style={styles.spotifyBtnText}>Conectar com Spotify</Text>
        </Pressable>

        {/* Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>O que você vai poder fazer</Text>
          {FEATURES.map((feature, i) => (
            <View key={i} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Feather name={feature.icon as any} size={20} color={PETROL} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Current Playlist Preview */}
        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>Prévia: Rio de Janeiro</Text>
          <View style={styles.previewCard}>
            <Image source={{ uri: FALLBACK }} style={styles.previewImage} />
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.previewContent}>
              <Text style={styles.previewName}>Trilha Sonora do Rio</Text>
              <Text style={styles.previewInfo}>42 músicas • by The Lucky Trip</Text>
            </View>
            <View style={styles.previewPlay}>
              <Ionicons name="play" size={24} color="#FFF" />
            </View>
          </View>
        </View>

        {/* Skip for now */}
        <Pressable style={styles.skipBtn} onPress={() => router.back()}>
          <Text style={styles.skipText}>Agora não</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  bg: {
    position: "absolute",
    width: W,
    height: H,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 100,
  },

  // Waveform
  waveformLarge: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    height: 60,
    gap: 4,
    marginBottom: 32,
  },
  waveBarLarge: {
    width: 4,
    borderRadius: 2,
    backgroundColor: SPOTIFY_GREEN,
  },

  // Title
  titleSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  kicker: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 2,
    color: SPOTIFY_GREEN,
    marginBottom: 12,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: "#FFF",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 22,
  },

  // Spotify Button
  spotifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SPOTIFY_GREEN,
    borderRadius: 30,
    height: 56,
    gap: 12,
    marginBottom: 40,
  },
  spotifyBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#000",
  },

  // Features
  featuresSection: {
    marginBottom: 40,
  },
  featuresTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 20,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    gap: 16,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#FFF",
    marginBottom: 4,
  },
  featureDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 18,
  },

  // Preview
  previewSection: {
    marginBottom: 32,
  },
  previewTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  previewCard: {
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  previewName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: "#FFF",
    marginBottom: 4,
  },
  previewInfo: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  previewPlay: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SPOTIFY_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },

  // Skip
  skipBtn: {
    alignItems: "center",
    paddingVertical: 16,
  },
  skipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
});
