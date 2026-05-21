/**
 * splashGate.ts
 *
 * Coordinates the two signals that must both be true before the splash screen
 * can be hidden:
 *   1. Fonts are loaded (notifyFontsReady)
 *   2. The first home hero background is displayed (notifyHeroReady)
 *
 * A 1-second safety timeout ensures the splash always hides even if the hero
 * image callback is never called (edge cases, navigation skips, etc.).
 */
import * as SplashScreen from "expo-splash-screen";

let _fonts    = false;
let _hero     = false;
let _hidden   = false;
let _safetyTimer: ReturnType<typeof setTimeout> | null = null;

function _hide() {
  if (_hidden) return;
  _hidden = true;
  if (_safetyTimer) clearTimeout(_safetyTimer);
  SplashScreen.hideAsync().catch(() => {});
}

function _check() {
  if (_fonts && _hero) _hide();
}

/** Call this once fonts are loaded (in _layout.tsx). */
export function notifyFontsReady(): void {
  _fonts = true;
  _check();
  // Safety: never hold splash more than 1 s after fonts are ready.
  if (!_safetyTimer) {
    _safetyTimer = setTimeout(_hide, 1000);
  }
}

/** Call this from the first hero background's onDisplay / onLoad callback. */
export function notifyHeroReady(): void {
  _hero = true;
  _check();
}
