import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getImageForEntity } from "@/utils/getImageForEntity";
import { buildMediaUrl } from "@/lib/mediaUrl";

export interface Destino {
  id: string;
  cidade: string;
  pais: string;
  descricao: string;
  image: any;
  lancado: boolean;
}

const SLUG_IMAGE: Record<string, any> = {
  "rio":       require("../assets/images/hero-rio.png"),
  "santorini": require("../assets/images/hero-santorini.png"),
  "kyoto":     require("../assets/images/hero-kyoto.png"),
};

function destinoImage(slug: string, nome: string): any {
  return SLUG_IMAGE[slug] ?? getImageForEntity("city", nome);
}

// Local fallback destinations - IDs must match Supabase slugs exactly
// These are only used if Supabase query fails
const LOCAL_DESTINOS: Destino[] = [
  {
    id: "rio-de-janeiro",
    cidade: "Rio de Janeiro",
    pais: "Brasil",
    descricao: "A cidade maravilhosa — praias douradas, florestas urbanas e o carnaval mais famoso do mundo.",
    image: { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg" },
    lancado: true,
  },
  {
    id: "miami",
    cidade: "Miami",
    pais: "Estados Unidos",
    descricao: "Arte, design, sol e a energia única de South Beach.",
    image: { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/miami/hero/foto/imagehero14.jpg" },
    lancado: false,
  },
  {
    id: "nova-york",
    cidade: "Nova York",
    pais: "Estados Unidos",
    descricao: "A cidade que nunca dorme — jazz, arte e a energia de Manhattan.",
    image: { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/nova-iorque/hero/foto/New_York_City_Street_original_367138.jpg" },
    lancado: false,
  },
  {
    id: "sao-paulo",
    cidade: "São Paulo",
    pais: "Brasil",
    descricao: "A maior metrópole da América do Sul — gastronomia, arte e vida noturna sem fim.",
    image: { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/sao-paulo/hero/foto/imagehero26.jpg" },
    lancado: false,
  },
  {
    id: "ibiza",
    cidade: "Ibiza",
    pais: "Espanha",
    descricao: "Calas escondidas, pôr-do-sol em Es Vedrà e a melhor música eletrônica do mundo.",
    image: { uri: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/ibiza/hero/foto/Cala_Bassa_Beach__Ibizas_Turquoise_Sea_In_The_Balearic_Islands_Of_Spain_original_2950762.jpg" },
    lancado: false,
  },
];

const STATIC_RIO_FALLBACK: Destino[] = LOCAL_DESTINOS;

export function useDestinos() {
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data, error: err } = await supabase
          .from("destinos")
          .select("id, nome, slug, descricao_curta, hero_image_url, status, pais:paises!pais_id(nome)")
          .not("slug", "is", null)
          .order("ordem")
          .order("nome");

        if (err) throw err;

        const dbRows: Destino[] = (data ?? []).map((row: any) => {
          // Use hero_image_url from Supabase if present
          const rawUrl = row.hero_image_url || null;
          const remoteUrl = buildMediaUrl(rawUrl);

          return {
            id:        row.slug as string,
            cidade:    row.nome,
            pais:      row.pais?.nome ?? "",
            descricao: row.descricao_curta ?? "",
            image:     remoteUrl
              ? { uri: remoteUrl }
              : destinoImage(row.slug as string, row.nome),
            lancado:   row.status === "ativo",
          };
        });

        // Merge DB data with local fallback — DB takes precedence
        const dbIds = new Set(dbRows.map(d => d.id));
        const localNotInDb = LOCAL_DESTINOS.filter(d => !dbIds.has(d.id));
        const merged = [...dbRows, ...localNotInDb];

        // DB ordem is already respected from the query - only sort local fallbacks to end
        // Local fallbacks (not in DB) go after DB items, sorted alphabetically
        const dbSet = new Set(dbRows.map(d => d.id));
        merged.sort((a, b) => {
          const aInDb = dbSet.has(a.id);
          const bInDb = dbSet.has(b.id);
          if (aInDb && !bInDb) return -1;
          if (!aInDb && bInDb) return 1;
          if (!aInDb && !bInDb) return a.cidade.localeCompare(b.cidade);
          // Both in DB - preserve original order from query (ordem column)
          return 0;
        });

        if (!cancelled) setDestinos(merged.length > 0 ? merged : STATIC_RIO_FALLBACK);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? "Erro ao carregar destinos");
          setDestinos(STATIC_RIO_FALLBACK);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { destinos, loading, error };
}
