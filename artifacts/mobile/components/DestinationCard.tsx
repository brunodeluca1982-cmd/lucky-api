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
import Colors from "@/constants/colors";

const C = Colors.light;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const H_PAD = 12;
const GAP = 6;
const CARD_W = (SCREEN_WIDTH - H_PAD * 2 - GAP * 2) / 3;
const CARD_H = CARD_W * 1.35;

interface DestinationCardProps {
  cidade: string;
  pais: string;
  image: ImageSourcePropType;
  onPress: () => void;
  featured?: boolean;
}

export function DestinationCard({ cidade, pais, image, onPress, featured }: DestinationCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        featured && styles.cardFeatured,
        pressed && { opacity: 0.88, transform: [{ scale: 0.96 }] },
      ]}
    >
      <Image source={image} style={styles.image} resizeMode="cover" />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.75)"]}
        locations={[0.3, 0.6, 1]}
        style={styles.gradient}
      />
      {featured && (
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredCheck}>✓</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.cidade} numberOfLines={1}>{cidade}</Text>
        <Text style={styles.pais} numberOfLines={1}>{pais}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: C.sand,
    boxShadow: "0px 3px 12px rgba(0,0,0,0.22)",
  },
  cardFeatured: {
    borderWidth: 2.5,
    borderColor: C.white,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "70%",
  },
  featuredBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredCheck: {
    fontSize: 11,
    color: C.darkBrown,
    fontWeight: "700",
  },
  info: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 9,
    paddingBottom: 11,
    gap: 2,
  },
  cidade: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 13,
    color: C.white,
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  pais: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 13,
  },
});
