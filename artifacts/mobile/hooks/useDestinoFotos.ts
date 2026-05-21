// hooks/useDestinoFotos.ts — Fetch destination photos from Supabase storage with fallbacks
import { useState, useEffect, useCallback } from "react";

const MEDIA_STORAGE_URL = "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1";
const MEDIA_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrd2x4aW1rYWRtbG5iZ2pjcmRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODE0NDgsImV4cCI6MjA5MjE1NzQ0OH0.PWFvL65vANVtBjlDtSCNnq0Rs7RdEVAKcJSgtL4JqMI";
const BUCKET_NAME = "media";

// Placeholder color for destinations without photos
const PLACEHOLDER_COLOR = "#D4C5A9"; // Sand color

/**
 * Build public URL for a media file
 */
function buildMediaUrl(slug: string, filename: string): string {
  return `${MEDIA_STORAGE_URL}/object/public/media/${slug}/hero/foto/${filename}`;
}

/**
 * Build public URL for a file in any path
 */
function buildPublicUrl(path: string): string {
  return `${MEDIA_STORAGE_URL}/object/public/${BUCKET_NAME}/${path}`;
}

/**
 * List files in a storage folder using Supabase Storage API
 * Returns array of public URLs for image files
 */
async function listStorageFiles(folderPath: string): Promise<string[]> {
  try {
    const response = await fetch(`${MEDIA_STORAGE_URL}/object/list/${BUCKET_NAME}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MEDIA_ANON_KEY}`,
        "apikey": MEDIA_ANON_KEY,
      },
      body: JSON.stringify({
        prefix: folderPath,
        limit: 20,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      }),
    });

    if (!response.ok) {
      console.log(`[listStorageFiles] Failed to list ${folderPath}: ${response.status}`);
      return [];
    }

    const files = await response.json();

    // Filter for image files and build public URLs
    const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    const imageUrls: string[] = [];

    for (const file of files) {
      if (file.name && !file.name.endsWith("/")) {
        const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
        if (imageExtensions.includes(ext)) {
          imageUrls.push(buildPublicUrl(`${folderPath}${file.name}`));
        }
      }
    }

    return imageUrls;
  } catch (e) {
    console.log(`[listStorageFiles] Error listing ${folderPath}:`, e);
    return [];
  }
}

/**
 * Check if a URL is accessible (returns 200)
 */
async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Try to discover photos for a destination by checking common file patterns
 * (Fallback when listing is not available)
 */
async function discoverPhotos(slug: string): Promise<string[]> {
  const photos: string[] = [];
  const patterns = [
    "imagehero01.jpg",
    "imagehero02.jpg",
    "imagehero03.jpg",
    "imagehero04.jpg",
    "imagehero05.jpg",
    "imagehero06.jpg",
    "imagehero07.jpg",
    "imagehero08.jpg",
    "hero01.jpg",
    "hero02.jpg",
    "hero03.jpg",
    "01.jpg",
    "02.jpg",
    "03.jpg",
    "main.jpg",
    "cover.jpg",
  ];

  // Check first pattern to see if any photos exist
  const firstUrl = buildMediaUrl(slug, patterns[0]);
  const firstExists = await checkUrlExists(firstUrl);

  if (!firstExists) {
    // Try alternate patterns
    for (const pattern of patterns.slice(5)) {
      const url = buildMediaUrl(slug, pattern);
      const exists = await checkUrlExists(url);
      if (exists) {
        photos.push(url);
        break;
      }
    }
    return photos;
  }

  // First exists, check more
  photos.push(firstUrl);
  for (let i = 1; i < 5; i++) {
    const url = buildMediaUrl(slug, patterns[i]);
    const exists = await checkUrlExists(url);
    if (exists) {
      photos.push(url);
    } else {
      break;
    }
  }

  return photos;
}

/**
 * Fetch photos for a destination - tries listing first, then discovery fallback
 */
async function fetchDestinoPhotos(slug: string): Promise<string[]> {
  // 1. Try to list files from storage API
  const folderPath = `${slug}/hero/foto/`;
  const listedPhotos = await listStorageFiles(folderPath);

  if (listedPhotos.length > 0) {
    console.log(`[fetchDestinoPhotos] Found ${listedPhotos.length} photos via listing for ${slug}`);
    return listedPhotos;
  }

  // 2. Fallback to pattern discovery
  console.log(`[fetchDestinoPhotos] Listing failed for ${slug}, trying discovery...`);
  return discoverPhotos(slug);
}

/**
 * Cache for discovered photos per slug
 */
const photosCache: Record<string, string[]> = {};

