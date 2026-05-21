import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

// Single stable origin used for all web auth redirects.
// Priority: EXPO_PUBLIC_APP_ORIGIN (deployed URL) → EXPO_PUBLIC_EXPO_DOMAIN (dev) → ""
const WEB_ORIGIN: string = process.env.EXPO_PUBLIC_APP_ORIGIN
  ? process.env.EXPO_PUBLIC_APP_ORIGIN
  : process.env.EXPO_PUBLIC_EXPO_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_EXPO_DOMAIN}`
    : "";

// All auth emails should land on the /auth/callback route which handles
// both email confirmation (SIGNED_IN) and password reset (PASSWORD_RECOVERY).
function callbackUrl(): string | undefined {
  return WEB_ORIGIN ? `${WEB_ORIGIN}/auth/callback` : undefined;
}

function webCleanup() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  try {
    (document.activeElement as HTMLElement)?.blur();
    window.getSelection()?.removeAllRanges();
  } catch (_) {}
}

export interface AuthState {
  user:               User | null;
  session:            Session | null;
  loading:            boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp:             (email: string, password: string, name?: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  sendPasswordReset:  (email: string) => Promise<{ error: string | null }>;
  signInWithOtp:      (email: string) => Promise<{ error: string | null }>;
  signInWithGoogle:   () => Promise<{ error: string | null }>;
  signOut:            () => Promise<void>;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Email + Password login ─────────────────────────────────────────────────

  async function signInWithPassword(email: string, password: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      webCleanup();
      if (error) return { error: error.message };
      return { error: null };
    } catch (e: any) {
      webCleanup();
      return { error: e?.message ?? "Erro inesperado." };
    }
  }

  // ── Email + Password signup ────────────────────────────────────────────────
  // Returns needsConfirmation=true when Supabase requires email verification
  // before the session is activated (depends on project settings).

  async function signUp(
    email: string,
    password: string,
    name?: string,
  ): Promise<{ error: string | null; needsConfirmation: boolean }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name ?? "" } },
      });
      webCleanup();
      if (error) return { error: error.message, needsConfirmation: false };
      // session is null when email confirmation is required
      const needsConfirmation = data.session === null && data.user !== null;
      return { error: null, needsConfirmation };
    } catch (e: any) {
      webCleanup();
      return { error: e?.message ?? "Erro inesperado.", needsConfirmation: false };
    }
  }

  // ── Password reset ────────────────────────────────────────────────────────

  async function sendPasswordReset(email: string): Promise<{ error: string | null }> {
    try {
      const redirectTo = Platform.OS === "web" ? callbackUrl() : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      webCleanup();
      if (error) return { error: error.message };
      return { error: null };
    } catch (e: any) {
      webCleanup();
      return { error: e?.message ?? "Erro inesperado." };
    }
  }

  // ── Email OTP (magic link — kept as fallback) ──────────────────────────────

  async function signInWithOtp(email: string): Promise<{ error: string | null }> {
    try {
      const emailRedirectTo = Platform.OS === "web" ? callbackUrl() : undefined;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });

      webCleanup();
      if (error) return { error: error.message };
      return { error: null };
    } catch (e: any) {
      webCleanup();
      return { error: e?.message ?? "Erro inesperado." };
    }
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────

  async function signInWithGoogle(): Promise<{ error: string | null }> {
    console.log("[signInWithGoogle] Iniciando login com Google");
    console.log("[signInWithGoogle] Platform:", Platform.OS);

    if (Platform.OS === "web") {
      console.log("[signInWithGoogle] Web flow - redirectTo:", callbackUrl());
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: callbackUrl() },
        });
        console.log("[signInWithGoogle] Web OAuth data:", data);
        if (error) {
          console.error("[signInWithGoogle] Web OAuth error:", error);
        }
        webCleanup();
        if (error) return { error: error.message };
        return { error: null };
      } catch (e: any) {
        console.error("[signInWithGoogle] Web OAuth exception:", e);
        webCleanup();
        return { error: e?.message ?? "Erro inesperado." };
      }
    }

    // Native OAuth flow using expo-auth-session
    try {
      const redirectTo = makeRedirectUri({ scheme: "theluckytrip" });
      console.log("[signInWithGoogle] Native flow - Redirect URL:", redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        console.error("[signInWithGoogle] OAuth error:", error);
        return { error: error?.message ?? "Não foi possível iniciar login com Google." };
      }

      console.log("[signInWithGoogle] Opening OAuth URL:", data.url);
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      console.log("[signInWithGoogle] Auth result:", result.type);

      if (result.type === "cancel" || result.type === "dismiss") {
        return { error: null }; // User cancelled, not an error
      }

      if (result.type === "success" && result.url) {
        const { error: sessionErr } = await supabase.auth.exchangeCodeForSession(result.url);
        if (sessionErr) {
          console.error("[signInWithGoogle] exchangeCodeForSession error:", sessionErr);
          return { error: sessionErr.message };
        }
        return { error: null };
      }

      return { error: null };
    } catch (e: any) {
      console.error("[signInWithGoogle] Exception:", e);
      return { error: e?.message ?? "Erro inesperado ao fazer login com Google." };
    }
  }

  // ── Sign out ───────────────────────────────────────────────────────────────

  async function signOut(): Promise<void> {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (_) {}
    webCleanup();
  }

  return {
    user:               session?.user ?? null,
    session,
    loading,
    signInWithPassword,
    signUp,
    sendPasswordReset,
    signInWithOtp,
    signInWithGoogle,
    signOut,
  };
}
