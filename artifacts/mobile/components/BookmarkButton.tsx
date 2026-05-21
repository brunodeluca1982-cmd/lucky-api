import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useGuia } from "@/context/GuiaContext";
import type { SavedItem } from "@/context/GuiaContext";

interface BookmarkButtonProps {
  item: SavedItem;
}

export function BookmarkButton({ item }: BookmarkButtonProps) {
  const { isSaved, save, unsave } = useGuia();
  const saved = isSaved(item.id);

  return (
    <Pressable
      onPress={() => (saved ? unsave(item.id) : save(item))}
      style={[styles.btn, saved && styles.btnSaved]}
      hitSlop={10}
    >
      <Feather name="bookmark" size={14} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnSaved: {
    backgroundColor: "#C4704A",
  },
});
