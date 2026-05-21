// hooks/usePlacePhoto.ts
//
// NOTA: Chamadas diretas à API do Google Maps foram DESABILITADAS
// devido a erros de CORS no app mobile. As fotos devem vir do bucket
// Supabase ou de uma Edge Function (places-api) que faz o proxy.
//
// Para reativar, implementar Edge Function e chamar via supabase.functions.invoke()

import { supabase } from '@/lib/supabase';

// Hook principal — retorna apenas fotos já em cache (Supabase bucket)
// Não faz mais chamadas diretas ao Google Maps API
export async function resolvePlacePhoto(lugar: {
  id: string;
  nome: string;
  hero_image_url?: string | null;
  place_id?: string | null;
  google_maps_url?: string | null;
}): Promise<string | null> {
  // Retorna foto do Supabase se existir
  if (lugar.hero_image_url) {
    return lugar.hero_image_url;
  }

  // Google Maps API desabilitado — CORS não funciona no mobile
  // TODO: Implementar via Edge Function places-api
  // console.log('[resolvePlacePhoto] Sem foto para:', lugar.nome);

  return null;
}
