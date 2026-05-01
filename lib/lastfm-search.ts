const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

export function lastfmSearchApiConfigured(): boolean {
  return Boolean(process.env.API_KEY?.trim());
}

export type LastfmSearchTrack = {
  title: string;
  artist: string;
  album: string | null;
  imageUrl: string | null;
  url: string | null;
  mbid: string | null;
};

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

function pickLargestLastfmImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const order = ["mega", "extralarge", "large", "medium", "small"];
  for (const size of order) {
    const hit = images.find((im) => {
      if (!im || typeof im !== "object") return false;
      const o = im as Record<string, unknown>;
      return o.size === size && typeof o["#text"] === "string" && o["#text"].trim().length > 0;
    }) as Record<string, unknown> | undefined;
    if (hit?.["#text"]) return String(hit["#text"]).trim();
  }
  for (const im of images) {
    if (!im || typeof im !== "object") continue;
    const t = (im as Record<string, unknown>)["#text"];
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return null;
}

function normalizeSearchMatches(raw: unknown): Array<{ name: string; artist: string; mbid?: string; url?: string }> {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const out: Array<{ name: string; artist: string; mbid?: string; url?: string }> = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const name = String(t.name ?? "").trim();
    let artist = "";
    if (typeof t.artist === "string") artist = t.artist.trim();
    else if (t.artist && typeof t.artist === "object") {
      const a = t.artist as Record<string, unknown>;
      artist = String(a["#text"] ?? a.name ?? "").trim();
    }
    if (!name || !artist) continue;
    const mbid = typeof t.mbid === "string" && t.mbid.trim() ? t.mbid.trim() : undefined;
    const url = typeof t.url === "string" && t.url.trim() ? t.url.trim() : undefined;
    out.push({ name, artist, mbid, url });
  }
  return out;
}


function mapGetInfoTrack(track: Record<string, unknown>): LastfmSearchTrack {
  const title = String(track.name ?? "").trim();
  let artist = "";
  if (typeof track.artist === "string") artist = track.artist.trim();
  else if (track.artist && typeof track.artist === "object") {
    const a = track.artist as Record<string, unknown>;
    artist = String(a.name ?? a["#text"] ?? "").trim();
  }

  let album: string | null = null;
  let albumImage: unknown;
  const al = track.album;
  if (typeof al === "string") {
    album = al.trim() || null;
  } else if (al && typeof al === "object") {
    const ao = al as Record<string, unknown>;
    album = String(ao.title ?? ao["#text"] ?? "").trim() || null;
    albumImage = ao.image;
  }

  let imageUrl = pickLargestLastfmImage(track.image);
  if (!imageUrl) imageUrl = pickLargestLastfmImage(albumImage);

  const url = typeof track.url === "string" && track.url.trim() ? track.url.trim() : null;
  const mbid = typeof track.mbid === "string" && track.mbid.trim() ? track.mbid.trim() : null;

  return { title, artist, album, imageUrl, url, mbid };
}

/**
 * Busca faixas no Last.fm: `track.search` + `track.getInfo` por resultado (sequencial, para respeitar rate limit).
 */
export async function searchLastfmTracks(
  query: string,
  limit: number,
): Promise<LastfmSearchTrack[]> {
  const q = query.trim();
  if (!q || !lastfmSearchApiConfigured()) return [];

  const lim = Math.min(20, Math.max(1, Math.floor(limit)));
  const searchData = (await lastfmJson("track.search", {
    track: q,
    limit: String(Math.min(30, lim * 3)),
  })) as { results?: { trackmatches?: { track?: unknown } } };

  const matches = normalizeSearchMatches(searchData?.results?.trackmatches?.track).slice(0, lim);
  const out: LastfmSearchTrack[] = [];

  for (const m of matches) {
    try {
      let infoPayload: unknown;
      if (m.mbid) {
        try {
          infoPayload = await lastfmJson("track.getInfo", { mbid: m.mbid, autocorrect: "1" });
        } catch {
          infoPayload = await lastfmJson("track.getInfo", {
            track: m.name,
            artist: m.artist,
            autocorrect: "1",
          });
        }
      } else {
        infoPayload = await lastfmJson("track.getInfo", {
          track: m.name,
          artist: m.artist,
          autocorrect: "1",
        });
      }

      const track = (infoPayload as { track?: unknown })?.track;
      if (track && typeof track === "object") {
        const raw = track as Record<string, unknown>;
        out.push(mapGetInfoTrack(raw));
        continue;
      }
    } catch {
      // segue para fallback abaixo
    }

    out.push({
      title: m.name,
      artist: m.artist,
      album: null,
      imageUrl: null,
      url: m.url ?? null,
      mbid: m.mbid ?? null,
    });
  }

  return out;
}
