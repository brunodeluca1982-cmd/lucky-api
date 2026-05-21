/**
 * app/auth/index.tsx — AuthScreen
 *
 * Standalone auth component extracted from perfil.tsx.
 * Manages login / signup / forgot-password / email-sent states.
 * Rendered by PerfilScreen when there is no authenticated user.
 *
 * Does NOT depend on any parent state — owns all form state internally.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AntDesign, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { useRioHeroMedia } from "@/hooks/useHeroMedia";

// ── Constants ──────────────────────────────────────────────────────────────────

const AREIA = "#F5F0E8";
const PETROL = "#1B4F72";
const LOGO = require("@/assets/images/logo-symbol.png");

const HERO_IMAGES = [
  require("@/assets/images/ipanema.png"),
  require("@/assets/images/cristo.png"),
  require("@/assets/images/pao-acucar.png"),
  require("@/assets/images/lapa.png"),
];
const HERO_INTERVAL_MS = 10_000;

// Web: disable text selection on interactive elements
const WNS: object =
  Platform.OS === "web"
    ? ({
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      } as any)
    : {};

// ── Utilities ──────────────────────────────────────────────────────────────────

function webCleanup() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  try {
    (document.activeElement as HTMLElement)?.blur();
    window.getSelection()?.removeAllRanges();
  } catch (_) {}
}

function translateAuthError(raw: string, isLogin: boolean): string {
  const msg = raw.toLowerCase();
  if (msg.includes("invalid login credentials") || msg.includes("invalid credentials"))
    return isLogin
      ? "E-mail ou senha incorretos. Verifique e tente novamente."
      : "Erro ao criar conta. Tente novamente.";
  if (msg.includes("email not confirmed"))
    return "Confirme o seu e-mail antes de entrar. Verifique a caixa de entrada.";
  if (msg.includes("user already registered") || msg.includes("already registered"))
    return "Este e-mail já tem cadastro. Clique em \"Entrar\" para acessar.";
  if (msg.includes("password should be at least"))
    return "A senha deve ter pelo menos 6 caracteres.";
  if (msg.includes("unable to validate email address"))
    return "E-mail inválido. Verifique e tente novamente.";
  if (msg.includes("signup is disabled"))
    return "Cadastros temporariamente desabilitados. Tente mais tarde.";
  if (msg.includes("email rate limit") || msg.includes("too many requests"))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  return raw;
}

// ── Rotating hero background ───────────────────────────────────────────────────

function HeroBackground() {
  const rioHero = useRioHeroMedia("image");
  const resolvedPool =
    rioHero && rioHero.length > 0
      ? rioHero.map((item) => ({ uri: item.public_url }))
      : HERO_IMAGES;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [nextIdx,    setNextIdx]    = useState(1);
  const nextOpacity = useRef(new Animated.Value(0)).current;
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      Animated.timing(nextOpacity, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setCurrentIdx((c) => {
          setNextIdx((c + 2) % resolvedPool.length);
          return (c + 1) % resolvedPool.length;
        });
        nextOpacity.setValue(0);
      });
    }, HERO_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resolvedPool.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Image
        source={resolvedPool[currentIdx]}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        blurRadius={20}
        pointerEvents="none"
      />
      <Animated.Image
        source={resolvedPool[nextIdx]}
        style={[StyleSheet.absoluteFill, { opacity: nextOpacity }]}
        resizeMode="cover"
        blurRadius={20}
        pointerEvents="none"
      />
      <View style={s.heroOverlay} pointerEvents="none" />
    </>
  );
}

// ── Login Screen ───────────────────────────────────────────────────────────────

type LoginScreenProps = {
  email: string;       setEmail: (v: string) => void;
  password: string;    setPassword: (v: string) => void;
  showPass: boolean;   setShowPass: (v: boolean) => void;
  loading: boolean;    googleLoading: boolean;
  error: string | null;
  onSubmit: () => void;
  onGooglePress: () => void;
  onGoSignup: () => void;
  onGoForgot: () => void;
};

function LoginScreen({
  email, setEmail, password, setPassword,
  showPass, setShowPass, loading, googleLoading,
  error, onSubmit, onGooglePress, onGoSignup, onGoForgot,
}: LoginScreenProps) {
  return (
    <View style={s.page}>
      <TouchableOpacity
        style={s.backBtn}
        onPress={() => router.replace("/")}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        <Feather name="arrow-left" size={16} color="rgba(255,255,255,0.80)" />
        <Text style={s.backText} suppressHighlighting>Voltar</Text>
      </TouchableOpacity>

      <View style={s.logoWrap}>
        <Image source={LOGO} style={s.logo} resizeMode="contain" />
        <Text style={s.brand} suppressHighlighting>THE LUCKY TRIP</Text>
      </View>

      <View style={s.badge}>
        <Text style={s.badgeText} suppressHighlighting>ENTRAR</Text>
      </View>
      <Text style={s.headline} suppressHighlighting>Bem-vindo de volta</Text>

      <View style={s.fieldWrap}>
        <Feather name="mail" size={16} color="rgba(255,255,255,0.40)" />
        <TextInput
          style={s.field}
          placeholder="E-mail"
          placeholderTextColor="rgba(255,255,255,0.38)"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
        />
      </View>

      <View style={s.fieldWrap}>
        <Feather name="lock" size={16} color="rgba(255,255,255,0.40)" />
        <TextInput
          style={[s.field, { flex: 1 }]}
          placeholder="Senha"
          placeholderTextColor="rgba(255,255,255,0.38)"
          secureTextEntry={!showPass}
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />
        <TouchableOpacity
          onPress={() => setShowPass(!showPass)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
          accessibilityRole="button"
        >
          <Feather name={showPass ? "eye-off" : "eye"} size={16} color="rgba(255,255,255,0.40)" />
        </TouchableOpacity>
      </View>

      {error ? <Text style={s.errorText} suppressHighlighting>{error}</Text> : null}

      <TouchableOpacity style={s.cta} onPress={onSubmit} activeOpacity={0.85} disabled={loading} accessibilityRole="button">
        {loading ? <ActivityIndicator color="#000" /> : <Text style={s.ctaText} suppressHighlighting>Entrar</Text>}
      </TouchableOpacity>

      <View style={s.dividerRow}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText} suppressHighlighting>ou continue com</Text>
        <View style={s.dividerLine} />
      </View>

      <View style={s.socialRow}>
        <TouchableOpacity style={s.socialBtn} onPress={onGooglePress} activeOpacity={0.7} disabled={googleLoading} accessibilityRole="button">
          {googleLoading
            ? <ActivityIndicator size="small" color="rgba(255,255,255,0.70)" />
            : <AntDesign name="google" size={17} color="#FFFFFF" />
          }
          <Text style={s.socialBtnText} suppressHighlighting>Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.socialBtn} onPress={() => router.replace("/")} activeOpacity={0.7} accessibilityRole="button">
          <Feather name="compass" size={17} color="#FFFFFF" />
          <Text style={s.socialBtnText} suppressHighlighting>Continuar sem conta</Text>
        </TouchableOpacity>
      </View>

      <View style={s.footerRow}>
        <Text style={s.footerText} suppressHighlighting>Não tem conta?{"  "}</Text>
        <TouchableOpacity onPress={onGoSignup} activeOpacity={0.7} accessibilityRole="button">
          <Text style={s.footerLink} suppressHighlighting>Criar conta</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={{ marginTop: 8 }} onPress={onGoForgot} activeOpacity={0.7} accessibilityRole="button">
        <Text style={[s.footerLink, { fontSize: 13 }]} suppressHighlighting>Esqueceu a senha?</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Signup Screen ──────────────────────────────────────────────────────────────

type SignupScreenProps = {
  name: string;       setName: (v: string) => void;
  email: string;      setEmail: (v: string) => void;
  password: string;   setPassword: (v: string) => void;
  showPass: boolean;  setShowPass: (v: boolean) => void;
  agreed: boolean;    setAgreed: (v: boolean) => void;
  loading: boolean;   googleLoading: boolean;
  error: string | null;
  onSubmit: () => void;
  onGooglePress: () => void;
  onGoLogin: () => void;
};

function SignupScreen({
  name, setName, email, setEmail, password, setPassword,
  showPass, setShowPass, agreed, setAgreed,
  loading, googleLoading, error, onSubmit, onGooglePress, onGoLogin,
}: SignupScreenProps) {
  return (
    <View style={s.page}>
      <TouchableOpacity style={s.backBtn} onPress={onGoLogin} activeOpacity={0.7} accessibilityRole="button">
        <Feather name="arrow-left" size={16} color="rgba(255,255,255,0.80)" />
        <Text style={s.backText} suppressHighlighting>Voltar</Text>
      </TouchableOpacity>

      <View style={s.logoWrap}>
        <Image source={LOGO} style={s.logo} resizeMode="contain" />
        <Text style={s.brand} suppressHighlighting>THE LUCKY TRIP</Text>
      </View>

      <View style={s.badge}>
        <Text style={s.badgeText} suppressHighlighting>CRIE SUA CONTA</Text>
      </View>
      <Text style={s.headline} suppressHighlighting>Comece a planejar suas viagens dos sonhos</Text>

      <View style={s.fieldWrap}>
        <Feather name="user" size={16} color="rgba(255,255,255,0.40)" />
        <TextInput
          style={s.field}
          placeholder="Nome completo"
          placeholderTextColor="rgba(255,255,255,0.38)"
          autoCapitalize="words"
          autoCorrect={false}
          value={name}
          onChangeText={setName}
          returnKeyType="next"
        />
      </View>

      <View style={s.fieldWrap}>
        <Feather name="mail" size={16} color="rgba(255,255,255,0.40)" />
        <TextInput
          style={s.field}
          placeholder="E-mail"
          placeholderTextColor="rgba(255,255,255,0.38)"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
        />
      </View>

      <View style={s.fieldWrap}>
        <Feather name="lock" size={16} color="rgba(255,255,255,0.40)" />
        <TextInput
          style={[s.field, { flex: 1 }]}
          placeholder="Senha"
          placeholderTextColor="rgba(255,255,255,0.38)"
          secureTextEntry={!showPass}
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />
        <TouchableOpacity
          onPress={() => setShowPass(!showPass)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
          accessibilityRole="button"
        >
          <Feather name={showPass ? "eye-off" : "eye"} size={16} color="rgba(255,255,255,0.40)" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={s.checkRow}
        onPress={() => setAgreed(!agreed)}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
      >
        <View style={[s.checkbox, agreed && s.checkboxChecked]}>
          {agreed && <Feather name="check" size={11} color="#000" />}
        </View>
        <Text style={s.checkText} suppressHighlighting>
          Concordo com os{" "}
          <Text style={s.checkLink}>Termos de Uso</Text>
          {"  "}
          <Text style={s.checkLink}>Política de Privacidade</Text>
        </Text>
      </TouchableOpacity>

      {error ? <Text style={s.errorText} suppressHighlighting>{error}</Text> : null}

      <TouchableOpacity style={s.cta} onPress={onSubmit} activeOpacity={0.85} disabled={loading} accessibilityRole="button">
        {loading ? <ActivityIndicator color="#000" /> : <Text style={s.ctaText} suppressHighlighting>Criar conta</Text>}
      </TouchableOpacity>

      <View style={s.dividerRow}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText} suppressHighlighting>ou continue com</Text>
        <View style={s.dividerLine} />
      </View>

      <View style={s.socialRow}>
        <TouchableOpacity style={s.socialBtn} onPress={onGooglePress} activeOpacity={0.7} disabled={googleLoading} accessibilityRole="button">
          {googleLoading
            ? <ActivityIndicator size="small" color="rgba(255,255,255,0.70)" />
            : <AntDesign name="google" size={17} color="#FFFFFF" />
          }
          <Text style={s.socialBtnText} suppressHighlighting>Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.socialBtn, { opacity: 0.5 }]} activeOpacity={0.7} accessibilityRole="button" disabled>
          <AntDesign name="apple1" size={17} color="#FFFFFF" />
          <Text style={s.socialBtnText} suppressHighlighting>Apple</Text>
        </TouchableOpacity>
      </View>

      <View style={s.footerRow}>
        <Text style={s.footerText} suppressHighlighting>Já tem uma conta?{"  "}</Text>
        <TouchableOpacity onPress={onGoLogin} activeOpacity={0.7} accessibilityRole="button">
          <Text style={s.footerLink} suppressHighlighting>Entrar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Forgot Password Screen ─────────────────────────────────────────────────────

function ForgotScreen({
  email, setEmail, loading, error, onBack, onSubmit,
}: {
  email: string; setEmail: (v: string) => void;
  loading: boolean; error: string | null;
  onBack: () => void; onSubmit: () => void;
}) {
  return (
    <View style={s.page}>
      <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7} accessibilityRole="button">
        <Feather name="arrow-left" size={16} color="rgba(255,255,255,0.80)" />
        <Text style={s.backText} suppressHighlighting>Voltar</Text>
      </TouchableOpacity>

      <View style={s.logoWrap}>
        <Image source={LOGO} style={s.logo} resizeMode="contain" />
        <Text style={s.brand} suppressHighlighting>THE LUCKY TRIP</Text>
      </View>

      <View style={s.badge}>
        <Text style={s.badgeText} suppressHighlighting>REDEFINIR SENHA</Text>
      </View>
      <Text style={s.headline} suppressHighlighting>Recuperar acesso</Text>
      <Text style={[s.sub, { marginBottom: 20 }]} suppressHighlighting>
        Digite seu e-mail e enviaremos um link para criar uma nova senha.
      </Text>

      <View style={s.fieldWrap}>
        <Feather name="mail" size={16} color="rgba(255,255,255,0.40)" />
        <TextInput
          style={s.field}
          placeholder="E-mail"
          placeholderTextColor="rgba(255,255,255,0.38)"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />
      </View>

      {error ? <Text style={s.errorText} suppressHighlighting>{error}</Text> : null}

      <TouchableOpacity style={s.cta} onPress={onSubmit} activeOpacity={0.85} disabled={loading} accessibilityRole="button">
        {loading ? <ActivityIndicator color="#000" /> : <Text style={s.ctaText} suppressHighlighting>Enviar link de redefinição</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ── Email Sent State ───────────────────────────────────────────────────────────

function EmailSentState({
  email, kind, onBack,
}: {
  email: string; kind: "confirm" | "reset"; onBack: () => void;
}) {
  const isReset = kind === "reset";
  return (
    <View style={s.center}>
      <Image source={LOGO} style={s.logo} resizeMode="contain" />
      <View style={s.sentIcon}>
        <Feather name="mail" size={28} color={PETROL} />
      </View>
      <Text style={s.headline} suppressHighlighting>
        {isReset ? "Verifique seu e-mail" : "Confirme seu e-mail"}
      </Text>
      <Text style={s.sub} suppressHighlighting>
        {isReset ? "Enviamos o link de redefinição para" : "Enviamos um e-mail de confirmação para"}{"\n"}
        <Text style={{ color: PETROL, fontFamily: "Inter_500Medium" }}>{email}</Text>
      </Text>
      <Text style={s.sentNote} suppressHighlighting>
        {isReset
          ? "Clique no link para criar uma nova senha e voltar a acessar sua conta."
          : "Clique no link no e-mail para ativar sua conta e entrar automaticamente."}
      </Text>
      <TouchableOpacity style={{ marginTop: 24 }} onPress={onBack} activeOpacity={0.7} accessibilityRole="button">
        <Text style={[s.footerLink, { fontSize: 14 }]} suppressHighlighting>← Voltar ao login</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Auth Screen (main export) ──────────────────────────────────────────────────

type AuthScreenType = "login" | "signup" | "forgot";

export default function AuthScreen() {
  const { signInWithPassword, signUp, sendPasswordReset, signInWithGoogle } = useAuth();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 20 : insets.top + 8;
  const botPad  = Platform.OS === "web" ? 32 : insets.bottom + 16;

  const [screen,        setScreen]        = useState<AuthScreenType>("login");
  const [name,          setName]          = useState("");
  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [showPass,      setShowPass]      = useState(false);
  const [agreed,        setAgreed]        = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [needsConfirm,  setNeedsConfirm]  = useState(false);
  const [resetSent,     setResetSent]     = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  function clearForm() {
    setError(null);
    setPassword("");
    setShowPass(false);
    setNeedsConfirm(false);
    setResetSent(false);
  }

  function goLogin()  { clearForm(); setScreen("login");  }
  function goSignup() { clearForm(); setScreen("signup"); }
  function goForgot() { clearForm(); setScreen("forgot"); }

  async function handleLogin() {
    const trimEmail = email.trim().toLowerCase();
    const trimPass  = password.trim();
    if (!trimEmail || !trimPass || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await signInWithPassword(trimEmail, trimPass);
      if (err) setError(translateAuthError(err, true));
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
      webCleanup();
    }
  }

  async function handleSignup() {
    const trimEmail = email.trim().toLowerCase();
    const trimPass  = password.trim();
    if (!trimEmail || !trimPass || loading) return;
    if (trimPass.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: err, needsConfirmation } = await signUp(trimEmail, trimPass, name.trim() || undefined);
      if (err) {
        setError(translateAuthError(err, false));
      } else if (needsConfirmation) {
        setNeedsConfirm(true);
      }
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
      webCleanup();
    }
  }

  async function handleReset() {
    const trimEmail = email.trim().toLowerCase();
    if (!trimEmail || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await sendPasswordReset(trimEmail);
      if (err) setError("Não foi possível enviar o e-mail. Verifique o endereço.");
      else setResetSent(true);
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
      webCleanup();
    }
  }

  async function handleGoogle() {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError(null);
    try {
      const { error: err } = await signInWithGoogle();
      if (err) setError(err);
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setGoogleLoading(false);
      webCleanup();
    }
  }

  return (
    <View style={[s.root, WNS]}>
      <HeroBackground />
      <KeyboardAvoidingView style={[s.kav, WNS]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={WNS}
          contentContainerStyle={[s.scroll, { paddingTop: topPad, paddingBottom: botPad }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {needsConfirm ? (
            <EmailSentState email={email} kind="confirm" onBack={goLogin} />
          ) : resetSent ? (
            <EmailSentState email={email} kind="reset" onBack={goLogin} />
          ) : screen === "forgot" ? (
            <ForgotScreen
              email={email} setEmail={setEmail}
              loading={loading} error={error}
              onBack={goLogin} onSubmit={handleReset}
            />
          ) : screen === "signup" ? (
            <SignupScreen
              name={name}         setName={setName}
              email={email}       setEmail={setEmail}
              password={password} setPassword={setPassword}
              showPass={showPass} setShowPass={setShowPass}
              agreed={agreed}     setAgreed={setAgreed}
              loading={loading}   googleLoading={googleLoading}
              error={error}
              onSubmit={handleSignup}
              onGooglePress={handleGoogle}
              onGoLogin={goLogin}
            />
          ) : (
            <LoginScreen
              email={email}       setEmail={setEmail}
              password={password} setPassword={setPassword}
              showPass={showPass} setShowPass={setShowPass}
              loading={loading}   googleLoading={googleLoading}
              error={error}
              onSubmit={handleLogin}
              onGooglePress={handleGoogle}
              onGoSignup={goSignup}
              onGoForgot={goForgot}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  kav:    { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },

  page: {
    flex: 1,
    alignItems: "center",
    ...WNS,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    ...WNS,
  },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 10,
    marginBottom: 4,
    ...WNS,
  },
  backText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.80)",
  },

  logoWrap: {
    alignItems: "center",
    marginBottom: 12,
    ...WNS,
  },
  logo: {
    width: 100,
    height: 28,
    marginBottom: 4,
  },
  brand: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
    letterSpacing: 3,
  },

  badge: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 16,
    ...WNS,
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 2,
  },

  headline: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 36,
    ...WNS,
  },

  fieldWrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    marginBottom: 12,
    gap: 10,
  },
  field: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#FFFFFF",
  },

  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 10,
    marginBottom: 16,
    ...WNS,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.40)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: AREIA,
    borderColor: PETROL,
  },
  checkText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    flexShrink: 1,
  },
  checkLink: {
    color: PETROL,
    fontFamily: "Inter_500Medium",
  },

  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#FF6B6B",
    marginBottom: 10,
    textAlign: "center",
    ...WNS,
  },

  cta: {
    width: "100%",
    backgroundColor: AREIA,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 18,
  },
  ctaText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: PETROL,
    ...WNS,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 14,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  dividerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    ...WNS,
  },

  socialRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginBottom: 20,
  },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 12,
    paddingVertical: 13,
  },
  socialBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#FFFFFF",
    ...WNS,
  },

  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    ...WNS,
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
  },
  footerLink: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: PETROL,
  },

  sentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(27,79,114,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
    ...WNS,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.60)",
    textAlign: "center",
    marginBottom: 6,
    lineHeight: 20,
    ...WNS,
  },
  sentNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 16,
    ...WNS,
  },
});
