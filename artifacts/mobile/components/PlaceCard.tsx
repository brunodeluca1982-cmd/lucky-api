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
import { Tag } from "./Tag";
import Colors from "@/constants/colors";
import { BookmarkButton } from "@/components/BookmarkButton";
import type { SavedCategory } from "@/context/GuiaContext";

const C = Colors.light;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PlaceCardProps {
  id?: string;
  saveCategoria?: SavedCategory;
  titulo: string;
  localizacao?: string;
  categoria?: string;
  descricao?: string;
  image: ImageSourcePropType | null;
  size?: "small" | "medium" | "large";
  variant?: "default" | "horizontal" | "secret";
  onPress?: () => void;
}

export function PlaceCard({
  id,
  saveCategoria,
  titulo,
  localizacao,
  categoria,
  descricao,
  image,
  size = "medium",
  variant = "default",
  onPress,
}: PlaceCardProps) {
  const cardWidth =
    size === "small"
      ? SCREEN_WIDTH * 0.44
      : size === "large"
      ? SCREEN_WIDTH - 48
      : SCREEN_WIDTH * 0.56;

  const cardHeight =
    size === "small"
      ? cardWidth * 1.25
      : size === "large"
      ? cardWidth * 0.72
      : cardWidth * 1.18;

  const showBookmark = !!id && !!saveCategoria && !!localizacao;

  if (variant === "secret") {
    return (
      <Pressable onPress={onPress} style={[styles.secretCard, { width: SCREEN_WIDTH - 48 }]}>
        {image != null && <Image source={image} style={styles.secretImage} resizeMode="cover" />}
        <View style={styles.secretContent}>
          {localizacao ? (
            <View style={styles.tagRow}>
              <Tag label={localizacao} type="location" />
            </View>
          ) : null}
          <Text style={styles.secretTitle}>{titulo}</Text>
          {descricao ? <Text style={styles.secretDesc}>{descricao}</Text> : null}
        </View>
        {showBookmark && (
          <View style={styles.secretBookmark}>
            <BookmarkButton
              item={{
                id: id!,
                titulo,
                localizacao: localizacao!,
                image,
                categoria: saveCategoria!,
              }}
            />
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width: cardWidth, height: cardHeight },
        pressed && { opacity: 0.93, transform: [{ scale: 0.98 }] },
      ]}
    >
      {image != null && <Image source={image} style={styles.image} resizeMode="cover" />}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.72)"]}
        style={styles.gradient}
        locations={[0.35, 1]}
      />
      <View style={styles.overlay}>
        <View style={styles.tagRow}>
          {localizacao ? <Tag label={localizacao} type="location" /> : null}
          {categoria ? <Tag label={categoria} type="category" /> : null}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {titulo}
        </Text>
      </View>
      {showBookmark && (
        <View style={styles.bookmark}>
          <BookmarkButton
            item={{
              id: id!,
              titulo,
              localizacao: localizacao!,
              image,
              categoria: saveCategoria!,
            }}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: C.sand,
    boxShadow: "0px 4px 18px rgba(0,0,0,0.30)",
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
    height: "68%",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    gap: 5,
  },
  tagRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 15,
    color: C.white,
    lineHeight: 20,
  },
  bookmark: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  secretCard: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(12,10,8,0.92)",
    flexDirection: "row",
    boxShadow: "0px 3px 14px rgba(0,0,0,0.22)",
    marginHorizontal: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  secretImage: {
    width: 100,
    height: 112,
  },
  secretContent: {
    flex: 1,
    padding: 14,
    justifyContent: "flex-start",
    gap: 6,
  },
  secretTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 15,
    color: C.white,
    lineHeight: 20,
  },
  secretDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 18,
  },
  secretBookmark: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});
