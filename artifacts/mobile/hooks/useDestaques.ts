// hooks/useDestaques.ts — Fetch destaques from Supabase
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { buildMediaUrl } from "@/lib/mediaUrl";

export interface Destaque {
  id: string;
  tipo: string;
  titulo: string;
  subtitulo: string;
  photo_url: string;
  destino_slug: string;
  entity_id: string | null;
  ordem: number;
  // Dados da entidade relacionada (lugar)
  lugar?: {
    nome: string;
    photo_url: string | null;
    tipo: string | null;
    bairro: string | null;
  } | null;
}

// Fallback local para garantir que sempre temos destaques
const FALLBACK_DESTAQUES: Destaque[] = [
  {
    id: "rio",
    tipo: "destino",
    titulo: "Rio de Janeiro",
    subtitulo: "Três dias entre o mar e a montanha",
    photo_url: "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/rio-de-janeiro/hero/foto/imagehero01.jpg",
    destino_slug: "rio-de-janeiro",
    entity_id: null,
    ordem: 1,
    lugar: null,
  },
];

export function useDestaques() {
  const [destaques, setDestaques] = useState<Destaque[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Busca destaques ativos (query simples, sem join)
        const { data, error: err } = await supabase
          .from("destaques")
          .select("id, tipo, titulo, subtitulo, photo_url, destino_slug, entity_id, ordem")
          .eq("ativo", true)
          .order("ordem");

        if (err) throw err;

        // Filter out v2 items (premium-only Lucky List content)
        const filtered = (data ?? []).filter((row: any) => {
          const titulo = row.titulo?.toLowerCase() ?? "";
          return !titulo.includes("v2");
        });

        const rows: Destaque[] = filtered.map((row: any) => ({
          id: row.id,
          tipo: row.tipo,
          titulo: row.titulo,
          subtitulo: row.subtitulo,
          photo_url: buildMediaUrl(row.photo_url) || row.photo_url,
          destino_slug: row.destino_slug,
          entity_id: row.entity_id,
          ordem: row.ordem,
          lugar: null,
        }));

        if (!cancelled) {
          setDestaques(rows.length > 0 ? rows : FALLBACK_DESTAQUES);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? "Erro ao carregar destaques");
          setDestaques(FALLBACK_DESTAQUES);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { destaques, loading, error };
}
