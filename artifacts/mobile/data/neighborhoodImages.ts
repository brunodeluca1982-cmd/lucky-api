/**
 * neighborhoodImages.ts
 *
 * Rule: Supabase photo_url only. No local bundled assets as substitutes for entity photos.
 *
 * Both functions now return null unconditionally.
 * Callers must source images from Supabase or show nothing.
 */

export type NeighborhoodImageSource = { uri: string } | null;

/**
 * @deprecated Always returns null. Use Supabase photo_url directly.
 */
export function getRioNeighborhoodImage(
  _neighborhoodName: string | undefined | null,
): null {
  return null;
}

/**
 * @deprecated Always returns null. Use Supabase photo_url directly.
 */
export function getNeighborhoodImage(
  _neighborhoodName: string,
): null {
  return null;
}
