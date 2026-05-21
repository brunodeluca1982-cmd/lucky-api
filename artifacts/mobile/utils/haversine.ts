/**
 * haversine.ts — Walking-distance estimate between two geo-coordinates.
 * Falls back to Rio neighborhood centroids when exact coords aren't available.
 */

export interface GeoPoint { lat: number; lng: number }

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R  = 6371;
  const dL = ((b.lat - a.lat) * Math.PI) / 180;
  const dG = ((b.lng - a.lng) * Math.PI) / 180;
  const s  =
    Math.sin(dL / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Walking speed 5 km/h → minutes per km = 12
export function walkMinutes(km: number): number {
  return Math.round(km * 12);
}

// Rio de Janeiro neighborhood centroids (approximate)
const BAIRRO_COORDS: Record<string, GeoPoint> = {
  // Zona Sul
  ipanema:          { lat: -22.9838, lng: -43.1971 },
  leblon:           { lat: -22.9858, lng: -43.2230 },
  copacabana:       { lat: -22.9680, lng: -43.1820 },
  "barra da tijuca":{ lat: -23.0096, lng: -43.3344 },
  barra:            { lat: -23.0096, lng: -43.3344 },
  "botafogo":       { lat: -22.9494, lng: -43.1862 },
  flamengo:         { lat: -22.9300, lng: -43.1768 },
  "urca":           { lat: -22.9493, lng: -43.1620 },
  catete:           { lat: -22.9280, lng: -43.1800 },
  glória:           { lat: -22.9200, lng: -43.1748 },
  // Centro
  centro:           { lat: -22.9068, lng: -43.1737 },
  lapa:             { lat: -22.9131, lng: -43.1782 },
  "santa teresa":   { lat: -22.9215, lng: -43.1848 },
  // Zona Norte
  tijuca:           { lat: -22.9253, lng: -43.2347 },
  maracanã:         { lat: -22.9121, lng: -43.2302 },
  // Zona Oeste
  "recreio":        { lat: -23.0220, lng: -43.4520 },
  prainha:          { lat: -23.0390, lng: -43.5100 },
  // Praias
  arpoador:         { lat: -22.9913, lng: -43.1933 },
  "grumari":        { lat: -23.0448, lng: -43.5290 },
  "pepê":           { lat: -23.0050, lng: -43.3650 },
  // Other
  "vidigal":        { lat: -22.9943, lng: -43.2330 },
  "rocinha":        { lat: -22.9879, lng: -43.2481 },
};

// Default city center when bairro is unknown
const RIO_CENTER: GeoPoint = { lat: -22.9068, lng: -43.1737 };

export function bairroCoord(bairro: string | null | undefined): GeoPoint {
  if (!bairro) return RIO_CENTER;
  const key = bairro.toLowerCase().trim();
  return BAIRRO_COORDS[key] ?? RIO_CENTER;
}

export function formatTravel(km: number, minutes: number): string {
  const kmStr  = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  const minStr = minutes < 60
    ? `${String(minutes).padStart(2, "0")} min`
    : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
  return `${minStr} · ${kmStr}`;
}
