/**
 * GuiaContext.tsx
 *
 * Global state for saved places, premium status, and paywall gating.
 *
 * DATA MODEL
 * ──────────
 *   SavedItem   — a place the user bookmarked (id, categoria, titulo, localizacao, image)
 *   Viagem      — the trip entity  (id, nome, destino, created_at)
 *   ViagemItem  — links a saved place to the viagem (viagem_id, item_id, tipo, bairro)
 *
 * PREMIUM
 * ───────
 *   isPremium is read from Supabase access_levels using the authenticated user.id.
 *   AsyncStorage (PREMIUM_KEY) is used only as a fast-path cache — Supabase is authoritative.
 *   Access gates: generate/edit itinerary, Lucky List locked items (saving is free for all authenticated users).
 *   Global paywall is triggered via showPaywall(type) — rendered by PaywallModal in layout.
 *
 * PERSISTENCE
 * ───────────
 *   Saved items are persisted to AsyncStorage (key: @luckytrip/saved_v1) as the fast-path
 *   local cache. For authenticated users, saves are also synced to Supabase (user_saved_places)
 *   in the background — Supabase is the authoritative cross-device store.
 *   On login, server saves are merged with local state (union strategy).
 *   Images stored as `image_url` (URI string) in Supabase; local require() IDs used for display.
 *
 * ROTEIRO
 * ───────
 *   `buildRoteiro(saved)` (see utils/buildRoteiro.ts) converts the flat saved
 *   list into DiaRoteiro[] — grouped by bairro, ordered by manhã/almoço/tarde/noite.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus, type ImageSourcePropType } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { buildMediaUrl } from "@/lib/mediaUrl";

// ── Storage keys ───────────────────────────────────────────────────────────────

const STORAGE_KEY  = "@luckytrip/saved_v1";
const PREMIUM_KEY  = "@luckytrip/lucky_premium_v2";

// ── Paywall types ─────────────────────────────────────────────────────────────

export type PaywallType = "discovery" | "lucky" | "depth";

// ── SavedItem ─────────────────────────────────────────────────────────────────

export type SavedCategory = "oQueFazer" | "restaurante" | "hotel" | "lucky" | "atividade" | "praia" | "compras" | "dica_secreta" | "bar" | "cafe";

/**
 * Valid Supabase table names for internal entities.
 * Used as the authoritative routing key — must match the actual DB table.
 */
export type SourceTable =
  | "lugares"
  | "restaurantes"
  | "stay_hotels"
  | "o_que_fazer_rio"
  | "lucky_list_rio";

/** Maps UI category to the Supabase source table. */
export function sourceTableFromCategoria(categoria: SavedCategory): SourceTable {
  switch (categoria) {
    case "restaurante":
    case "bar":
    case "cafe":
      return "lugares";
    case "hotel":
      return "lugares";
    case "oQueFazer":
    case "atividade":
    case "praia":
    case "compras":
    case "dica_secreta":
      return "lugares";
    case "lucky":
      return "lugares";
  }
}

/** Maps Supabase source table back to UI category. */
export function categoriaFromSourceTable(table: SourceTable): SavedCategory {
  switch (table) {
    case "lugares":         return "oQueFazer"; // Default for universal lugares table
    case "restaurantes":    return "restaurante";
    case "stay_hotels":     return "hotel";
    case "o_que_fazer_rio": return "oQueFazer";
    case "lucky_list_rio":  return "lucky";
  }
}

export interface SavedItem {
  id: string;
  categoria: SavedCategory;
  /**
   * Explicit Supabase table this item belongs to.
   * Always set for items created from DB rows — used as the primary routing key.
   * Optional for backward compatibility with items persisted before this field existed.
   */
  source_table?: SourceTable;
  titulo: string;
  /** bairro — e.g. "Ipanema", "Leblon", "Santa Teresa" */
  localizacao: string;
  image: ImageSourcePropType;
  /** True when the item was added manually via external search (Google Places) */
  isExternal?: boolean;
  /** Google Places ID — only set for external items */
  placeId?: string;
  /** Geographic coordinates — only set for external items */
  lat?: number;
  lng?: number;
  /** Full formatted address from Google Places */
  address?: string;
  // ── Step F enrichment fields — set by the itinerary engine, absent on bare SavedItems ──
  /** Google Places or Supabase photo URL from engine enrichment */
  photo_url?: string | null;
  /** Editorial note (meu_olhar) from the DB, set by engine Step F */
  descricao?: string | null;
  /** Average visit duration from DB (e.g. "45min", "1-2h", "3h+") */
  duracao?: string;
}

