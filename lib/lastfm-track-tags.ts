const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

function apiConfigured(): boolean {
  return Boolean(process.env.API_KEY?.trim());
}

async function lastfmJson(method: string, extra: Record<string, string>): Promise<unknown> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY não definido no .env");

  const params = new URLSearchParams({
    method,
    api_key: apiKey,
    format: "json",
    ...extra,
  });

  const res = await fetch(`${BASE_URL}?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Last.fm HTTP ${res.status}`);

  const data = (await res.json()) as { error?: number | string; message?: string };
  if (data.error != null) {
    throw new Error(typeof data.message === "string" ? data.message : `Last.fm erro ${data.error}`);
  }
  return data;
}

function parseTopTags(payload: unknown): string[] {
  const tags = (payload as { toptags?: { tag?: unknown } })?.toptags?.tag;
  if (!tags) return [];
  const arr = Array.isArray(tags) ? tags : [tags];
  const scored: Array<{ name: string; count: number }> = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = String(o.name ?? "").trim().toLowerCase();
    if (!name) continue;
    const count = Number(o.count ?? 0);
    scored.push({ name, count: Number.isFinite(count) ? count : 0 });
  }
  return scored
    .sort((a, b) => b.count - a.count)
    .map((t) => t.name)
    .slice(0, 12);
}

export type LastfmTrackTagsResult = {
  tags: string[];
  mbid: string | null;
};

/** Tags da faixa via track.getTopTags (fallback após MusicBrainz). */
export async function fetchLastfmTrackTags(
  title: string,
  artist: string,
  recordingMbid?: string | null,
): Promise<LastfmTrackTagsResult | null> {
  if (!apiConfigured()) return null;

  const track = title.trim();
  const art = artist.trim();
  if (!track || !art) return null;

  try {
    let payload: unknown;
    const mbid = recordingMbid?.trim();
    if (mbid) {
      try {
        payload = await lastfmJson("track.getTopTags", { mbid });
      } catch {
        payload = await lastfmJson("track.getTopTags", { track, artist: art, autocorrect: "1" });
      }
    } else {
      payload = await lastfmJson("track.getTopTags", { track, artist: art, autocorrect: "1" });
    }

    const tags = parseTopTags(payload);
    if (!tags.length) return null;

    let resolvedMbid: string | null = mbid ?? null;
    if (!resolvedMbid) {
      try {
        const info = (await lastfmJson("track.getInfo", {
          track,
          artist: art,
          autocorrect: "1",
        })) as { track?: { mbid?: string } };
        const m = info.track?.mbid?.trim();
        if (m) resolvedMbid = m;
      } catch {
        // ignora
      }
    }

    return { tags, mbid: resolvedMbid };
  } catch {
    return null;
  }
}