/**
 * Known photos for destinations (pre-populated to avoid network calls)
 */
const KNOWN_PHOTOS: Record<string, string[]> = {
  "rio-de-janeiro": [
    buildMediaUrl("rio-de-janeiro", "imagehero01.jpg"),
    buildMediaUrl("rio-de-janeiro", "imagehero02.jpg"),
    buildMediaUrl("rio-de-janeiro", "imagehero03.jpg"),
    buildMediaUrl("rio-de-janeiro", "imagehero04.jpg"),
    buildMediaUrl("rio-de-janeiro", "imagehero05.jpg"),
  ],
  "nova-iorque": [
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/nova-iorque/hero/foto/New_York_City_Street_original_367138.jpg",
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/nova-iorque/hero/foto/Times_Square_New_York_City_original_1212025.jpg",
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/nova-iorque/hero/foto/The_Statue_Of_Liberty_In_New_York_original_932137.jpg",
  ],
  // Alias: DB uses "nova-york" but storage folder is "nova-iorque"
  "nova-york": [
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/nova-iorque/hero/foto/New_York_City_Street_original_367138.jpg",
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/nova-iorque/hero/foto/Times_Square_New_York_City_original_1212025.jpg",
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/nova-iorque/hero/foto/The_Statue_Of_Liberty_In_New_York_original_932137.jpg",
  ],
  "miami": [
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/miami/hero/foto/imagehero14.jpg",
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/miami/hero/foto/imagehero15.jpg",
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/miami/hero/foto/imagehero18.jpg",
  ],
  "ibiza": [
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/ibiza/hero/foto/Cala_Bassa_Beach__Ibizas_Turquoise_Sea_In_The_Balearic_Islands_Of_Spain_original_2950762.jpg",
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/ibiza/hero/foto/Ibiza_Sunset_View_Of_Es_Vedra_From_Formentera_In_The_Balearic_Islands_Of_Spain_original_2950748.jpg",
  ],
  "santorini": [
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/santorini/hero/foto/Oai_Santorini_View_original_773226.jpg",
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/santorini/hero/foto/Panorama_Of_Oia_Village_In_Santorini_original_1954673.jpg",
  ],
  "sao-paulo": [
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/sao-paulo/hero/foto/imagehero26.jpg",
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/sao-paulo/hero/foto/imagehero27.jpg",
  ],
  "atenas": [
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/atenas/hero/foto/_MG_0169-2.jpeg",
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/atenas/hero/foto/_MG_0175-2.jpeg",
  ],
  "reykjavik": [
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/reykjavik/hero/foto/IMG_7215.jpeg",
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/reykjavik/hero/foto/IMG_7220.jpeg",
  ],
  "paris": [
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/paris/hero/foto/Dense_Traffic_On_The_Champs-Elysees_original_1077419.jpg",
  ],
  "jericoacoara": [
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/jericoacoara/hero/fotos/Jericoacoara_Beach_At_Ceara_Brazil_original_1895481.jpg",
    "https://bkwlximkadmlnbgjcrdp.supabase.co/storage/v1/object/public/media/jericoacoara/hero/fotos/Sunset_At_Jericoacoara_original_1895055.jpg",
  ],
};

/**
 * Fallback photos from Unsplash for destinations without storage photos
 */
const UNSPLASH_FALLBACKS: Record<string, string> = {
  "miami": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1400&q=92",
  "nova-york": "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=1400&q=92",
  "nova-iorque": "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=1400&q=92",
  "new-york": "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=1400&q=92",
  "ibiza": "https://images.unsplash.com/photo-1555696958-c5049b866f6f?w=1400&q=92",
  "paris": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1400&q=92",
  "santorini": "https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=1400&q=92",
  "amsterdam": "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1400&q=92",
  "atenas": "https://images.unsplash.com/photo-1555993539-1732b0258235?w=1400&q=92",
  "athens": "https://images.unsplash.com/photo-1555993539-1732b0258235?w=1400&q=92",
  "jericoacoara": "https://images.unsplash.com/photo-1516815231560-8f41ec531527?w=1400&q=92",
  "islandia": "https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=1400&q=92",
  "iceland": "https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=1400&q=92",
  "reykjavik": "https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=1400&q=92",
  "beirute": "https://images.unsplash.com/photo-1579606032821-4e6161c81571?w=1400&q=92",
  "beirut": "https://images.unsplash.com/photo-1579606032821-4e6161c81571?w=1400&q=92",
  "sao-paulo": "https://images.unsplash.com/photo-1543059080-f9b1272213d5?w=1400&q=92",
  "tokyo": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1400&q=92",
  "toquio": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1400&q=92",
  "kyoto": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1400&q=92",
  "lisboa": "https://images.unsplash.com/photo-1588535231255-06c4de7e84fb?w=1400&q=92",
  "lisbon": "https://images.unsplash.com/photo-1588535231255-06c4de7e84fb?w=1400&q=92",
  "bali": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1400&q=92",
  "marrakech": "https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=1400&q=92",
  "dubai": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1400&q=92",
  "barcelona": "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1400&q=92",
  "london": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1400&q=92",
  "londres": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1400&q=92",
  "rome": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1400&q=92",
  "roma": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1400&q=92",
  "cape-town": "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1400&q=92",
  "buenos-aires": "https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1400&q=92",
  "florianopolis": "https://images.unsplash.com/photo-1516815231560-8f41ec531527?w=1400&q=92",
  "floripa": "https://images.unsplash.com/photo-1516815231560-8f41ec531527?w=1400&q=92",
};

