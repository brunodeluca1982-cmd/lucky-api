import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});

// React Native / Expo: tell Supabase when the app is foregrounded/backgrounded
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

// ── Shared types ──────────────────────────────────────────────────────────────

export type Hotel = {
  id: string;
  hotel_name: string;
  my_view: string;
  how_to_enjoy: string[];
  reserve_url: string;
  rooftop: boolean;
  front_beach: boolean;
  audience: string;
  hotel_category: string;
  safety_solo_woman: string;
  featured_restaurant: string | null;
  instagram: string | null;
  google_maps: string | null;
  google_maps_url: string | null;
  ai_tags: string[];
  display_order: number;
  photo_url: string | null;
  neighborhood_slug: string | null;
};

export type Restaurante = {
  id: number;
  nome: string;
  bairro: string;
  categoria: string;
  especialidade: string | null;
  perfil_publico: string | null;
  meu_olhar: string;
  preco_nivel: number;
  instagram: string | null;
  google_maps_url: string | null;
  photo_url: string | null;
  ativo: boolean;
  ordem_bairro: number;
  /** Resolved image URI — photo_url → place_photos fallback → null */
  resolvedPhotoUri: string | null;
};

export type Neighborhood = {
  id: string;
  neighborhood_name: string;
  neighborhood_slug: string;
  title: string;
  identity_phrase: string;
  image_url?: string | null;
  best_for_1: string;
  best_for_2: string;
  best_for_3: string;
  my_view: string;
  how_to_live: string[];
  category_neighborhood: string;
  better_for: string;
  walkable: string;
  nightlife: string;
  gastronomy: string;
  scenery: string;
  safety_solo_woman: string;
  google_maps: string | null;
  active: boolean;
  display_order: number;
  hotels: Hotel[];
};
