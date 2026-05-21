import { useEffect, useState } from "react";
import { supabase, type Hotel, type Neighborhood } from "@/lib/supabase";

export type HotelWithNeighborhood = Hotel & {
  neighborhood: Omit<Neighborhood, "hotels">;
};

type State = {
  hotel: HotelWithNeighborhood | null;
  loading: boolean;
  error: string | null;
};

export function useHotel(hotelId: string): State {
  const [hotel, setHotel]     = useState<HotelWithNeighborhood | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!hotelId) return;
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from("v_stay_neighborhoods_with_hotels")
        .select("*")
        .eq("active", true);

      if (cancelled) return;

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      // Search all neighborhoods for the hotel
      const neighborhoods = (data as Neighborhood[]) ?? [];
      let found: HotelWithNeighborhood | null = null;

      for (const n of neighborhoods) {
        const h = (n.hotels ?? []).find((h) => h.id === hotelId);
        if (h) {
          const { hotels: _hotels, ...neighborhoodWithoutHotels } = n;
          found = { ...h, neighborhood: neighborhoodWithoutHotels };
          break;
        }
      }

      setHotel(found);
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, [hotelId]);

  return { hotel, loading, error };
}
