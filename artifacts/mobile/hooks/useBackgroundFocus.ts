/**
 * useBackgroundFocus.ts — Manages blur animation for background focus effect.
 *
 * When the Rio de Janeiro card is active in the carousel:
 *   1. Blur animates from 18 → 4 over 800ms
 *   2. After 2 seconds, blur returns to 18 over 1200ms
 *
 * Usage:
 *   const { blurAnim, triggerFocus } = useBackgroundFocus();
 *   <BackgroundMedia animatedBlur={blurAnim} />
 *   // Call triggerFocus() when Rio card becomes active
 */

import { useRef, useCallback } from "react";
import { Animated } from "react-native";

const BLUR_DEFAULT = 18;
const BLUR_FOCUSED = 4;
const FOCUS_IN_DURATION = 800;
const FOCUS_OUT_DURATION = 1200;
const HOLD_DURATION = 2000;

type UseBackgroundFocusReturn = {
  /** Animated blur value to pass to BackgroundMedia */
  blurAnim: Animated.Value;
  /** Trigger focus animation (blur in, hold, blur out) */
  triggerFocus: () => void;
  /** Cancel any running animation and reset to default blur */
  resetBlur: () => void;
  /** Current blur value (for reading without animation) */
  currentBlur: number;
};

export function useBackgroundFocus(): UseBackgroundFocusReturn {
  const blurAnim = useRef(new Animated.Value(BLUR_DEFAULT)).current;
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const currentBlurRef = useRef(BLUR_DEFAULT);

  const cleanup = useCallback(() => {
    if (holdTimeout.current) {
      clearTimeout(holdTimeout.current);
      holdTimeout.current = null;
    }
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
  }, []);

  const triggerFocus = useCallback(() => {
    cleanup();

    // Phase 1: Blur from 18 → 4
    animationRef.current = Animated.timing(blurAnim, {
      toValue: BLUR_FOCUSED,
      duration: FOCUS_IN_DURATION,
      useNativeDriver: false, // blurRadius cannot use native driver
    });

    animationRef.current.start(({ finished }) => {
      if (!finished) return;
      currentBlurRef.current = BLUR_FOCUSED;

      // Phase 2: Hold for 2 seconds, then return to 18
      holdTimeout.current = setTimeout(() => {
        animationRef.current = Animated.timing(blurAnim, {
          toValue: BLUR_DEFAULT,
          duration: FOCUS_OUT_DURATION,
          useNativeDriver: false,
        });

        animationRef.current.start(({ finished: f2 }) => {
          if (f2) currentBlurRef.current = BLUR_DEFAULT;
        });
      }, HOLD_DURATION);
    });
  }, [blurAnim, cleanup]);

  const resetBlur = useCallback(() => {
    cleanup();
    blurAnim.setValue(BLUR_DEFAULT);
    currentBlurRef.current = BLUR_DEFAULT;
  }, [blurAnim, cleanup]);

  return {
    blurAnim,
    triggerFocus,
    resetBlur,
    currentBlur: currentBlurRef.current,
  };
}

export default useBackgroundFocus;
