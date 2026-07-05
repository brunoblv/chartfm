import type { PrismaClient } from "@prisma/client";
import type { CrownnoteUserExport } from "@/lib/crownnote-export";
import { prisma } from "@/lib/prisma";

const FEAT_SUFFIX_RE = /\s*\((feat\.?|ft\.?|featuring)\s+([^)]+)\)\s*$/i;

export type CrownnoteCatalogSong = {
  songId: string;
  title: string;
  artist: string;
  spotifyId: string | null;
  albumSpotifyId: string | null;
};

export type CrownnoteSongRef = {
  key: string;
  crownnoteArtist: string;
  crownnoteTitle: string;
  occurrences: number;
};

export type CrownnoteSongMatchRow = CrownnoteSongRef & {
  status: "matched" | "unmatched";
  match: CrownnoteCatalogSong | null;
  confidence: "exact" | "fuzzy" | null;
};

export type CrownnoteSongMapping = CrownnoteCatalogSong & {
  key: string;
  crownnoteArtist: string;
  crownnoteTitle: string;
  source: "auto" | "manual_db" | "manual_spotify";
};

export type CrownnoteMappedExport = CrownnoteUserExport & {
  songMappings: CrownnoteSongMapping[];
  matchStats: {
    uniqueSongs: number;
    matched: number;
    unmatched: number;
  };
};

export function normalizeMatchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function crownnoteSongKey(artist: string, title: string): string {
  return `${normalizeMatchText(artist)}|${normalizeMatchText(title)}`;
}

export function cleanArtistForLookup(input: string): string {
  let text = input.trim();
  text = text.replace(/\s+(feat\.?|featuring|ft\.?|f\/|with|w\/)\s+.*$/i, "").trim();
  text = text.replace(/\s*ft\.\s+.*$/i, "").trim();
  text = text.replace(/\s*[,/&]\s*$/g, "").trim();
  return text || input.trim();
}

function parseTitleAndFeat(title: string): { baseTitle: string; featArtist: string | null } {
  const match = title.match(FEAT_SUFFIX_RE);
  if (!match) return { baseTitle: title.trim(), featArtist: null };
  return {
    baseTitle: title.slice(0, match.index).trim(),
    featArtist: match[2]!.trim(),
  };
}

function splitCrownnoteArtists(artistRaw: string): string[] {
  const parts = artistRaw
    .split(/\s*(?:&|,|\/|\+)\s*|\s+ft\.?\s+|\s+featuring\s+|\s+with\s+/i)
    .map((p) => cleanArtistForLookup(p))
    .filter(Boolean);
  return [...new Set(parts.length ? parts : [cleanArtistForLookup(artistRaw)])];
}

export function collectUniqueCrownnoteSongs(exportData: CrownnoteUserExport): CrownnoteSongRef[] {
  const counts = new Map<string, CrownnoteSongRef>();

  for (const chart of exportData.charts) {
    for (const entry of chart.entries) {
      const key = crownnoteSongKey(entry.artist, entry.title);
      const existing = counts.get(key);
      if (existing) {
        existing.occurrences += 1;
      } else {
        counts.set(key, {
          key,
          crownnoteArtist: entry.artist,
          crownnoteTitle: entry.title,
          occurrences: 1,
        });
      }
    }
  }

  return [...counts.values()].sort((a, b) => {
    if (a.crownnoteArtist !== b.crownnoteArtist) {
      return a.crownnoteArtist.localeCompare(b.crownnoteArtist);
    }
    return a.crownnoteTitle.localeCompare(b.crownnoteTitle);
  });
}

type DbSongCandidate = {
  id: string;
  title: string;
  artist: string;
  spotifyId: string | null;
  albumSpotifyId: string | null;
};

function scoreArtistMatch(candidateArtist: string, targets: string[]): number {
  const candidateNorm = normalizeMatchText(candidateArtist);
  let best = 0;
  for (const target of targets) {
    const targetNorm = normalizeMatchText(cleanArtistForLookup(target));
    if (!targetNorm) continue;
    if (candidateNorm === targetNorm) best = Math.max(best, 100);
    else if (candidateNorm.startsWith(targetNorm) || targetNorm.startsWith(candidateNorm)) {
      best = Math.max(best, 80);
    } else if (candidateNorm.includes(targetNorm) || targetNorm.includes(candidateNorm)) {
      best = Math.max(best, 60);
    } else {
      const targetToken = targetNorm.split(" ")[0] ?? targetNorm;
      if (targetToken.length >= 3 && candidateNorm.includes(targetToken)) best = Math.max(best, 40);
    }
  }
  return best;
}

