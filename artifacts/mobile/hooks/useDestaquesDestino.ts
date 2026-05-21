/**
 * useDestaquesDestino.ts — Fetch destaques by section for destination home
 *
 * Sections:
 *   - 'essencial': O Essencial do Rio (curated experiences)
 *   - 'agora': Agora no Rio (time-sensitive activities)
 */

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { buildMediaUrl } from "@/lib/mediaUrl";

export interface DestaqueDestino {
  id: string;
  tipo: string;
  titulo: string;
  subtitulo: string | null;
  photo_url: string;
  entity_id: string | null;
  secao: string;
  horario: string | null;
  cor: string | null;
  ordem: number;
  // Dados da entidade (lugar)
  lugar?: {
    id: string;
    nome: string;
    slug: string;
    categoria: string;
    hero_image_url: string | null;
  } | null;
}

type State = {
  essencial: DestaqueDestino[];
  agora: DestaqueDestino[];
  loading: boolean;
  error: string | null;
};

export function useDestaquesDestino(destinoId: string): State {
  const [essencial, setEssencial] = useState<DestaqueDestino[]>([]);
  const [agora, setAgora] = useState<DestaqueDestino[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      try {
        // Fetch destaques with lugar join
        const { data, error: err } = await supabase
          .from("destaques")
          .select(`
            id,
            tipo,
            titulo,
            subtitulo,
            photo_url,
            entity_id,
            secao,
            horario,
            cor,
            ordem,
            lugares:entity_id (
              id,
              nome,
              slug,
              categoria,
              hero_image_url
            )
          `)
          .eq("destino_id", destinoId)
          .in("secao", ["essencial", "agora"])
          .eq("ativo", true)
          .order("ordem");

        if (cancelled) return;

        if (err) {
          setError(err.message);
          setLoading(false);
          return;
        }

        // Filter out v2 items (premium-only Lucky List content)
        const filtered = (data ?? []).filter((row: any) => {
          const titulo = row.titulo?.toLowerCase() ?? "";
          const lugarNome = row.lugares?.nome?.toLowerCase() ?? "";
          return !titulo.includes("v2") && !lugarNome.includes("v2");
        });

        const mapped: DestaqueDestino[] = filtered.map((row: any) => ({
          id: row.id,
          tipo: row.tipo,
          titulo: row.titulo,
          subtitulo: row.subtitulo,
          photo_url: buildMediaUrl(row.photo_url) || row.photo_url,
          entity_id: row.entity_id,
          secao: row.secao,
          horario: row.horario,
          cor: row.cor,
          ordem: row.ordem,
          lugar: row.lugares ? {
            id: row.lugares.id,
            nome: row.lugares.nome,
            slug: row.lugares.slug,
            categoria: row.lugares.categoria,
            hero_image_url: buildMediaUrl(row.lugares.hero_image_url),
          } : null,
        }));

        setEssencial(mapped.filter(d => d.secao === "essencial"));
        setAgora(mapped.filter(d => d.secao === "agora"));
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? "Erro ao carregar destaques");
          setLoading(false);
        }
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [destinoId]);

  return { essencial, agora, loading, error };
}
