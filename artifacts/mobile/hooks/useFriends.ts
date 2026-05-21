import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { buildMediaUrl } from "@/lib/mediaUrl";

export interface Amigo {
  id: string;
  slug: string;
  nome: string;
  bio_curta: string | null;
  foto_url: string | null;
  instagram: string | null;
  lucklist_count: number;
}

export function useAmigos() {
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Busca amigos da tabela real "amigos"
        const { data: amigosData, error: amigosErr } = await supabase
          .from("amigos")
          .select("id, slug, nome, bio_curta, foto_url, instagram")
          .eq("ativo", true)
          .order("ordem");

        if (amigosErr) throw amigosErr;

        // Conta lucklists por autor
        const { data: lucklistsData, error: lucklistsErr } = await supabase
          .from("lucklists")
          .select("autor_id")
          .eq("ativo", true);

        if (lucklistsErr) throw lucklistsErr;

        const countMap: Record<string, number> = {};
        for (const l of lucklistsData ?? []) {
          if (l.autor_id) {
            countMap[l.autor_id] = (countMap[l.autor_id] ?? 0) + 1;
          }
        }

        const merged: Amigo[] = (amigosData ?? []).map((a) => ({
          id: a.id,
          slug: a.slug,
          nome: a.nome,
          bio_curta: a.bio_curta,
          foto_url: buildMediaUrl(a.foto_url),
          instagram: a.instagram,
          lucklist_count: countMap[a.id] ?? 0,
        }));

        if (!cancelled) setAmigos(merged);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Erro ao carregar amigos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { amigos, loading, error };
}

// Alias para compatibilidade com código antigo
export const useFriends = useAmigos;
