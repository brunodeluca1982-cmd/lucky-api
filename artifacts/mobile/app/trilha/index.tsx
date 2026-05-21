// app/trilha/index.tsx — Tela Trilha da Viagem / Spotify
import React, { useRef, useEffect } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Linking,
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

// URL da playlist do Rio no Spotify
const SPOTIFY_PLAYLIST_RIO = "https://open.spotify.com/playlist/6eTA6gFftnmv7ElLoGPjkU";

// Destinos com playlists
const PLAYLISTS = [
  {
    id: "rio",
    nome: "Rio de Janeiro",
    subtitulo: "A trilha sonora perfeita para a cidade.",
    foto: `${SUPABASE}/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg`,
    spotifyUrl: SPOTIFY_PLAYLIST_RIO,
    disponivel: true,
  },
  {
    id: "miami",
    nome: "Miami",
    subtitulo: "Em breve",
    foto: `${SUPABASE}/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero02.jpg`,
    disponivel: false,
  },
  {
    id: "ibiza",
    nome: "Ibiza",
    subtitulo: "Em breve",
    foto: `${SUPABASE}/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero03.jpg`,
    disponivel: false,
  },
];

// Waveform animada
function AnimatedWaveform() {
  const bars = useRef(Array.from({ length: 24 }, () => new Animated.Value(Math.random()))).current;

  useEffect(() => {
    bars.forEach((bar, i) => {
      const animate = () => {
        Animated.sequence([
          Animated.timing(bar, { toValue: Math.random(), duration: 250 + i * 15, useNativeDriver: false }),
          Animated.timing(bar, { toValue: Math.random() * 0.4 + 0.2, duration: 250 + i * 15, useNativeDriver: false }),
        ]).start(animate);
      };
      animate();
    });
  }, []);

  return (
    <View style={styles.waveformContainer}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            { height: bar.interpolate({ inputRange: [0, 1], outputRange: [8, 40] }) },
          ]}
        />
      ))}
    </View>
  );
}

export default function TrilhaScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "web" ? 0 : insets.top;
  const bottom = Platform.OS === "web" ? 34 : insets.bottom;

  const openSpotify = async (url: string) => {
    try {
      // Tenta abrir no app do Spotify primeiro
      const spotifyAppUrl = url.replace("https://open.spotify.com/", "spotify://");
      const canOpen = await Linking.canOpenURL(spotifyAppUrl);

      if (canOpen) {
        await Linking.openURL(spotifyAppUrl);
      } else {
        // Fallback para navegador
        await Linking.openURL(url);
      }
    } catch (error) {
      // Fallback final
      await Linking.openURL(url);
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Background */}
      <Image source={{ uri: FALLBACK }} style={styles.bg} blurRadius={20} />
      <View style={styles.overlay} />
      <LinearGradient colors={["rgba(0,0,0,0.4)", "rgba(0,0,0,0.95)"]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Waveform */}
        <AnimatedWaveform />

        {/* Label */}
        <Text style={styles.kicker}>TRILHA DA VIAGEM</Text>

        {/* Título */}
        <Text style={styles.title}>Conecte com Spotify</Text>
        <Text style={styles.subtitle}>
          Descubra a trilha sonora perfeita para cada destino e veja o que seus amigos estão ouvindo.
        </Text>

        {/* Botão conectar Spotify */}
        <Pressable style={styles.spotifyBtn} onPress={() => openSpotify(SPOTIFY_PLAYLIST_RIO)}>
          <Ionicons name="logo-spotify" size={20} color="#000" />
          <Text style={styles.spotifyBtnText}>Conectar com Spotify</Text>
        </Pressable>

        {/* Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresLabel}>O QUE VOCÊ VAI PODER FAZER</Text>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Feather name="headphones" size={18} color={PETROL} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Playlists por destino</Text>
              <Text style={styles.featureDesc}>Trilhas sonoras curadas para cada cidade que você visita</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Feather name="heart" size={18} color={PETROL} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Salvar músicas</Text>
              <Text style={styles.featureDesc}>Adicione músicas à sua biblioteca do Spotify direto do app</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Feather name="users" size={18} color={PETROL} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Amigos que ouviram</Text>
              <Text style={styles.featureDesc}>Veja quais amigos do app ouviram a mesma música</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Feather name="zap" size={18} color={PETROL} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Coincidências</Text>
              <Text style={styles.featureDesc}>Descubra conexões: Bruno e Di Ferrero ouviram Lulu Santos no mesmo lugar</Text>
            </View>
          </View>
        </View>

        {/* Playlists */}
        <View style={styles.playlistsSection}>
          <Text style={styles.playlistsLabel}>PLAYLISTS DISPONÍVEIS</Text>

          {PLAYLISTS.map((playlist) => (
            <Pressable
              key={playlist.id}
              style={[styles.playlistCard, !playlist.disponivel && styles.playlistCardDisabled]}
              onPress={() => playlist.disponivel && playlist.spotifyUrl && openSpotify(playlist.spotifyUrl)}
              disabled={!playlist.disponivel}
            >
              <Image source={{ uri: playlist.foto }} style={styles.playlistThumb} />
              <View style={styles.playlistInfo}>
                <Text style={styles.playlistName}>{playlist.nome}</Text>
                <Text style={styles.playlistSub}>{playlist.subtitulo}</Text>
              </View>
              {playlist.disponivel ? (
                <View style={styles.playlistPlay}>
                  <Ionicons name="play" size={18} color="#FFF" />
                </View>
              ) : (
                <View style={styles.playlistBadge}>
                  <Text style={styles.playlistBadgeText}>EM BREVE</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
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
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeBtn: {
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
  waveformContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    height: 50,
    gap: 3,
    marginBottom: 24,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: SPOTIFY_GREEN,
  },

  // Title section
  kicker: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginBottom: 12,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: "#FFF",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },

  // Spotify button
  spotifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SPOTIFY_GREEN,
    borderRadius: 30,
    height: 52,
    gap: 10,
    marginBottom: 36,
  },
  spotifyBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#000",
  },

  // Features
  featuresSection: {
    marginBottom: 36,
  },
  featuresLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
    gap: 14,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFF",
    marginBottom: 4,
  },
  featureDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 18,
  },

  // Playlists
  playlistsSection: {
    marginBottom: 20,
  },
  playlistsLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 16,
  },
  playlistCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginBottom: 12,
  },
  playlistCardDisabled: {
    opacity: 0.5,
  },
  playlistThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#FFF",
    marginBottom: 2,
  },
  playlistSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  playlistPlay: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: SPOTIFY_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  playlistBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  playlistBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.5,
  },
});
