/**
 * useLuckyList.ts — Fetches Lucky List from Supabase with lugares and bairros.
 * Premium items (index >= 5) have blocked content (meu_olhar: null, como_aproveitar: []).
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type LuckyListItem = {
  id: string;
  lugar_id: string;
  ordem: number;
  nota_autor?: string;
  acesso: "free" | "premium";
  lugar: {
    id: string;
    nome: string;
    meu_olhar: string | null;
    google_maps_url: string | null;
    instagram: string | null;
    bairro_id: string | null;
    tags_ia: string[];
    como_aproveitar: string[];
    momento_ideal: string[];
    energia: string | null;
    bairro_nome: string | null;
  };
  bloqueado: boolean;
};

export type LuckyList = {
  id: string;
  slug: string;
  titulo: string;
  subtitulo?: string;
  descricao?: string;
  capa_url?: string;
  acesso: "free" | "premium";
  itens: LuckyListItem[];
};

type State = {
  luckyList: LuckyList | null;
  loading: boolean;
  error: string | null;
};

export function useLuckyList(slug: string = "lucky-list-rio-de-janeiro"): State {
  const [luckyList, setLuckyList] = useState<LuckyList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      // 1. Buscar a lucklist
      const { data: listData, error: listError } = await supabase
        .from("lucklists")
        .select("id, slug, titulo, subtitulo, descricao, capa_url, acesso")
        .eq("slug", slug)
        .eq("ativo", true)
        .single();

      if (listError || !listData) {
        if (!cancelled) {
          setError(listError?.message ?? "Lucky List não encontrada");
          setLoading(false);
        }
        return;
      }

      // 2. Buscar os itens com joins
      const { data: itensData, error: itensError } = await supabase
        .from("lucklist_lugares")
        .select(`
          id,
          lugar_id,
          ordem,
          nota_autor,
          lugares (
            id,
            nome,
            meu_olhar,
            google_maps_url,
            instagram,
            bairro_id,
            tags_ia,
            como_aproveitar,
            momento_ideal,
            energia,
            bairros (
              nome
            )
          )
        `)
        .eq("lucklist_id", listData.id)
        .order("ordem");

      if (cancelled) return;

      if (itensError) {
        setError(itensError.message);
        setLoading(false);
        return;
      }

      // 3. Mapear itens, bloqueando conteúdo premium
      const isPremiumList = listData.acesso === "premium";

      const itens: LuckyListItem[] = (itensData ?? []).map((item: any, index: number) => {
        const lugar = item.lugares;
        const bairro = lugar?.bairros;

        // Itens após o 5º são premium se a lista for free (teaser)
        // Ou todos são premium se a lista for premium
        const bloqueado = isPremiumList || index >= 5;

        return {
          id: item.id,
          lugar_id: item.lugar_id,
          ordem: item.ordem,
          nota_autor: bloqueado ? undefined : item.nota_autor,
          acesso: bloqueado ? "premium" : "free",
          lugar: {
            id: lugar?.id ?? "",
            nome: lugar?.nome ?? "",
            meu_olhar: bloqueado ? null : (lugar?.meu_olhar ?? null),
            google_maps_url: bloqueado ? null : (lugar?.google_maps_url ?? null),
            instagram: lugar?.instagram ?? null,
            bairro_id: lugar?.bairro_id ?? null,
            tags_ia: lugar?.tags_ia ?? [],
            como_aproveitar: bloqueado ? [] : (lugar?.como_aproveitar ?? []),
            momento_ideal: bloqueado ? [] : (lugar?.momento_ideal ?? []),
            energia: lugar?.energia ?? null,
            bairro_nome: bairro?.nome ?? null,
          },
          bloqueado,
        };
      });

      setLuckyList({
        id: listData.id,
        slug: listData.slug,
        titulo: listData.titulo,
        subtitulo: listData.subtitulo,
        descricao: listData.descricao,
        capa_url: listData.capa_url,
        acesso: listData.acesso,
        itens,
      });
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, [slug]);

  return { luckyList, loading, error };
}
