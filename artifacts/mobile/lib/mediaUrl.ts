/**
 * lib/mediaUrl.ts — Centralized media URL builder
 *
 * All image URLs should pass through this function to ensure
 * they have the correct Supabase storage base URL.
 */

const STORAGE_BASE = "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media";

/**
 * Ensures a path is a complete URL.
 * - If already a full URL (http/https), returns as-is
 * - If empty/null, returns empty string
 * - Otherwise, prepends the Supabase storage base URL
 *
 * @param path - Image path or URL (e.g., "rio-de-janeiro/hero/foto/imagehero01.jpg" or full URL)
 * @returns Complete URL or empty string
 */
export function buildMediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // Remove leading slash if present
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${STORAGE_BASE}/${cleanPath}`;
}

/**
 * Build URL for a destination hero photo
 * @param slug - Destination slug (e.g., "rio-de-janeiro")
 * @param filename - Photo filename (e.g., "imagehero01.jpg")
 */
export function buildDestinoHeroUrl(slug: string, filename: string): string {
  if (!slug || !filename) return "";
  return `${STORAGE_BASE}/${slug}/hero/foto/${filename}`;
}

/**
 * Build URL for a place photo
 * @param destinoSlug - Destination slug
 * @param placeSlug - Place slug
 * @param filename - Photo filename
 */
export function buildPlacePhotoUrl(destinoSlug: string, placeSlug: string, filename: string): string {
  if (!destinoSlug || !filename) return "";
  return `${STORAGE_BASE}/${destinoSlug}/lugares/${placeSlug}/${filename}`;
}

/**
 * Build URL for a friend/amigo photo
 * @param friendSlug - Friend slug (e.g., "carolina-dieckmmann")
 * @param filename - Photo filename (e.g., "carolina1.jpg")
 */
export function buildFriendPhotoUrl(friendSlug: string, filename: string): string {
  if (!friendSlug || !filename) return "";
  return `${STORAGE_BASE}/amigos/${friendSlug}/hero/foto/${filename}`;
}

/**
 * Resolve an image value that might be a filename, path, or full URL
 * Returns a complete URL or null if invalid
 */
export function resolveImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const url = buildMediaUrl(value);
  return url || null;
}

export { STORAGE_BASE };
