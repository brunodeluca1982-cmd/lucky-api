import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

interface HorizontalScrollProps {
  children: React.ReactNode;
  gap?: number;
  paddingHorizontal?: number;
}

export function HorizontalScroll({
  children,
  gap = 12,
  paddingHorizontal = 24,
}: HorizontalScrollProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.container,
        { paddingHorizontal, gap },
      ]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
  },
});