export interface DestinoFotosResult {
  fotos: string[];
  loading: boolean;
  currentFoto: string | null;
  isPlaceholder: boolean;
}

/**
 * Hook to get photos for a destination with fallbacks
 * @param slug - Destination slug (e.g., "rio-de-janeiro", "miami")
 * @param rotationIndex - Current index for photo rotation (optional)
 */
export function useDestinoFotos(slug: string, rotationIndex = 0): DestinoFotosResult {
  const [fotos, setFotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaceholder, setIsPlaceholder] = useState(false);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setIsPlaceholder(true);
      return;
    }

    let cancelled = false;

    async function loadPhotos() {
      setLoading(true);

      // 1. Check cache first
      if (photosCache[slug] && photosCache[slug].length > 0) {
        setFotos(photosCache[slug]);
        setLoading(false);
        setIsPlaceholder(false);
        return;
      }

      // 2. Check known photos
      if (KNOWN_PHOTOS[slug]) {
        photosCache[slug] = KNOWN_PHOTOS[slug];
        if (!cancelled) {
          setFotos(KNOWN_PHOTOS[slug]);
          setLoading(false);
          setIsPlaceholder(false);
        }
        return;
      }

      // 3. Try to fetch photos from storage (listing first, then discovery)
      try {
        const fetched = await fetchDestinoPhotos(slug);
        if (!cancelled && fetched.length > 0) {
          photosCache[slug] = fetched;
          setFotos(fetched);
          setLoading(false);
          setIsPlaceholder(false);
          return;
        }
      } catch (e) {
        console.log(`[useDestinoFotos] Fetch failed for ${slug}:`, e);
      }

      // 4. Try Unsplash fallback
      const unsplashUrl = UNSPLASH_FALLBACKS[slug];
      if (unsplashUrl) {
        photosCache[slug] = [unsplashUrl];
        if (!cancelled) {
          setFotos([unsplashUrl]);
          setLoading(false);
          setIsPlaceholder(false);
        }
        return;
      }

      // 5. No photos found - will use placeholder
      if (!cancelled) {
        setFotos([]);
        setLoading(false);
        setIsPlaceholder(true);
      }
    }

    loadPhotos();
    return () => { cancelled = true; };
  }, [slug]);

  const currentFoto = fotos.length > 0 ? fotos[rotationIndex % fotos.length] : null;

  return { fotos, loading, currentFoto, isPlaceholder };
}

/**
 * Get a single photo for a destination (first available)
 */
export function useDestinoFoto(slug: string): { foto: string | null; loading: boolean; isPlaceholder: boolean } {
  const { currentFoto, loading, isPlaceholder } = useDestinoFotos(slug, 0);
  return { foto: currentFoto, loading, isPlaceholder };
}

/**
 * Preload photos for multiple destinations
 */
export async function preloadDestinoFotos(slugs: string[]): Promise<void> {
  await Promise.all(
    slugs.map(async (slug) => {
      if (photosCache[slug]) return;

      if (KNOWN_PHOTOS[slug]) {
        photosCache[slug] = KNOWN_PHOTOS[slug];
        return;
      }

      try {
        const fetched = await fetchDestinoPhotos(slug);
        if (fetched.length > 0) {
          photosCache[slug] = fetched;
          return;
        }
      } catch {
        // ignore
      }

      const unsplashUrl = UNSPLASH_FALLBACKS[slug];
      if (unsplashUrl) {
        photosCache[slug] = [unsplashUrl];
      }
    })
  );
}

/**
 * Get placeholder style for destinations without photos
 */
export function getPlaceholderStyle(destinoName: string) {
  return {
    backgroundColor: PLACEHOLDER_COLOR,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  };
}
