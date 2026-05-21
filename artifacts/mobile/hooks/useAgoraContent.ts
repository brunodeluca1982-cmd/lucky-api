/**
 * useAgoraContent — Fetches time-of-day content from Supabase only.
 *
 * STRICT RULE: every item MUST originate from Supabase.
 * Any item not found in Supabase → logged as ERROR and rejected.
 * If Supabase returns 0 items → callers show empty state. NEVER fake content.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { sanitizePhotoUrl } from "@/utils/getImageForEntity";

export type Periodo = "manha" | "tarde" | "noite";

export interface AgoraItem {
  id: string;
  titulo: string;
  localizacao: string;
  tag: string;
  descricao: string;
  image: { uri: string } | null;
  placeId: string;
  source_table: string;
}

export interface DestaqueItem {
  id: string;
  titulo: string;
  localizacao: string;
  tag: string;
  image: { uri: string } | null;
}

type State = {
  byPeriodo: Record<Periodo, AgoraItem[]>;
  destaques: DestaqueItem[];
  loading: boolean;
  error: string | null;
};

const EMPTY_GROUPED: Record<Periodo, AgoraItem[]> = {
  manha: [],
  tarde: [],
  noite: [],
};

export function useAgoraContent(_cityId: string = "rio"): State {
  const [byPeriodo, setByPeriodo] = useState<Record<Periodo, AgoraItem[]>>(EMPTY_GROUPED);
  const [destaques, setDestaques] = useState<DestaqueItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [actResult, restResult] = await Promise.all([
        supabase
          .from("o_que_fazer_rio_v2")
          .select("id, nome, bairro, categoria, descricao, photo_url, momento_ideal")
          .eq("ativo", true),
        supabase
          .from("restaurantes")
          .select("id, nome, bairro, categoria, photo_url")
          .not("photo_url", "is", null)
          .limit(4),
      ]);

      if (cancelled) return;

      if (actResult.error) {
        const msg = actResult.error.message;
        console.error("[useAgoraContent] Supabase error:", msg);
        setError(msg);
        setLoading(false);
        return;
      }

      const rows = actResult.data ?? [];
      const grouped: Record<Periodo, AgoraItem[]> = { manha: [], tarde: [], noite: [] };

      for (const row of rows) {
        const rawPhoto = (row as any).photo_url as string | null;
        const safe = sanitizePhotoUrl(rawPhoto);

        if (rawPhoto && !safe) {
          console.error(
            `[AGORA][INVALID IMAGE SOURCE] Rejected item "${row.nome}" — photo_url blocked: ${rawPhoto}`
          );
        }

        const rawPeriodo = ((row as any).momento_ideal as string | null)
          ?.toLowerCase()
          ?.trim();

        const item: AgoraItem = {
          id:          String(row.id),
          titulo:      (row.nome as string)      || "Experiência",
          localizacao: (row.bairro as string)    || "Rio de Janeiro",
          tag:         (row.categoria as string) || "Experiência",
          descricao:   (row.descricao as string) || "",
          image:       safe ? { uri: safe } : null,
          placeId:     String(row.id),
          source_table: "o_que_fazer_rio_v2",
        };

        if (rawPeriodo === "manha" || rawPeriodo === "tarde" || rawPeriodo === "noite") {
          grouped[rawPeriodo].push(item);
        } else {
          grouped.manha.push({ ...item, id: `${item.id}-m` });
          grouped.tarde.push({ ...item, id: `${item.id}-t` });
          grouped.noite.push({ ...item, id: `${item.id}-n` });
        }
      }

      const destRows = restResult.data ?? [];
      const destItems: DestaqueItem[] = destRows.map((r) => {
        const safe = sanitizePhotoUrl((r as any).photo_url as string | null);
        return {
          id:          String(r.id),
          titulo:      (r.nome as string)      || "Restaurante",
          localizacao: (r.bairro as string)    || "Rio de Janeiro",
          tag:         (r.categoria as string) || "Gastronomia",
          image:       safe ? { uri: safe } : null,
        };
      });

      setByPeriodo(grouped);
      setDestaques(destItems);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { byPeriodo, destaques, loading, error };
}
