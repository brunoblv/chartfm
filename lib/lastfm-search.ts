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

function extractAlbumMbid(track: Record<string, unknown>): string | null {
  const al = track.album;
  if (!al || typeof al !== "object") return null;
  const mb = (al as Record<string, unknown>).mbid;
  if (typeof mb === "string" && mb.trim()) return mb.trim();
  return null;
}

type CaaImage = {
  types?: string[];
  thumbnails?: Record<string, string>;
  image?: string;
};

function normalizeCoverUrl(url: string): string {
  if (url.startsWith("http://coverartarchive.org")) {
    return `https://${url.slice("http://".length)}`;
  }
  return url;
}

function pickFrontCoverFromCaaPayload(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const images = (data as { images?: unknown }).images;
  if (!Array.isArray(images)) return null;

  const isFront = (img: unknown) => {
    if (!img || typeof img !== "object") return false;
    const types = (img as CaaImage).types;
    return Array.isArray(types) && types.includes("Front");
  };

  const candidates = images.filter(isFront);
  const list = candidates.length > 0 ? candidates : images;

  for (const img of list) {
    if (!img || typeof img !== "object") continue;
    const o = img as CaaImage;
    const th = o.thumbnails;
    if (th && typeof th === "object") {
      for (const k of ["1200", "500", "250", "large", "small"]) {
        const u = th[k];
        if (typeof u === "string" && u.startsWith("http")) return normalizeCoverUrl(u);
      }
      for (const u of Object.values(th)) {
        if (typeof u === "string" && u.startsWith("http")) return normalizeCoverUrl(u);
      }
    }
    if (typeof o.image === "string" && o.image.startsWith("http")) return normalizeCoverUrl(o.image);
  }
  return null;
}

/** Cover Art Archive (MusicBrainz): tenta release-group e depois release. */
async function fetchCoverArtArchiveImage(albumMbid: string): Promise<string | null> {
  const id = albumMbid.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const headers = {
    Accept: "application/json",
    "User-Agent": "chartify/0.1 (capa via Cover Art Archive)",
  };

  for (const kind of ["release-group", "release"] as const) {
    const url = `https://coverartarchive.org/${kind}/${encodeURIComponent(id)}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (res.status === 404) continue;
    if (!res.ok) continue;
    try {
      const data: unknown = await res.json();
      const picked = pickFrontCoverFromCaaPayload(data);
      if (picked) return picked;
    } catch {
      continue;
    }
  }
  return null;
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

const MUSICBRAINZ_UA = "chartify/0.1 (+https://github.com)";

let lastMusicbrainzFetchAt = 0;

async function throttleMusicbrainz(): Promise<void> {
  const elapsed = Date.now() - lastMusicbrainzFetchAt;
  const minGapMs = 1100;
  if (elapsed < minGapMs) {
    await new Promise((r) => setTimeout(r, minGapMs - elapsed));
  }
  lastMusicbrainzFetchAt = Date.now();
}

function stripQuotes(s: string): string {
  return s.replace(/"/g, "").trim();
}

/** Resolve MusicBrainz Release Group id via busca (Last.fm muitas vezes não manda `album.mbid`). */
async function musicbrainzReleaseGroupId(artist: string, album: string | null): Promise<string | null> {
  const ar = stripQuotes(artist);
  if (!ar) return null;

  let query: string;
  if (album && album.trim()) {
    const al = stripQuotes(album);
    if (al) query = `"${al}" AND artist:"${ar}"`;
    else query = `"${ar}"`;
  } else {
    query = `"${ar}"`;
  }

  await throttleMusicbrainz();
  const url = `https://musicbrainz.org/ws/2/release-group?fmt=json&limit=1&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": MUSICBRAINZ_UA },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { "release-groups"?: Array<{ id?: string }> };
  const rg = data["release-groups"];
  if (!Array.isArray(rg) || !rg[0]?.id) return null;
  return rg[0].id;
}

async function resolveCoverArtArchiveForTrack(
  artist: string,
  album: string | null,
  albumMbidFromLastfm: string | null,
): Promise<string | null> {
  if (albumMbidFromLastfm) {
    const direct = await fetchCoverArtArchiveImage(albumMbidFromLastfm);
    if (direct) return direct;
  }
  const rg = await musicbrainzReleaseGroupId(artist, album);
  if (!rg) return null;
  return fetchCoverArtArchiveImage(rg);
}

/**
 * Busca faixas no Last.fm: `track.search` + `track.getInfo` por resultado (sequencial, para respeitar rate limit).
 */
export async function searchLastfmTracks(
  query: string,
  limit: number,
  opts?: { coverFallback?: boolean },
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
        let row = mapGetInfoTrack(raw);
        if (opts?.coverFallback && !row.imageUrl) {
          const albumMbid = extractAlbumMbid(raw);
          try {
            const caa = await resolveCoverArtArchiveForTrack(row.artist, row.album, albumMbid);
            if (caa) row = { ...row, imageUrl: caa };
          } catch {
            // mantém capa do Last.fm (se houver)
          }
        }
        out.push(row);
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
