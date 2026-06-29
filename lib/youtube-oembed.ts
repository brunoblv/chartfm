import { youtubeWatchUrl } from "@/lib/youtube-id";

export async function fetchYouTubeOEmbed(
  videoId: string,
): Promise<{ title: string | null; channel: string | null }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeWatchUrl(videoId))}&format=json`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return { title: null, channel: null };
    const data = (await res.json()) as { title?: string; author_name?: string };
    return {
      title: data.title?.trim() || null,
      channel: data.author_name?.trim() || null,
    };
  } catch {
    return { title: null, channel: null };
  }
}
