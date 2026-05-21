import { useEffect, useState } from "react";
import { supabase, type Neighborhood } from "@/lib/supabase";

type State = {
  neighborhoods: Neighborhood[];
  loading: boolean;
  error: string | null;
};

export function useNeighborhoods(): State {
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from("v_stay_neighborhoods_with_hotels")
        .select("*")
        .eq("active", true)
        .order("display_order");

      if (cancelled) return;

      if (err) {
        setError(err.message);
      } else {
        setNeighborhoods((data as Neighborhood[]) ?? []);
      }
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { neighborhoods, loading, error };
}
