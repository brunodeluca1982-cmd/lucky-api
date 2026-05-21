import { useCallback, useRef, useState } from "react";
import { Animated } from "react-native";
import { detectPeriodo, type Periodo } from "@/data/mockData";

const PERIODS: Periodo[] = ["manha", "tarde", "noite"];

export function useTimeOfDay() {
  const [periodo, setPeriodoState] = useState<Periodo>(detectPeriodo());
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const setPeriodo = useCallback(
    (next: Periodo) => {
      if (next === periodo) return;
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      setTimeout(() => setPeriodoState(next), 160);
    },
    [periodo, fadeAnim]
  );

  const cyclePeriodo = useCallback(() => {
    const idx = PERIODS.indexOf(periodo);
    const next = PERIODS[(idx + 1) % PERIODS.length];
    setPeriodo(next);
  }, [periodo, setPeriodo]);

  return { periodo, setPeriodo, cyclePeriodo, fadeAnim };
}