function pickBestCandidate(
  candidates: DbSongCandidate[],
  title: string,
  artistRaw: string,
): { song: DbSongCandidate; confidence: "exact" | "fuzzy" } | null {
  if (!candidates.length) return null;

  const { baseTitle, featArtist } = parseTitleAndFeat(title);
  const artistTargets = [
    cleanArtistForLookup(artistRaw),
    ...splitCrownnoteArtists(artistRaw),
    ...(featArtist ? [featArtist] : []),
  ];
  const titleTargets = [...new Set([title, baseTitle].map((t) => normalizeMatchText(t)))];

  let best: { song: DbSongCandidate; score: number; confidence: "exact" | "fuzzy" } | null = null;

  for (const candidate of candidates) {
    const titleNorm = normalizeMatchText(candidate.title);
    const titleScore = titleTargets.some((t) => t === titleNorm)
      ? 100
      : titleTargets.some((t) => titleNorm.includes(t) || t.includes(titleNorm))
        ? 70
        : 0;
    if (!titleScore) continue;

    const artistScore = scoreArtistMatch(candidate.artist, artistTargets);
    if (!artistScore) continue;

    const score = titleScore + artistScore;
    const confidence: "exact" | "fuzzy" = titleScore === 100 && artistScore >= 80 ? "exact" : "fuzzy";
    if (!best || score > best.score) best = { song: candidate, score, confidence };
  }

  if (!best || best.score < 100) return null;
  return { song: best.song, confidence: best.confidence };
}

export async function matchSongInCatalog(
  title: string,
  artistRaw: string,
  db: PrismaClient = prisma,
): Promise<{ match: CrownnoteCatalogSong; confidence: "exact" | "fuzzy" } | null> {
  const { baseTitle, featArtist } = parseTitleAndFeat(title);
  const artistCandidates = [
    cleanArtistForLookup(artistRaw),
    ...splitCrownnoteArtists(artistRaw),
    ...(featArtist ? [featArtist] : []),
  ];
  const titleCandidates = [...new Set([title, baseTitle].filter(Boolean))];

  for (const titleCandidate of titleCandidates) {
    const candidates = await db.song.findMany({
      where: {
        title: { equals: titleCandidate, mode: "insensitive" },
        OR: artistCandidates.map((artist) => ({
          artist: {
            contains: artist.split(" ")[0] ?? artist,
            mode: "insensitive" as const,
          },
        })),
      },
      select: {
        id: true,
        title: true,
        artist: true,
        spotifyId: true,
        albumSpotifyId: true,
      },
      take: 30,
    });

    const picked = pickBestCandidate(candidates, title, artistRaw);
    if (picked) {
      return {
        confidence: picked.confidence,
        match: {
          songId: picked.song.id,
          title: picked.song.title,
          artist: picked.song.artist,
          spotifyId: picked.song.spotifyId,
          albumSpotifyId: picked.song.albumSpotifyId,
        },
      };
    }
  }

  return null;
}

export async function matchCrownnoteExport(
  exportData: CrownnoteUserExport,
): Promise<CrownnoteSongMatchRow[]> {
  const unique = collectUniqueCrownnoteSongs(exportData);
  const rows: CrownnoteSongMatchRow[] = [];

  for (const song of unique) {
    const result = await matchSongInCatalog(song.crownnoteTitle, song.crownnoteArtist);
    rows.push({
      ...song,
      status: result ? "matched" : "unmatched",
      match: result?.match ?? null,
      confidence: result?.confidence ?? null,
    });
  }

  return rows;
}

export function buildMappedExport(
  exportData: CrownnoteUserExport,
  mappings: CrownnoteSongMapping[],
): CrownnoteMappedExport {
  const mappingByKey = new Map(mappings.map((m) => [m.key, m]));
  const unique = collectUniqueCrownnoteSongs(exportData);
  const matched = unique.filter((song) => mappingByKey.has(song.key)).length;

  return {
    ...exportData,
    songMappings: mappings,
    matchStats: {
      uniqueSongs: unique.length,
      matched,
      unmatched: unique.length - matched,
    },
  };
}

export function mappingsFromMatchRows(rows: CrownnoteSongMatchRow[]): CrownnoteSongMapping[] {
  return rows
    .filter((row) => row.match)
    .map((row) => ({
      key: row.key,
      crownnoteArtist: row.crownnoteArtist,
      crownnoteTitle: row.crownnoteTitle,
      songId: row.match!.songId,
      title: row.match!.title,
      artist: row.match!.artist,
      spotifyId: row.match!.spotifyId,
      albumSpotifyId: row.match!.albumSpotifyId,
      source: "auto" as const,
    }));
}
