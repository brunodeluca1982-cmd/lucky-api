/**
 * AuthPrompt.tsx
 *
 * Global modal rendered when authPromptVisible = true (GuiaContext).
 * Collects email and calls signInWithOtp — no password, no OAuth.
 * Matches existing app palette. Dismiss via X button or backdrop tap.
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useGuia } from "@/context/GuiaContext";
import { useAuth } from "@/hooks/useAuth";

const GOLD     = "#1B4F72";
const GOLD_DIM = "rgba(27,79,114,0.12)";
const GOLD_BDR = "rgba(27,79,114,0.28)";

export default function AuthPrompt() {
  const { authPromptVisible, hideAuthPrompt } = useGuia();
  const { signInWithOtp }                     = useAuth();

  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  function handleDismiss() {
    hideAuthPrompt();
    setEmail("");
    setLoading(false);
    setSent(false);
    setError(null);
  }

  async function handleSubmit() {
    if (!email.trim() || loading) return;
    setLoading(true);
    setError(null);
    const { error: err } = await signInWithOtp(email.trim().toLowerCase());
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setSent(true);
    }
  }

  return (
    <Modal
      visible={authPromptVisible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={s.backdrop} onPress={handleDismiss} />

        <View style={s.sheet}>
          {/* Dismiss */}
          <Pressable style={s.closeBtn} onPress={handleDismiss} hitSlop={12}>
            <Feather name="x" size={18} color="rgba(255,255,255,0.45)" />
          </Pressable>

          {sent ? (
            <>
              <Feather name="mail" size={28} color={GOLD} style={s.icon} />
              <Text style={s.title}>Verifique seu e-mail</Text>
              <Text style={s.body}>
                Enviamos um link de acesso para{"\n"}
                <Text style={s.emailHighlight}>{email}</Text>
              </Text>
              <Pressable style={s.btn} onPress={handleDismiss}>
                <Text style={s.btnText}>Ok</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Feather name="lock" size={26} color={GOLD} style={s.icon} />
              <Text style={s.title}>Entre para continuar</Text>
              <Text style={s.body}>
                Salve lugares e organize sua viagem. Enviaremos um link de acesso para o seu e-mail.
              </Text>

              <TextInput
                style={s.input}
                placeholder="seu@email.com"
                placeholderTextColor="rgba(255,255,255,0.30)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={handleSubmit}
                returnKeyType="send"
              />

              {error && <Text style={s.errorText}>{error}</Text>}

              <Pressable
                style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={s.btnText}>Enviar link de acesso</Text>
                }
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex:            1,
    justifyContent:  "flex-end",
    backgroundColor: "rgba(0,0,0,0.70)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor:   "#0A0A0A",
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    borderWidth:       1,
    borderColor:       GOLD_BDR,
    padding:           28,
    paddingBottom:     44,
    alignItems:        "center",
  },
  closeBtn: {
    position: "absolute",
    top:      16,
    right:    16,
  },
  icon: {
    marginBottom: 16,
    marginTop:    8,
  },
  title: {
    fontFamily:   "PlayfairDisplay_700Bold",
    fontSize:     22,
    color:        "#FFFFFF",
    textAlign:    "center",
    marginBottom: 10,
  },
  body: {
    fontFamily:   "Inter_400Regular",
    fontSize:     14,
    color:        "rgba(255,255,255,0.55)",
    textAlign:    "center",
    lineHeight:   21,
    marginBottom: 24,
  },
  emailHighlight: {
    color:      GOLD,
    fontFamily: "Inter_500Medium",
  },
  input: {
    width:             "100%",
    backgroundColor:   "#161616",
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.12)",
    borderRadius:      12,
    paddingHorizontal: 16,
    paddingVertical:   14,
    color:             "#FFFFFF",
    fontFamily:        "Inter_400Regular",
    fontSize:          15,
    marginBottom:      12,
  },
  errorText: {
    fontFamily:   "Inter_400Regular",
    fontSize:     13,
    color:        "#FF6B6B",
    textAlign:    "center",
    marginBottom: 10,
  },
  btn: {
    width:           "100%",
    backgroundColor: GOLD,
    borderRadius:    13,
    paddingVertical: 10,
    alignItems:      "center",
    marginTop:       4,
    minHeight:       44,
    justifyContent:  "center",
  },
  btnText: {
    fontFamily:    "Inter_600SemiBold",
    fontSize:      14,
    color:         "#000000",
    letterSpacing: 0.1,
  },
});
