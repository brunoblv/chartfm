import { fetchTopTracks } from "./lastfm";
import { fetchLastfmTrackTags } from "./lastfm-track-tags";
import { searchSpotifyTracks, spotifyConfigured } from "./spotify-server";
import { upsertSongFromSpotify } from "./mytrl-weekly-chart";
import { prisma } from "./prisma";

// Artistas banidos — nunca entram em nenhuma parada "de estilo" (auto_decay),
// mesmo que apareçam no top tracks Last.fm de algum dos usuários-fonte.
export const BANNED_ARTISTS = ["Pinguini Tattici Nucleari"];

// Mapeia rótulos de gênero (ex.: os salvos em Parada.genres) para substrings de
// tags do Last.fm (lowercase) usadas no filtro.
const GENRE_TAG_MATCHERS: Record<string, string[]> = {
  pop: ["pop"],
  rock: ["rock"],
  kpop: ["k-pop", "kpop", "korean"],
  eletronic: ["electro", "edm", "house", "techno", "dance", "synth"],
  electronic: ["electro", "edm", "house", "techno", "dance", "synth"],
  "r&b": ["r&b", "rnb", "r n b", "randb", "soul"],
  alternative: ["alternative", "alt rock", "indie"],
  latin: ["latin", "reggaeton", "latino"],
  brazilian: ["brazil", "brasil", "mpb", "sertanejo", "samba", "bossa nova"],
  mpb: ["mpb"],
};

export function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function genreMatchers(genre: string): string[] {
  const key = genre.trim().toLowerCase();
  return GENRE_TAG_MATCHERS[key] ?? [key];
}

const bannedNormalized = new Set(BANNED_ARTISTS.map((a) => normalizeKey(a)));
export function isBannedArtist(artist: string): boolean {
  const norm = normalizeKey(artist);
  return [...bannedNormalized].some((banned) => norm === banned || norm.includes(banned));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export type GenreCandidate = {
  track: string;
  artist: string;
  album: string;
  playcount: number;
};

function mergeCandidates(all: GenreCandidate[][]): GenreCandidate[] {
  const byKey = new Map<string, GenreCandidate>();
  for (const list of all) {
    for (const t of list) {
      const key = `${normalizeKey(t.track)}|||${normalizeKey(t.artist)}`;
      const existing = byKey.get(key);
      if (existing) existing.playcount += t.playcount;
      else byKey.set(key, { ...t });
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.playcount - a.playcount);
}

/**
 * Busca top tracks (últimos 30 dias, máx. 10 por usuário) dos usuários Last.fm
 * indicados, funde por faixa, remove artistas banidos e faixas em `excludeKeys`
 * (normalizeKey(track)|||normalizeKey(artist)), e retorna ranqueadas: as que batem
 * alguma tag de `genres` primeiro, depois as demais (fallback quando faltar volume).
 */
export async function fetchGenreCandidates(
  lastfmUsers: string[],
  genres: string[],
  limit: number,
  excludeKeys: Set<string> = new Set(),
): Promise<{ candidates: GenreCandidate[]; matchedCount: number; invalidUsers: string[] }> {
  const uniqueUsers = [...new Set(lastfmUsers)];
  const invalidUsers: string[] = [];

  const perUser = await Promise.all(
    uniqueUsers.map(async (u) => {
      try {
        return await fetchTopTracks("1month", 10, u);
      } catch {
        invalidUsers.push(u);
        return [];
      }
    }),
  );

  const merged = mergeCandidates(perUser)
    .filter((c) => !isBannedArtist(c.artist))
    .filter((c) => !excludeKeys.has(`${normalizeKey(c.track)}|||${normalizeKey(c.artist)}`));

  const matchers = genres.flatMap(genreMatchers);
  const matched: GenreCandidate[] = [];
  const unmatched: GenreCandidate[] = [];

  for (const c of merged) {
    const result = await fetchLastfmTrackTags(c.track, c.artist);
    const tags = result?.tags ?? [];
    await sleep(120);
    if (tags.some((tag) => matchers.some((m) => tag.includes(m)))) matched.push(c);
    else unmatched.push(c);
  }

  const combined = [...matched];
  if (combined.length < limit) combined.push(...unmatched.slice(0, limit - combined.length));

  return { candidates: combined.slice(0, limit), matchedCount: matched.length, invalidUsers };
}

export type ResolvedGenreSong = { id: string; spotifyId: string | null };

export async function resolveGenreSong(title: string, artist: string): Promise<ResolvedGenreSong | null> {
  const dbRow = await prisma.song.findFirst({
    where: {
      title: { equals: title, mode: "insensitive" },
      artist: { contains: artist.split(",")[0]?.trim() ?? artist, mode: "insensitive" },
    },
    select: { id: true, spotifyId: true },
  });
  if (dbRow) return { id: dbRow.id, spotifyId: dbRow.spotifyId };

  if (!spotifyConfigured()) return null;

  const hits = await searchSpotifyTracks(`${title} ${artist}`, 5, "BR");
  if (!hits.length) return null;
  const titleNorm = normalizeKey(title);
  const artistNorm = normalizeKey(artist.split(",")[0] ?? artist);
  const best =
    hits.find((h) => normalizeKey(h.title) === titleNorm && normalizeKey(h.artist).includes(artistNorm)) ??
    hits.find((h) => normalizeKey(h.title) === titleNorm) ??
    hits[0];
  if (!best?.spotifyId) return null;

  const song = await upsertSongFromSpotify(best.spotifyId, { track: title, artist, album: best.album });
  await sleep(150);
  return { id: song.id, spotifyId: song.spotifyId };
}
