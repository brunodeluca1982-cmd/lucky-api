// scripts/sync-destino-images.js

const destinos = [
  { slug: "rio", place_id: "ChIJW6AIkVXemwARTtIvZ2xC3FA" },
  { slug: "miami", place_id: "ChIJEcHIDqKw2YgRZU-t3XHylv8" },
  { slug: "paris", place_id: "ChIJD7fiBh9u5kcRYJSMaMOCCwQ" },
  { slug: "nova-york", place_id: "ChIJOwg_06VPwokRYv534QaPC8g" },
  { slug: "dubai", place_id: "ChIJRcbZaklDXz4RYlEphFBu5r0" },
  { slug: "sydney", place_id: "ChIJP3Sa8ziYEmsRUKgyFmh9AQM" }
];

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  for (const d of destinos) {
    try {
      console.log(`🔍 ${d.slug}...`);

      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${d.place_id}&fields=photos&key=${GOOGLE_API_KEY}`;

      const res = await fetch(url);
      const text = await res.text();

      console.log(`📦 RAW RESPONSE:`, text.slice(0, 200));

      const json = JSON.parse(text);

      if (!json.result || !json.result.photos) {
        console.log(`❌ sem campo photos`);
        continue;
      }

      const photoRef = json.result.photos[0].photo_reference;

      if (!photoRef) {
        console.log(`⚠️ sem photo_reference`);
        continue;
      }

      const imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${photoRef}&key=${GOOGLE_API_KEY}`;

      await fetch(
        `${SUPABASE_URL}/rest/v1/media_assets?entity_slug=eq.${d.slug}&role=eq.hero`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ url: imageUrl })
        }
      );

      console.log(`✅ atualizado: ${d.slug}`);

    } catch (err) {
      console.error(`❌ erro em ${d.slug}`, err);
    }
  }

  console.log("🚀 FINALIZADO");
}

run();