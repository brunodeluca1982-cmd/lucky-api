/**
 * @deprecated
 *
 * useHeroPool is no longer used anywhere in the app.
 *
 * Background state is now managed globally by BackgroundContext
 * (context/BackgroundContext.tsx). All screens consume the shared pool,
 * index, and timer via `useBackground()` or the `<RotatingBackground />`
 * component, which reads from context automatically.
 *
 * DO NOT re-import this hook. Using it alongside BackgroundContext would
 * create duplicate Supabase fetches and independent rotation timers,
 * breaking the global synchronization guarantee.
 *
 * To access the pool: import { useBackground } from "@/context/BackgroundContext"
 * To render the background: import { RotatingBackground } from "@/components/RotatingBackground"
 */

import { ImageSourcePropType } from "react-native";
import { useBackground } from "@/context/BackgroundContext";

/** @deprecated Use `useBackground()` from BackgroundContext instead. */
export function useHeroPool(): ImageSourcePropType[] {
  return useBackground().pool;
}
