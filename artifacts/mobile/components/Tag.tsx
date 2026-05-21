import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;

interface TagProps {
  label: string;
  type?: "location" | "category";
}

export function Tag({ label, type = "location" }: TagProps) {
  return (
    <View style={[styles.container, type === "category" && styles.categoryContainer]}>
      {type === "location" ? (
        <Feather name="map-pin" size={9} color={type === "location" ? C.white : C.terracotta} />
      ) : null}
      <Text style={[styles.text, type === "category" && styles.categoryText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  categoryContainer: {
    backgroundColor: C.terracotta,
  },
  text: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: C.white,
    letterSpacing: 0.3,
  },
  categoryText: {
    color: C.white,
  },
});
