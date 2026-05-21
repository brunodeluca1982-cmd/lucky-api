// supabase/functions/enriquecer-places/index.ts
// Edge Function para enriquecer lugares com google_place_id e fotos
// Segue Capítulo 42: bucket primeiro, Google Places como fallback, cache permanente

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnrichResult {
  lugar_id: string;
  nome: string;
  status: "success" | "not_found" | "error";
  google_place_id?: string;
  photo_url?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { destino_id, limit = 10, dry_run = false } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleMapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!googleMapsKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_MAPS_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar lugares sem google_place_id
    let query = supabase
      .from("lugares")
      .select("id, nome, slug, endereco, categoria, destino:destinos!destino_id(slug, nome)")
      .is("google_place_id", null)
      .eq("ativo", true)
      .limit(limit);

    if (destino_id) {
      query = query.eq("destino_id", destino_id);
    }

    const { data: lugares, error: fetchError } = await query;

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: "Erro ao buscar lugares", details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lugares || lugares.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum lugar para enriquecer", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: EnrichResult[] = [];

    // 2. Processar cada lugar
    for (const lugar of lugares) {
      const destinoNome = (lugar.destino as any)?.nome || "Rio de Janeiro";
      const destinoSlug = (lugar.destino as any)?.slug || "rio-de-janeiro";

      try {
        // 2a. Buscar no Google Places Text Search
        const searchQuery = encodeURIComponent(`${lugar.nome} ${destinoNome}`);
        const searchRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${searchQuery}&inputtype=textquery&fields=place_id,name,formatted_address,photos&key=${googleMapsKey}`
        );
        const searchData = await searchRes.json();

        if (!searchData.candidates || searchData.candidates.length === 0) {
          results.push({
            lugar_id: lugar.id,
            nome: lugar.nome,
            status: "not_found",
            error: "Nenhum resultado no Google Places"
          });
          continue;
        }

        const candidate = searchData.candidates[0];
        const placeId = candidate.place_id;
        const photoRef = candidate.photos?.[0]?.photo_reference;

        if (dry_run) {
          results.push({
            lugar_id: lugar.id,
            nome: lugar.nome,
            status: "success",
            google_place_id: placeId,
            photo_url: photoRef ? "(foto disponível)" : "(sem foto)"
          });
          continue;
        }

        // 2b. Se tem foto, baixar e salvar no bucket
        let photoUrl: string | null = null;
        const storagePath = `${destinoSlug}/lugares/${lugar.slug}/hero.jpg`;

        if (photoRef) {
          // Baixar foto do Google Places
          const photoRes = await fetch(
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${photoRef}&key=${googleMapsKey}`
          );

          if (photoRes.ok) {
            const photoBlob = await photoRes.blob();
            const photoArray = new Uint8Array(await photoBlob.arrayBuffer());

            const { error: uploadError } = await supabase.storage
              .from("media")
              .upload(storagePath, photoArray, {
                contentType: "image/jpeg",
                upsert: true,
              });

            if (!uploadError) {
              photoUrl = `${supabaseUrl}/storage/v1/object/public/media/${storagePath}`;
            } else {
              console.error(`Upload error for ${lugar.nome}:`, uploadError.message);
            }
          }
        }

        // 2c. Atualizar lugar no banco
        const updateData: Record<string, any> = {
          google_place_id: placeId,
          google_photo_cached: photoUrl !== null,
        };

        if (photoUrl) {
          updateData.hero_image_url = storagePath; // Path relativo
          updateData.foto_cache_url = photoUrl;    // URL completa
        }

        const { error: updateError } = await supabase
          .from("lugares")
          .update(updateData)
          .eq("id", lugar.id);

        if (updateError) {
          results.push({
            lugar_id: lugar.id,
            nome: lugar.nome,
            status: "error",
            error: updateError.message
          });
        } else {
          results.push({
            lugar_id: lugar.id,
            nome: lugar.nome,
            status: "success",
            google_place_id: placeId,
            photo_url: photoUrl || undefined
          });
        }

        // Rate limiting - esperar 200ms entre requests
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (e) {
        results.push({
          lugar_id: lugar.id,
          nome: lugar.nome,
          status: "error",
          error: String(e)
        });
      }
    }

    // 3. Resumo
    const summary = {
      total: results.length,
      success: results.filter(r => r.status === "success").length,
      not_found: results.filter(r => r.status === "not_found").length,
      errors: results.filter(r => r.status === "error").length,
      dry_run,
    };

    return new Response(
      JSON.stringify({ summary, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
