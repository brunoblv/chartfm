export function extractYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const direct = raw.match(/^[a-zA-Z0-9_-]{11}$/);
  if (direct) return direct[0];
  const m = raw.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return m?.[1] ?? null;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
