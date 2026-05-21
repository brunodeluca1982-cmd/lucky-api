import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { periodoMeta, type Periodo } from "@/data/mockData";

const C = Colors.light;
const PERIODS: Periodo[] = ["manha", "tarde", "noite"];

interface Props {
  active: Periodo;
  onChange: (p: Periodo) => void;
  dark?: boolean;
}

export function PeriodoSwitcher({ active, onChange, dark = false }: Props) {
  return (
    <View style={styles.row}>
      {PERIODS.map((p, i) => {
        const meta = periodoMeta[p];
        const isActive = p === active;
        return (
          <React.Fragment key={p}>
            <Pressable
              onPress={() => onChange(p)}
              style={({ pressed }) => [
                styles.pill,
                dark ? styles.pillDark : styles.pillLight,
                isActive && (dark ? styles.pillActiveDark : styles.pillActiveLight),
                pressed && { opacity: 0.72 },
              ]}
            >
              <Feather
                name={meta.icon as any}
                size={11}
                color={
                  isActive
                    ? C.white
                    : dark
                    ? "rgba(255,255,255,0.48)"
                    : C.warmGray
                }
              />
              <Text
                style={[
                  styles.pillLabel,
                  isActive
                    ? styles.pillLabelActive
                    : dark
                    ? styles.pillLabelInactiveDark
                    : styles.pillLabelInactiveLight,
                ]}
              >
                {meta.label}
              </Text>
            </Pressable>
            {i < PERIODS.length - 1 && (
              <View
                style={[
                  styles.sep,
                  dark ? styles.sepDark : styles.sepLight,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 24,
    marginTop: 10,
    marginBottom: 2,
    gap: 0,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },

  pillLight: {
    borderColor: C.border,
    backgroundColor: "transparent",
  },
  pillDark: {
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  pillActiveLight: {
    backgroundColor: C.darkBrown,
    borderColor: C.darkBrown,
  },
  pillActiveDark: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.26)",
  },

  pillLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  pillLabelActive: {
    color: C.white,
  },
  pillLabelInactiveLight: {
    color: C.warmGray,
  },
  pillLabelInactiveDark: {
    color: "rgba(255,255,255,0.45)",
  },

  sep: {
    width: 1,
    height: 14,
    marginHorizontal: 8,
  },
  sepLight: {
    backgroundColor: C.border,
  },
  sepDark: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
});
