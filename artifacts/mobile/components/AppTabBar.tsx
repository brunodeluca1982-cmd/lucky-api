/**
 * AppTabBar — reusable bottom navigation bar.
 *
 * Renders the app's 5 tabs so they remain accessible on stack screens
 * (like the place detail page) that live outside the (tabs) layout group.
 *
 * Pass `activeTab` to highlight the current section, or omit it for no active state.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View, Platform } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import Colors from "@/constants/colors";

const C = Colors.light;

type TabName = "index" | "destinos" | "viagem" | "lucky" | "perfil";

interface Props {
  activeTab?: TabName;
}

const TABS: {
  name: TabName;
  label: string;
  icon: (color: string) => React.ReactElement;
  route: string;
}[] = [
  {
    name: "index",
    label: "Home",
    icon: (color) => <Feather name="home" size={22} color={color} />,
    route: "/(tabs)/",
  },
  {
    name: "destinos",
    label: "Destinos",
    icon: (color) => <Feather name="map" size={22} color={color} />,
    route: "/(tabs)/destinos",
  },
  {
    name: "viagem",
    label: "Viagem",
    icon: (color) => <Ionicons name="airplane-outline" size={22} color={color} />,
    route: "/(tabs)/viagem",
  },
  {
    name: "lucky",
    label: "Lucky",
    icon: (color) => <Feather name="star" size={22} color={color} />,
    route: "/(tabs)/lucky",
  },
  {
    name: "perfil",
    label: "Perfil",
    icon: (color) => <Feather name="user" size={22} color={color} />,
    route: "/(tabs)/perfil",
  },
];

export function AppTabBar({ activeTab }: Props) {
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const bottomPad = isWeb ? 0 : insets.bottom;

  const barHeight = isWeb ? 84 : 60 + bottomPad;

  return (
    <View style={[s.container, { height: barHeight, paddingBottom: bottomPad }]}>
      {isIOS ? (
        <BlurView
          intensity={90}
          tint="dark"
          style={[StyleSheet.absoluteFill, s.blur]}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, s.solidBg]} />
      )}

      {TABS.map((tab) => {
        const isActive = tab.name === activeTab;
        const color = isActive ? C.tint : C.warmGray;
        return (
          <Pressable
            key={tab.name}
            style={({ pressed }) => [s.tab, pressed && { opacity: 0.70 }]}
            onPress={() => router.navigate(tab.route as any)}
            hitSlop={4}
          >
            {tab.icon(color)}
            <Text style={[s.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Height exported so screens can offset their scrollable content
export const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 80;

const s = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 50,
  },
  blur: {
    backgroundColor: "rgba(10,10,10,0.80)",
  },
  solidBg: {
    backgroundColor: "#0D0D0D",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingTop: 10,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.1,
  },
});
