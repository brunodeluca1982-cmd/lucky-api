import React from "react";
import {
  Dimensions,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_W = SCREEN_WIDTH - 24;
const CARD_H = 234;

interface FeaturedDestinationCardProps {
  cidade: string;
  pais: string;
  descricao: string;
  image: ImageSourcePropType;
  onPress: () => void;
}

export function FeaturedDestinationCard({
  cidade,
  pais,
  descricao,
  image,
  onPress,
}: FeaturedDestinationCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] },
      ]}
    >
      <Image source={image} style={styles.image} resizeMode="cover" />

      {/* Cinematic dual gradient — light top burn, deep bottom */}
      <LinearGradient
        colors={["rgba(20,10,4,0.28)", "transparent"]}
        locations={[0, 0.38]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["transparent", "rgba(20,10,4,0.55)", "rgba(20,10,4,0.94)"]}
        locations={[0.32, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Top-left editorial stamp */}
      <View style={styles.stamp}>
        <View style={styles.stampDot} />
        <Text style={styles.stampText}>Destino do momento</Text>
      </View>

      {/* Bottom editorial block */}
      <View style={styles.bottom}>
        <Text style={styles.pais}>{pais}</Text>
        <Text style={styles.cidade}>{cidade}</Text>
        <Text style={styles.descricao} numberOfLines={2}>{descricao}</Text>

        {/* CTA chip */}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Explorar</Text>
          <Feather name="arrow-right" size={12} color={C.white} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: C.darkBrown,
    alignSelf: "center",
    boxShadow: "0px 8px 28px rgba(44,24,16,0.32)",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  stamp: {
    position: "absolute",
    top: 16,
    left: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  stampDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.terracotta,
  },
  stampText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "rgba(255,255,255,0.82)",
    letterSpacing: 0.8,
  },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 4,
  },
  pais: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "rgba(255,255,255,0.60)",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  cidade: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 30,
    color: C.white,
    lineHeight: 36,
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  descricao: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.68)",
    lineHeight: 18,
    maxWidth: 260,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  ctaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: C.white,
    letterSpacing: 0.3,
  },
});
