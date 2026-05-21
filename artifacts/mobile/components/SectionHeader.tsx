import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

const C = Colors.light;

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  uppercase?: boolean;
  dark?: boolean;
}

export function SectionHeader({
  title,
  subtitle,
  uppercase = false,
  dark = false,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.title,
          uppercase && styles.titleUppercase,
          dark && (uppercase ? styles.titleUppercaseDark : styles.titleDark),
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, dark && styles.subtitleDark]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 4,
  },

  // Light mode (default)
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: C.darkBrown,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  titleUppercase: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 2.0,
    textTransform: "uppercase",
    color: C.terracotta,
    lineHeight: undefined,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.warmGray,
    lineHeight: 20,
  },

  // Dark mode overrides
  titleDark: {
    color: C.white,
  },
  titleUppercaseDark: {
    color: C.terracotta,
  },
  subtitleDark: {
    color: "rgba(255,255,255,0.52)",
  },
});
