/**
 * perfil.tsx — Profile tab
 *
 * STATE A — Visitante (não logado)  : delega para AuthScreen (app/auth/index.tsx)
 * STATE B — Usuário Free            : FreeProfileScreen
 * STATE C — Usuário Lucky Premium       : ProProfileScreen
 *
 * Regra de sessão: sessão persiste via Supabase onAuthStateChange.
 * Usuário volta a ver login APENAS se clicar em "Sair" ou sessão expirar.
 *
 * NÃO mexer em Stripe / checkout / webhook / catálogo de planos.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { useRioHeroMedia } from "@/hooks/useHeroMedia";
import type { User } from "@supabase/supabase-js";
import AuthScreen from "@/app/auth";
import { supabase } from "@/lib/supabase";

// ── Constants ──────────────────────────────────────────────────────────────────

const GOLD      = "#1B4F72";
const GOLD_DIM  = "rgba(27,79,114,0.15)";
const GOLD_BDR  = "rgba(27,79,114,0.45)";
const DARK      = "#0D0D0D";
const SURFACE   = "rgba(255,255,255,0.07)";
const BORDER    = "rgba(255,255,255,0.12)";

// ── Subscription types ─────────────────────────────────────────────────────────

interface SubscriptionData {
  status: string;
  plano: string;
  periodo_atual_fim: string;
}

// ── Root Screen ────────────────────────────────────────────────────────────────

export default function PerfilScreen() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubLoading(false);
      return;
    }

    supabase
      .from("assinaturas")
      .select("status, plano, periodo_atual_fim")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setIsPremium(true);
          setSubscription(data as SubscriptionData);
        } else {
          setIsPremium(false);
          setSubscription(null);
        }
        setSubLoading(false);
      });
  }, [user]);

  if (authLoading || subLoading) {
    return (
      <View style={[s.profileRoot, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  if (user) {
    return isPremium
      ? <ProProfileScreen user={user} signOut={signOut} subscription={subscription} />
      : <FreeProfileScreen user={user} signOut={signOut} />;
  }

  return <AuthScreen />;
}

// ── Profile Hero Background ────────────────────────────────────────────────────

const PROFILE_HERO_IMAGES = [
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg" },
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero02.jpg" },
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero03.jpg" },
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero04.jpg" },
  { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero05.jpg" },
];
const PROFILE_HERO_INTERVAL = 10_000;

function ProfileHeroBg() {
  const rioHero = useRioHeroMedia("image");
  const resolvedPool =
    rioHero && rioHero.length > 0
      ? rioHero.map((item) => ({ uri: item.public_url }))
      : PROFILE_HERO_IMAGES;

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
    }, PROFILE_HERO_INTERVAL);

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
        blurRadius={22}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: nextOpacity }]}>
        <Image
          source={resolvedPool[nextIdx]}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          blurRadius={22}
        />
      </Animated.View>
      <View style={s.profileHeroOverlay} pointerEvents="none" />
      <LinearGradient
        colors={["transparent", "rgba(13,13,13,0.70)", "#0D0D0D"]}
        locations={[0.35, 0.72, 1]}
        style={s.profileHeroGradient}
        pointerEvents="none"
      />
    </>
  );
}

// ── Profile Shared Components ──────────────────────────────────────────────────

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  rightContent?: React.ReactNode;
  danger?: boolean;
};

function MenuItem({ icon, label, sublabel, onPress, rightContent, danger }: MenuItemProps) {
  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.65} accessibilityRole="button">
      <View style={s.menuIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[s.menuLabel, danger && { color: "#FF6B6B" }]} suppressHighlighting>{label}</Text>
        {sublabel ? <Text style={s.menuSublabel} suppressHighlighting>{sublabel}</Text> : null}
      </View>
      {rightContent ?? <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />}
    </TouchableOpacity>
  );
}

function ProfileHeader({ user, badge }: { user: User; badge: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top + 12;
  const displayName: string =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Viajante";

  return (
    <View style={[s.profileHeader, { paddingTop: topPad }]}>
      <ProfileHeroBg />
      <View style={s.avatar}>
        <Feather name="user" size={28} color={GOLD} />
      </View>
      <Text style={s.profileName} suppressHighlighting>{displayName}</Text>
      {user.email ? <Text style={s.profileEmail} suppressHighlighting>{user.email}</Text> : null}
      <View style={{ marginTop: 10 }}>{badge}</View>
    </View>
  );
}

// ── Meus Roteiros ──────────────────────────────────────────────────────────────

interface SavedRoteiro {
  id: string;
  destination_name: string;
  days_count: number;
  items_count: number;
  created_at: string;
  share_slug: string | null;
}

function MeusRoteiros({ userId }: { userId: string }) {
  const [roteiros, setRoteiros] = useState<SavedRoteiro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("user_itineraries")
      .select("id, destination_name, days_count, items_count, created_at, share_slug")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (!error && data) setRoteiros(data as SavedRoteiro[]);
        setLoading(false);
      });
  }, [userId]);

  return (
    <>
      <Text style={s.sectionLabel} suppressHighlighting>MEUS ROTEIROS</Text>
      <View style={s.menuCard}>
        {loading ? (
          <ActivityIndicator color={GOLD} style={{ margin: 16 }} />
        ) : roteiros.length === 0 ? (
          <View style={s.roteiroEmpty}>
            <Feather name="map" size={20} color="rgba(255,255,255,0.25)" />
            <Text style={s.roteiroEmptyText}>Nenhum roteiro salvo ainda</Text>
            <Pressable onPress={() => router.push("/(tabs)/roteiro")} style={s.roteiroCreateBtn}>
              <Text style={s.roteiroCreateBtnText}>Criar meu primeiro roteiro</Text>
              <Feather name="arrow-right" size={13} color={GOLD} />
            </Pressable>
          </View>
        ) : (
          <>
            {roteiros.map((r, idx) => (
              <React.Fragment key={r.id}>
                {idx > 0 && <View style={s.menuDivider} />}
                <Pressable
                  style={({ pressed }) => [s.roteiroItem, pressed && { opacity: 0.75 }]}
                  onPress={() => router.push("/(tabs)/roteiro")}
                >
                  <View style={s.roteiroIcon}>
                    <Feather name="map" size={16} color={GOLD} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.roteiroItemTitle} numberOfLines={1}>{r.destination_name}</Text>
                    <Text style={s.roteiroItemSub}>
                      {r.days_count} {r.days_count === 1 ? "dia" : "dias"} · {r.items_count} {r.items_count === 1 ? "item" : "itens"}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.30)" />
                </Pressable>
              </React.Fragment>
            ))}
            <View style={s.menuDivider} />
            <Pressable
              style={({ pressed }) => [s.roteiroNewBtn, pressed && { opacity: 0.75 }]}
              onPress={() => router.push("/(tabs)/roteiro")}
            >
              <Feather name="plus" size={15} color={GOLD} />
              <Text style={s.roteiroNewBtnText}>Criar novo roteiro</Text>
            </Pressable>
          </>
        )}
      </View>
    </>
  );
}

// ── Free Profile ───────────────────────────────────────────────────────────────

function FreeProfileScreen({ user, signOut }: { user: User; signOut: () => void }) {
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? 32 : insets.bottom + 80;

  return (
    <View style={s.profileRoot}>
      <ScrollView contentContainerStyle={{ paddingBottom: botPad }} showsVerticalScrollIndicator={false}>
        <ProfileHeader
          user={user}
          badge={
            <View style={s.freeBadge}>
              <Text style={s.freeBadgeText} suppressHighlighting>Lucky Free</Text>
            </View>
          }
        />

        <TouchableOpacity style={s.upgradeBtn} onPress={() => router.push("/(tabs)/subscription")} activeOpacity={0.85} accessibilityRole="button">
          <Text style={s.upgradeBtnText} suppressHighlighting>Virar Lucky Premium</Text>
        </TouchableOpacity>

        <MeusRoteiros userId={user.id} />

        <Text style={s.sectionLabel} suppressHighlighting>MINHA VIAGEM</Text>
        <View style={s.menuCard}>
          <MenuItem
            icon={<Feather name="book-open" size={18} color={GOLD} />}
            label="Diário de Viagem"
            sublabel="Registre memórias e momentos"
            onPress={() => router.navigate("/diario")}
          />
          <View style={s.menuDivider} />
          <MenuItem
            icon={<Feather name="divide-circle" size={18} color={GOLD} />}
            label="Divisão de Contas"
            sublabel="Organize os gastos do grupo"
            onPress={() => router.navigate("/contas")}
          />
        </View>

        <Text style={s.sectionLabel} suppressHighlighting>CONTA</Text>
        <View style={s.menuCard}>
          <MenuItem icon={<Feather name="user" size={18} color="rgba(255,255,255,0.60)" />} label="Informações da conta" onPress={() => {}} />
          <View style={s.menuDivider} />
          <MenuItem icon={<Feather name="settings" size={18} color="rgba(255,255,255,0.60)" />} label="Preferências" onPress={() => {}} />
          <View style={s.menuDivider} />
          <MenuItem icon={<Feather name="help-circle" size={18} color="rgba(255,255,255,0.60)" />} label="Ajuda e suporte" onPress={() => Linking.openURL("mailto:contato@theluckytrip.com")} />
          <View style={s.menuDivider} />
          <MenuItem icon={<Feather name="file-text" size={18} color="rgba(255,255,255,0.60)" />} label="Termos e Privacidade" onPress={() => {}} />
        </View>

        <View style={[s.menuCard, { marginTop: 8 }]}>
          <MenuItem icon={<Feather name="log-out" size={18} color="#FF6B6B" />} label="Sair" onPress={signOut} danger rightContent={<View />} />
        </View>
      </ScrollView>
    </View>
  );
}

// ── Helper: format date in Portuguese ─────────────────────────────────────────

function formatRenewalDate(isoDate: string): string {
  const date = new Date(isoDate);
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} de ${month} de ${year}`;
}

// ── Pro Profile ────────────────────────────────────────────────────────────────

function ProProfileScreen({
  user,
  signOut,
  subscription
}: {
  user: User;
  signOut: () => void;
  subscription: SubscriptionData | null;
}) {
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? 32 : insets.bottom + 80;

  return (
    <View style={s.profileRoot}>
      <ScrollView contentContainerStyle={{ paddingBottom: botPad }} showsVerticalScrollIndicator={false}>
        <ProfileHeader
          user={user}
          badge={
            <View style={s.proBadge}>
              <Text style={s.proBadgeText} suppressHighlighting>✦ Lucky Premium</Text>
            </View>
          }
        />

        {subscription?.periodo_atual_fim && (
          <Text style={s.renewalText} suppressHighlighting>
            Premium até {formatRenewalDate(subscription.periodo_atual_fim)}
          </Text>
        )}

        <View style={s.subscriptionCard}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <MaterialCommunityIcons name="crown" size={16} color={GOLD} />
            <Text style={s.subscriptionTitle} suppressHighlighting> Lucky Premium ativo</Text>
          </View>
          <Text style={s.subscriptionSub} suppressHighlighting>
            Você tem acesso completo a todos os segredos do Rio de Janeiro.
          </Text>
          <TouchableOpacity style={s.manageBtn} onPress={() => router.push("/(tabs)/subscription")} activeOpacity={0.75} accessibilityRole="button">
            <Text style={s.manageBtnText} suppressHighlighting>Gerenciar assinatura</Text>
          </TouchableOpacity>
        </View>

        <MeusRoteiros userId={user.id} />

        <Text style={s.sectionLabel} suppressHighlighting>MINHA VIAGEM</Text>
        <View style={s.menuCard}>
          <MenuItem icon={<Feather name="book-open" size={18} color={GOLD} />} label="Diário de Viagem" sublabel="Registre memórias e momentos" onPress={() => router.navigate("/diario")} />
          <View style={s.menuDivider} />
          <MenuItem icon={<Feather name="divide-circle" size={18} color={GOLD} />} label="Divisão de Contas" sublabel="Organize os gastos do grupo" onPress={() => router.navigate("/contas")} />
        </View>

        <Text style={s.sectionLabel} suppressHighlighting>CONTA</Text>
        <View style={s.menuCard}>
          <MenuItem icon={<Feather name="user" size={18} color="rgba(255,255,255,0.60)" />} label="Informações da conta" onPress={() => {}} />
          <View style={s.menuDivider} />
          <MenuItem icon={<Feather name="settings" size={18} color="rgba(255,255,255,0.60)" />} label="Preferências" onPress={() => {}} />
          <View style={s.menuDivider} />
          <MenuItem icon={<Feather name="help-circle" size={18} color="rgba(255,255,255,0.60)" />} label="Ajuda e suporte" onPress={() => Linking.openURL("mailto:contato@theluckytrip.com")} />
          <View style={s.menuDivider} />
          <MenuItem icon={<Feather name="file-text" size={18} color="rgba(255,255,255,0.60)" />} label="Termos e Privacidade" onPress={() => {}} />
        </View>

        <View style={[s.menuCard, { marginTop: 8 }]}>
          <MenuItem icon={<Feather name="log-out" size={18} color="#FF6B6B" />} label="Sair" onPress={signOut} danger rightContent={<View />} />
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  profileRoot: {
    flex: 1,
    backgroundColor: DARK,
  },
  profileHeader: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 36,
    overflow: "hidden",
    minHeight: 240,
  },
  profileHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  profileHeroGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(27,79,114,0.12)",
    borderWidth: 1.5,
    borderColor: GOLD_BDR,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  profileName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: "#FFFFFF",
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.70)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  profileEmail: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    textShadowColor: "rgba(0,0,0,0.60)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  freeBadge: {
    backgroundColor: "rgba(27,79,114,0.1)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  freeBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: GOLD,
    letterSpacing: 0.3,
  },

  proBadge: {
    backgroundColor: GOLD,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  proBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  upgradeBtn: {
    backgroundColor: GOLD,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: "center",
  },
  upgradeBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },

  renewalText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 8,
  },

  subscriptionCard: {
    backgroundColor: GOLD_DIM,
    borderWidth: 1,
    borderColor: GOLD_BDR,
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
  },
  subscriptionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: GOLD,
  },
  subscriptionSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 18,
    marginBottom: 14,
  },
  manageBtn: {
    alignSelf: "flex-start",
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GOLD_BDR,
    backgroundColor: "rgba(27,79,114,0.08)",
  },
  manageBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: GOLD,
  },

  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: "rgba(255,255,255,0.30)",
    letterSpacing: 1.5,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  menuCard: {
    marginHorizontal: 20,
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuIcon: {
    width: 28,
    alignItems: "center",
  },
  menuLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#FFFFFF",
  },
  menuSublabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.40)",
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginLeft: 56,
  },
  roteiroEmpty: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  roteiroEmptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
  },
  roteiroCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  roteiroCreateBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: GOLD,
  },
  roteiroItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  roteiroIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(27,79,114,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  roteiroItemTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#FFFFFF",
  },
  roteiroItemSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.40)",
    marginTop: 2,
  },
  roteiroNewBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  roteiroNewBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: GOLD,
  },
});
