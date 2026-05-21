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
import { BookmarkButton } from "@/components/BookmarkButton";

const C = Colors.light;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_W = SCREEN_WIDTH * 0.58;

interface HotelCardProps {
  id?: string;
  nome: string;
  localizacao: string;
  tipo: string;
  image: ImageSourcePropType | null;
  onPress?: () => void;
}

const TIPO_COLORS: Record<string, string> = {
  Luxo: "#1B4F72",
  Boutique: "#2D5A3D",
  Conforto: "#C4704A",
};

export function HotelCard({
  id,
  nome,
  localizacao,
  tipo,
  image,
  onPress,
}: HotelCardProps) {
  const tipoColor = TIPO_COLORS[tipo] ?? C.terracotta;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
      ]}
    >
      {image ? (
        <Image source={image} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, { backgroundColor: "#000" }]} />
      )}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.78)"]}
        style={styles.gradient}
        locations={[0.25, 1]}
      />
      <View style={styles.tipoContainer}>
        <View style={[styles.tipoBadge, { backgroundColor: tipoColor }]}>
          <Text style={styles.tipoText}>{tipo}</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.nome} numberOfLines={2}>
          {nome}
        </Text>
        <Text style={styles.localizacao}>{localizacao}</Text>
      </View>
      {id && (
        <View style={styles.bookmark}>
          <BookmarkButton
            item={{ id, titulo: nome, localizacao, image, categoria: "hotel" }}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_W * 1.22,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: C.sand,
    boxShadow: "0px 4px 18px rgba(0,0,0,0.28)",
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
    height: "60%",
  },
  tipoContainer: {
    position: "absolute",
    top: 12,
    left: 12,
  },
  tipoBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tipoText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: C.white,
    letterSpacing: 0.5,
  },
  info: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    gap: 3,
  },
  nome: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 15,
    color: C.white,
    lineHeight: 20,
  },
  localizacao: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
  },
  bookmark: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});
