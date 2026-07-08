import { extractYouTubeId, youtubeThumbnailUrl } from "@/lib/youtube-id";
import type { EditorialPick } from "@/lib/editorial-picks-data";

type SpotifyOEmbed = {
  thumbnail_url?: string;
  title?: string;
};

export function spotifyEmbedUrl(url: string): string | null {
  const m = url.match(/open\.spotify\.com\/(track|playlist|album|episode)\/([a-zA-Z0-9]+)/);
  if (!m) return null;
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=chartfm`;
}

async function fetchSpotifyThumbnail(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
      { next: { revalidate: 60 * 60 * 24 * 7 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as SpotifyOEmbed;
    return data.thumbnail_url ?? null;
  } catch {
    return null;
  }
}

export async function resolveEditorialPreviewImage(pick: EditorialPick): Promise<string | null> {
  if (pick.previewImage) return pick.previewImage;

  if (pick.youtubeUrl) {
    const id = extractYouTubeId(pick.youtubeUrl);
    if (id) return youtubeThumbnailUrl(id);
  }

  if (pick.spotifyUrl) {
    return fetchSpotifyThumbnail(pick.spotifyUrl);
  }

  return null;
}

export async function resolveEditorialPreviewImages(
  picks: EditorialPick[],
): Promise<Map<string, string | null>> {
  const entries = await Promise.all(
    picks.map(async (pick) => [pick.slug, await resolveEditorialPreviewImage(pick)] as const),
  );
  return new Map(entries);
}