// ── Viagem entity ─────────────────────────────────────────────────────────────

export interface Viagem {
  id: string;
  nome: string;
  destino: string;
  created_at: string;
}

// Auto-created default viagem (one per device, persists across sessions)
export const DEFAULT_VIAGEM: Viagem = {
  id: "default",
  nome: "Minha Viagem",
  destino: "Rio de Janeiro",
  created_at: new Date().toISOString(),
};

// ── ViagemItem relation ────────────────────────────────────────────────────────

export interface ViagemItem {
  viagem_id: string;
  item_id: string;
  /** "restaurante" | "hotel" | "atividade" */
  tipo: string;
  bairro: string;
}

// ── Helper: derive tipo from categoria ────────────────────────────────────────

export function tipoFromCategoria(
  categoria: SavedCategory,
): "restaurante" | "hotel" | "atividade" {
  if (categoria === "restaurante") return "restaurante";
  if (categoria === "hotel")       return "hotel";
  return "atividade"; // oQueFazer + lucky → atividade
}

// ── Supabase sync helpers (module-level, no hooks) ────────────────────────────

/**
 * Canonical composite key for a saved item — mirrors the server unique constraint
 * (user_id, place_id, source_table). Use this wherever item identity matters
 * to avoid false matches when the same place_id appears in two different source tables.
 */
function savedItemKey(id: string, source_table: SourceTable | undefined, categoria: SavedCategory): string {
  return `${id}::${source_table ?? sourceTableFromCategoria(categoria)}`;
}

/**
 * Extracts a portable URI string from a SavedItem's image field.
 * Returns null for local require() module IDs (numbers) — those are not portable.
 */
function extractImageUrl(image: ImageSourcePropType): string | null {
  if (
    image !== null &&
    image !== undefined &&
    typeof image === "object" &&
    !Array.isArray(image) &&
    "uri" in (image as object)
  ) {
    const uri = (image as { uri?: string }).uri;
    return uri && uri.length > 0 ? uri : null;
  }
  return null;
}

/**
 * Upserts a saved item to user_saved_places for the authenticated user.
 * Fire-and-forget — errors are logged but never surfaced to the user.
 */
function syncSaveToServer(userId: string, item: SavedItem): void {
  if (!item.id) {
    console.error("[GuiaContext] syncSave BLOCKED: item.id is missing", { titulo: item.titulo });
    return;
  }
  supabase
    .from("user_saved_places")
    .upsert(
      {
        user_id:      userId,
        place_id:     item.id,
        source_table: item.source_table ?? sourceTableFromCategoria(item.categoria),
        categoria:    item.categoria,
        titulo:       item.titulo,
        localizacao:  item.localizacao,
        image_url:    extractImageUrl(item.image),
      },
      { onConflict: "user_id,place_id,source_table" }
    )
    .then(({ error }) => {
      if (error) console.warn("[GuiaContext] syncSave error:", error.message);
    });
}

/**
 * Deletes a saved item from user_saved_places.
 * Requires source_table so the delete matches the unique key (user_id, place_id, source_table)
 * and never over-deletes when two items share the same place_id from different tables.
 * Fire-and-forget — errors are logged but never surfaced to the user.
 */
function syncUnsaveFromServer(userId: string, itemId: string, sourceTable: SourceTable): void {
  supabase
    .from("user_saved_places")
    .delete()
    .eq("user_id", userId)
    .eq("place_id", itemId)
    .eq("source_table", sourceTable)
    .then(({ error }) => {
      if (error) console.warn("[GuiaContext] syncUnsave error:", error.message);
    });
}

// ── Context type ──────────────────────────────────────────────────────────────

interface GuiaContextType {
  saved: SavedItem[];
  /**
   * Save a place.
   * - Unauthenticated user → shows auth prompt, returns false.
   * - Authenticated user → saves instantly (local) and syncs to Supabase in background.
   */
  save: (item: SavedItem) => boolean;
  unsave: (id: string) => void;
  isSaved: (id: string) => boolean;
  /** The active trip entity */
  viagem: Viagem;
  /** Derived: one ViagemItem per saved place */
  viagemItens: ViagemItem[];
  /** Premium status (authoritative from Supabase app_metadata — admin-only write via webhook) */
  isPremium: boolean;
  /** Authenticated Supabase user (null if not logged in) */
  user: User | null;
  /** Mark user as premium locally (called after successful purchase verification) */
  markPremium: () => Promise<void>;
  /** Global auth prompt state — shown when an unauthenticated user attempts a gated action */
  authPromptVisible: boolean;
  showAuthPrompt: () => void;
  hideAuthPrompt: () => void;
  /** Global paywall modal state */
  paywallVisible: boolean;
  paywallType: PaywallType;
  showPaywall: (type: PaywallType) => void;
  hidePaywall: () => void;
}

