/**
 * neighborhoodHero.ts
 *
 * Resolves the hero image for a neighborhood page.
 *
 * Rule: Supabase image_url only. Returns null when absent — callers must handle null.
 */

type AnyImageSource = { uri: string } | null;

export function getNeighborhoodHero(
  supabaseImageUrl: string | null | undefined,
): AnyImageSource {
  if (supabaseImageUrl && supabaseImageUrl.trim().length > 0) {
    return { uri: supabaseImageUrl.trim() };
  }
  return null;
}
