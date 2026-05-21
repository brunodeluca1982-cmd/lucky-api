import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface PlacePrediction {
  place_id:       string;
  description:    string;
  main_text:      string;
  secondary_text: string;
}

export interface PlaceDetails {
  place_id:          string;
  name:              string;
  formatted_address: string;
  lat:               number;
  lng:               number;
  google_maps_url:   string;
  types:             string[];
}

export function usePlaceSearch() {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    debounceTimer.current = setTimeout(async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("search-places", {
          body: { action: "autocomplete", query: query.trim(), language: "pt-BR" },
        });
        if (fnErr) throw fnErr;
        setResults(data?.predictions ?? []);
      } catch {
        setError("Não foi possível buscar lugares. Tente novamente.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  async function fetchDetails(placeId: string): Promise<PlaceDetails | null> {
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("search-places", {
        body: { action: "details", place_id: placeId, language: "pt-BR" },
      });
      if (fnErr || !data || data.error) return null;
      return data as PlaceDetails;
    } catch {
      return null;
    }
  }

  function reset() {
    setQuery("");
    setResults([]);
    setError(null);
    setLoading(false);
  }

  return { query, setQuery, results, loading, error, fetchDetails, reset };
}