const GuiaContext = createContext<GuiaContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function GuiaProvider({ children }: { children: React.ReactNode }) {
  const [saved,             setSaved]             = useState<SavedItem[]>([]);
  const [hydrated,          setHydrated]          = useState(false);
  const [isPremium,         setIsPremium]         = useState(false);
  const [user,              setUser]              = useState<User | null>(null);
  const [authPromptVisible, setAuthPromptVisible] = useState(false);
  const [paywallVisible,    setPaywallVisible]    = useState(false);
  const [paywallType,       setPaywallType]       = useState<PaywallType>("depth");

  // Ref so async callbacks can read the current saved list without stale closures
  const savedRef = useRef<SavedItem[]>([]);
  useEffect(() => { savedRef.current = saved; }, [saved]);

  // ── Load saved places from AsyncStorage on mount ───────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as SavedItem[];
            setSaved(parsed);
          } catch {
            // Corrupt data — start fresh
          }
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  // ── Track Supabase Auth session ────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[logout] onAuthStateChange event:", event, "session user:", session?.user?.id ?? "null");
      if (event === "SIGNED_OUT") {
        setUser(null);
        // Clear local cache on sign-out so a different user logging in on the same
        // device cannot inadvertently inherit and upload the previous user's saves.
        setSaved([]);
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      } else {
        setUser(session?.user ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Shared premium-check helper ────────────────────────────────────────────
  // Called on: user change, app foreground, and manual refresh after purchase.
  // Reads fresh app_metadata from Supabase Auth (admin-only write — tamper-proof).
  const checkPremiumStatus = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setIsPremium(false);
      await AsyncStorage.removeItem(PREMIUM_KEY);
      return;
    }
    try {
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      const metadata  = freshUser?.app_metadata as Record<string, any> | undefined;
      const validPlan = metadata?.plan_type === "premium" || metadata?.plan_type === "vip";
      // null access_until = lifetime / no expiry — treat as valid; only deny when explicitly expired
      const notExpired = !metadata?.access_until
        || new Date(metadata.access_until) > new Date();

      if (validPlan && notExpired) {
        setIsPremium(true);
        await AsyncStorage.setItem(PREMIUM_KEY, "true");
      } else {
        setIsPremium(false);
        await AsyncStorage.removeItem(PREMIUM_KEY);
      }
    } catch {
      // Network error — keep existing in-memory value
    }
  }, []);

  // ── Load premium status on user change ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Fast-path: show cached value instantly while the network check runs
      const premiumStr = await AsyncStorage.getItem(PREMIUM_KEY);
      if (premiumStr === "true") setIsPremium(true);

      await checkPremiumStatus(user);
    })();
  }, [user, checkPremiumStatus]);

  // ── Re-check premium when app returns to foreground ────────────────────────
  // Handles the case where the user completed the Stripe checkout in an external
  // browser and returns to the app. The fresh getUser() call picks up any
  // app_metadata written by verify-session or the webhook during that time.
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState: AppStateStatus) => {
      if (appStateRef.current !== "active" && nextState === "active") {
        await checkPremiumStatus(user);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [user, checkPremiumStatus]);

  // ── Persist to AsyncStorage whenever saved changes ─────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved, hydrated]);

  // ── Merge server saves with local state after login ────────────────────────
  // Fires once both local hydration and user auth are ready.
  // Strategy: union — items present in either source are kept.
  // Items only on server → added to local state.
  // Items only locally → uploaded to server in background.
  useEffect(() => {
    if (!hydrated || !user) return;

    const currentUser = user;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_saved_places")
          .select("place_id, source_table, categoria, titulo, localizacao, image_url")
          .eq("user_id", currentUser.id);

        if (error) {
          console.warn("[GuiaContext] mergeServerSaves fetch error:", error.message);
          return;
        }

        const serverRows = data ?? [];
        const localItems = savedRef.current;

        // Composite key matches the table's unique constraint (user_id, place_id, source_table).
        // Using place_id alone would incorrectly collapse distinct saves from different source tables.
        const serverKeys = new Set(
          serverRows.map((r) => `${r.place_id}::${r.source_table}`)
        );
        const localKeys = new Set(
          localItems.map((s) =>
            `${s.id}::${s.source_table ?? sourceTableFromCategoria(s.categoria)}`
          )
        );

        // Items on server but not locally — add to local state
        const toAdd: SavedItem[] = serverRows
          .filter((row) => !localKeys.has(`${row.place_id}::${row.source_table}`))
          .map((row) => ({
            id:           row.place_id as string,
            categoria:    row.categoria as SavedCategory,
            source_table: row.source_table as SourceTable,
            titulo:       (row.titulo as string | null) ?? "",
            localizacao:  (row.localizacao as string | null) ?? "",
            image:        (row.image_url as string | null)
                            ? { uri: buildMediaUrl(row.image_url as string) }
                            : { uri: "" },
          }));

        if (toAdd.length > 0) {
          setSaved((prev) => {
            const existingKeys = new Set(
              prev.map((s) =>
                `${s.id}::${s.source_table ?? sourceTableFromCategoria(s.categoria)}`
              )
            );
            const newItems = toAdd.filter(
              (i) => !existingKeys.has(`${i.id}::${i.source_table}`)
            );
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        }

        // Items local but not on server — upload in background
        localItems
          .filter((item) =>
            !serverKeys.has(
              `${item.id}::${item.source_table ?? sourceTableFromCategoria(item.categoria)}`
            )
          )
          .forEach((item) => syncSaveToServer(currentUser.id, item));

      } catch {
        // Network error — local state unchanged
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user]);

  // ── Save / unsave ──────────────────────────────────────────────────────────
  //
  // Identity model: an item is uniquely identified by (id, source_table) — the same
  // place_id can validly appear in different source tables (e.g. a restaurant that is
  // also a lucky pick). All checks and server operations use savedItemKey() composite.

  const save = useCallback((item: SavedItem): boolean => {
    const key = savedItemKey(item.id, item.source_table, item.categoria);
    if (savedRef.current.some((s) => savedItemKey(s.id, s.source_table, s.categoria) === key)) return true;

    // Auth gate: unauthenticated users see login prompt
    if (!user) {
      setAuthPromptVisible(true);
      return false;
    }

    setSaved((prev) => {
      if (prev.some((s) => savedItemKey(s.id, s.source_table, s.categoria) === key)) return prev;
      return [...prev, item];
    });

    // Background sync to Supabase (fire-and-forget)
    syncSaveToServer(user.id, item);

    return true;
  }, [user]);

  const unsave = useCallback((id: string) => {
    // Delete ALL server rows that map to this place_id — mirrors the local filter
    // which removes every item with s.id === id regardless of source_table.
    // This keeps local and server state in sync even when the same place_id exists
    // across multiple source tables.
    if (user) {
      saved
        .filter((s) => s.id === id)
        .forEach((s) => {
          syncUnsaveFromServer(
            user.id,
            id,
            s.source_table ?? sourceTableFromCategoria(s.categoria),
          );
        });
    }
    setSaved((prev) => prev.filter((s) => s.id !== id));
  }, [saved, user]);

  const isSaved = useCallback(
    (id: string) => saved.some((s) => s.id === id),
    [saved],
  );

  // ── Mark premium (local cache — webhook is the authoritative source) ────────

  const markPremium = useCallback(async () => {
    setIsPremium(true);
    await AsyncStorage.setItem(PREMIUM_KEY, "true");
  }, []);

  // ── Auth prompt controls ────────────────────────────────────────────────────

  const showAuthPrompt = useCallback(() => setAuthPromptVisible(true),  []);
  const hideAuthPrompt = useCallback(() => setAuthPromptVisible(false), []);

  // ── Paywall controls ───────────────────────────────────────────────────────

  const showPaywall = useCallback((type: PaywallType) => {
    setPaywallType(type);
    setPaywallVisible(true);
  }, []);

  const hidePaywall = useCallback(() => {
    setPaywallVisible(false);
  }, []);

  // ── Derive ViagemItem list ─────────────────────────────────────────────────
  const viagemItens: ViagemItem[] = saved.map((item) => ({
    viagem_id: DEFAULT_VIAGEM.id,
    item_id:   item.id,
    tipo:      tipoFromCategoria(item.categoria),
    bairro:    item.localizacao,
  }));

  return (
    <GuiaContext.Provider
      value={{
        saved,
        save,
        unsave,
        isSaved,
        viagem: DEFAULT_VIAGEM,
        viagemItens,
        isPremium,
        user,
        markPremium,
        authPromptVisible,
        showAuthPrompt,
        hideAuthPrompt,
        paywallVisible,
        paywallType,
        showPaywall,
        hidePaywall,
      }}
    >
      {children}
    </GuiaContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGuia() {
  const ctx = useContext(GuiaContext);
  if (!ctx) throw new Error("useGuia must be used inside GuiaProvider");
  return ctx;
}
