import React from "react";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { BookmarkButton } from "@/components/BookmarkButton";

const C = Colors.light;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_W = SCREEN_WIDTH * 0.52;

interface RestauranteCardProps {
  id?: string;
  nome: string;
  bairro: string;
  categoria: string;
  image: ImageSourcePropType | null;
  onPress?: () => void;
}

export function RestauranteCard({ id, nome, bairro, categoria, image, onPress }: RestauranteCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
      ]}
    >
      {image != null && (
        <Image source={image} style={styles.image} resizeMode="cover" />
      )}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.78)"]}
        style={styles.gradient}
        locations={[0.3, 1]}
      />
      <View style={styles.info}>
        <Text style={styles.categoria}>{categoria}</Text>
        <Text style={styles.nome} numberOfLines={2}>
          {nome}
        </Text>
        <Text style={styles.bairro}>{bairro}</Text>
      </View>
      {id && image != null && (
        <View style={styles.bookmark}>
          <BookmarkButton
            item={{ id, titulo: nome, localizacao: bairro, image, categoria: "restaurante" }}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_W * 1.3,
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
    height: "62%",
  },
  info: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    gap: 3,
  },
  categoria: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "rgba(255,255,255,0.72)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  nome: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 15,
    color: C.white,
    lineHeight: 20,
  },
  bairro: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.62)",
  },
  bookmark: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});
