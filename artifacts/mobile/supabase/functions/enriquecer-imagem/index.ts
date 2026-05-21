// supabase/functions/enriquecer-imagem/index.ts
// Edge Function para buscar foto do Google Places e salvar no Storage
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { lugar_id, google_place_id, nome, destino } = await req.json();

    if (!lugar_id) {
      return new Response(
        JSON.stringify({ error: "lugar_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // 1. Buscar place_id se não tiver
    let placeId = google_place_id;
    if (!placeId && nome) {
      const searchQuery = encodeURIComponent(`${nome} ${destino || "Rio de Janeiro"}`);
      const searchRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${searchQuery}&inputtype=textquery&fields=place_id&key=${googleMapsKey}`
      );
      const searchData = await searchRes.json();
      placeId = searchData.candidates?.[0]?.place_id;
    }

    if (!placeId) {
      return new Response(
        JSON.stringify({ error: "place_id não encontrado no Google Places" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Buscar detalhes do lugar (fotos)
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${googleMapsKey}`
    );
    const details = await detailsRes.json();
    const photoRef = details.result?.photos?.[0]?.photo_reference;

    if (!photoRef) {
      return new Response(
        JSON.stringify({ error: "Nenhuma foto encontrada para este lugar" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Baixar a foto do Google Places
    const photoRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${photoRef}&key=${googleMapsKey}`
    );

    if (!photoRes.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao baixar foto do Google Places" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const photoBlob = await photoRes.blob();
    const photoArray = new Uint8Array(await photoBlob.arrayBuffer());

    // 4. Definir o path no storage
    const destinoSlug = destino?.toLowerCase().replace(/\s+/g, "-") || "rio-de-janeiro";
    const path = `${destinoSlug}/entidades/${lugar_id}/google_main.jpg`;

    // 5. Fazer upload para o storage
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(path, photoArray, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Erro no upload:", uploadError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar foto no storage", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Gerar URL pública
    const cacheUrl = `${supabaseUrl}/storage/v1/object/public/media/${path}`;

    // 7. Atualizar o lugar com a URL em cache e place_id
    const { error: updateError } = await supabase
      .from("lugares")
      .update({
        google_place_id: placeId,
        foto_cache_url: cacheUrl,
        google_photo_cached: true,
      })
      .eq("id", lugar_id);

    if (updateError) {
      console.error("Erro ao atualizar lugar:", updateError);
      // Não falhar completamente, a foto já foi salva
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: cacheUrl,
        place_id: placeId,
      }),
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
