import type { PrismaClient } from "@prisma/client";
import { upsertSongFromSpotify } from "@/lib/mytrl-weekly-chart";
import { searchSpotifyTracks, spotifyConfigured } from "@/lib/spotify-server";
import type { CrownnoteUserExport } from "@/lib/crownnote-export";
import { prisma } from "@/lib/prisma";

const FEAT_SUFFIX_RE = /\s*\((feat\.?|ft\.?|featuring)\s+([^)]+)\)\s*$/i;
const PAREN_SUFFIX_RE =
  /\s*\((feat\.?|ft\.?|featuring|remix|rmx|edit|version|ver\.?|live|acoustic|radio)[^)]*\)\s*$/gi;
const NON_ORIGINAL_RE =
  /off vocal|instrumental|カラオケ|karaoke|remix|acoustic|live|concert|-\s*ver\.?|from the first take|cover\b/i;
const SPOTIFY_DELAY_MS = 350;

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
  source: "auto" | "manual_db" | "manual_spotify" | "auto_spotify";
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
    .replace(/[''`´]/g, "'")
    .replace(/[""]/g, '"')
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

function extractFeatFromArtist(artistRaw: string): string | null {
  const match = artistRaw.match(/\s+(?:feat\.?|featuring|ft\.?)\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function splitCrownnoteArtists(artistRaw: string): string[] {
  const parts = artistRaw
    .split(/\s*(?:&|,|\/|\+)\s*|\s+ft\.?\s+|\s+featuring\s+|\s+with\s+/i)
    .map((p) => cleanArtistForLookup(p))
    .filter(Boolean);
  return [...new Set(parts.length ? parts : [cleanArtistForLookup(artistRaw)])];
}

export function normalizeTitleForMatch(title: string): string {
  return normalizeMatchText(
    title
      .replace(PAREN_SUFFIX_RE, " ")
      .replace(/\s*-\s*track masters remix\s*$/i, " ")
      .trim(),
  );
}

function buildTitleCandidates(title: string, artistRaw: string): string[] {
  const { baseTitle, featArtist } = parseTitleAndFeat(title);
  const artistFeat = extractFeatFromArtist(artistRaw);
  const feat = featArtist ?? artistFeat;
  const out = [title, baseTitle];
  if (feat) {
    out.push(`${baseTitle} (feat. ${feat})`, `${title} (feat. ${feat})`);
  }
  return [...new Set(out.map((t) => t.trim()).filter(Boolean))];
}

function buildArtistTokens(artistRaw: string): string[] {
  const tokens = new Set<string>();
  const cleaned = cleanArtistForLookup(artistRaw);
  tokens.add(cleaned);
  for (const part of splitCrownnoteArtists(artistRaw)) tokens.add(part);
  const feat = extractFeatFromArtist(artistRaw);
  if (feat) tokens.add(cleanArtistForLookup(feat));
  for (const t of [...tokens]) {
    const words = t.split(/\s+/).filter(Boolean);
    if (words[0] && words[0].length >= 2) tokens.add(words[0]!);
    if (words.length >= 2) tokens.add(words.slice(0, 2).join(" "));
  }
  return [...tokens].filter(Boolean);
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

  return [...counts.values()].sort((a, b) => b.occurrences - a.occurrences);
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
      best = Math.max(best, 85);
    } else if (candidateNorm.includes(targetNorm) || targetNorm.includes(candidateNorm)) {
      best = Math.max(best, 70);
    } else {
      const targetToken = targetNorm.split(" ")[0] ?? targetNorm;
      if (targetToken.length >= 3 && candidateNorm.includes(targetToken)) best = Math.max(best, 45);
    }
  }
  return best;
}

function scoreTitleMatch(candidateTitle: string, targets: string[]): number {
  const candidateNorm = normalizeTitleForMatch(candidateTitle);
  let best = 0;
  for (const target of targets) {
    const targetNorm = normalizeTitleForMatch(target);
    if (!targetNorm) continue;
    if (candidateNorm === targetNorm) best = Math.max(best, 100);
    else if (candidateNorm.startsWith(targetNorm) || targetNorm.startsWith(candidateNorm)) {
      best = Math.max(best, 85);
    } else if (candidateNorm.includes(targetNorm) || targetNorm.includes(candidateNorm)) {
      best = Math.max(best, 70);
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
  const artistFeat = extractFeatFromArtist(artistRaw);
  const artistTargets = [
    cleanArtistForLookup(artistRaw),
    ...splitCrownnoteArtists(artistRaw),
    ...(featArtist ? [featArtist] : []),
    ...(artistFeat ? [artistFeat] : []),
  ];
  const titleTargets = buildTitleCandidates(title, artistRaw);

  let best: { song: DbSongCandidate; score: number; confidence: "exact" | "fuzzy" } | null = null;

  for (const candidate of candidates) {
    const titleScore = scoreTitleMatch(candidate.title, titleTargets);
    if (!titleScore) continue;

    const artistScore = scoreArtistMatch(candidate.artist, artistTargets);
    if (!artistScore) continue;

    const score = titleScore + artistScore;
    const confidence: "exact" | "fuzzy" =
      titleScore >= 100 && artistScore >= 85 ? "exact" : "fuzzy";
    if (!best || score > best.score) best = { song: candidate, score, confidence };
  }

  if (!best || best.score < 115) return null;
  return { song: best.song, confidence: best.confidence };
}

async function queryCatalogCandidates(
  title: string,
  artistRaw: string,
  db: PrismaClient,
): Promise<DbSongCandidate[]> {
  const titleCandidates = buildTitleCandidates(title, artistRaw);
  const artistTokens = buildArtistTokens(artistRaw);
  const seen = new Set<string>();
  const out: DbSongCandidate[] = [];

  const push = (rows: DbSongCandidate[]) => {
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
  };

  for (const titleCandidate of titleCandidates) {
    const normalized = normalizeTitleForMatch(titleCandidate);
    const titleWords = normalized.split(/\s+/).filter((w) => w.length >= 2);
    const titleCore = titleWords.slice(0, Math.min(4, titleWords.length)).join(" ");
    if (!titleCore) continue;

    for (const artistToken of artistTokens) {
      push(
        await db.song.findMany({
          where: {
            AND: [
              {
                OR: [
                  { title: { equals: titleCandidate, mode: "insensitive" } },
                  { title: { contains: titleCore, mode: "insensitive" } },
                ],
              },
              { artist: { contains: artistToken, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            title: true,
            artist: true,
            spotifyId: true,
            albumSpotifyId: true,
          },
          take: 25,
        }),
      );
      if (out.length >= 60) return out;
    }
  }

  return out;
}

function toCatalogSong(song: DbSongCandidate): CrownnoteCatalogSong {
  return {
    songId: song.id,
    title: song.title,
    artist: song.artist,
    spotifyId: song.spotifyId,
    albumSpotifyId: song.albumSpotifyId,
  };
}

export async function matchSongInCatalog(
  title: string,
  artistRaw: string,
  db: PrismaClient = prisma,
): Promise<{ match: CrownnoteCatalogSong; confidence: "exact" | "fuzzy" } | null> {
  const candidates = await queryCatalogCandidates(title, artistRaw, db);
  const picked = pickBestCandidate(candidates, title, artistRaw);
  if (!picked) return null;
  return { confidence: picked.confidence, match: toCatalogSong(picked.song) };
}

function buildSpotifyQueries(title: string, artistRaw: string): string[] {
  const { baseTitle, featArtist } = parseTitleAndFeat(title);
  const artistClean = cleanArtistForLookup(artistRaw);
  const artistFeat = extractFeatFromArtist(artistRaw);
  const queries = [
    `${baseTitle} ${artistClean}`,
    `${title} ${artistClean}`,
    `${baseTitle} ${artistRaw}`,
  ];
  if (artistFeat) queries.push(`${baseTitle} ${artistFeat}`, `${baseTitle} ${artistClean} ${artistFeat}`);
  if (featArtist) queries.push(`${baseTitle} ${featArtist}`);
  return [...new Set(queries.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

function pickBestSpotifyHit(
  hits: Awaited<ReturnType<typeof searchSpotifyTracks>>,
  title: string,
  artistRaw: string,
) {
  const titleTargets = buildTitleCandidates(title, artistRaw).map(normalizeTitleForMatch);
  const artistTargets = buildArtistTokens(artistRaw);

  const usable = hits.filter((h) => h.spotifyId && !NON_ORIGINAL_RE.test(h.title));
  if (!usable.length) return null;

  let best: { hit: (typeof usable)[number]; score: number } | null = null;
  for (const hit of usable) {
    const titleScore = scoreTitleMatch(hit.title, titleTargets);
    const artistScore = scoreArtistMatch(hit.artist, artistTargets);
    const score = titleScore + artistScore;
    if (!best || score > best.score) best = { hit, score };
  }

  return best && best.score >= 100 ? best.hit : usable[0] ?? null;
}

export async function resolveCrownnoteSongViaSpotify(
  title: string,
  artistRaw: string,
): Promise<CrownnoteCatalogSong | null> {
  if (!spotifyConfigured()) return null;

  let best: Awaited<ReturnType<typeof searchSpotifyTracks>>[number] | null = null;
  for (const market of ["BR", "US"]) {
    for (const query of buildSpotifyQueries(title, artistRaw)) {
      await new Promise((r) => setTimeout(r, SPOTIFY_DELAY_MS));
      const hits = await searchSpotifyTracks(query, 8, market);
      best = pickBestSpotifyHit(hits, title, artistRaw);
      if (best) break;
    }
    if (best) break;
  }
  if (!best?.spotifyId) return null;

  const song = await upsertSongFromSpotify(best.spotifyId, {
    track: title,
    artist: cleanArtistForLookup(artistRaw),
    album: best.album ?? "",
  });

  const saved = await prisma.song.findUnique({
    where: { id: song.id },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      albumSpotifyId: true,
    },
  });
  if (!saved) return null;

  return {
    songId: saved.id,
    title: saved.title,
    artist: saved.artist,
    spotifyId: saved.spotifyId,
    albumSpotifyId: saved.albumSpotifyId,
  };
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

export async function rematchUnmatchedRows(rows: CrownnoteSongMatchRow[]): Promise<{
  rows: CrownnoteSongMatchRow[];
  resolved: number;
}> {
  let resolved = 0;
  const next = [...rows];
  for (let i = 0; i < next.length; i++) {
    const row = next[i]!;
    if (row.match) continue;
    const result = await matchSongInCatalog(row.crownnoteTitle, row.crownnoteArtist);
    if (!result) continue;
    next[i] = {
      ...row,
      status: "matched",
      match: result.match,
      confidence: result.confidence,
    };
    resolved += 1;
  }
  return { rows: next, resolved };
}

export async function resolveUnmatchedRowsViaSpotify(
  rows: CrownnoteSongMatchRow[],
  onProgress?: (payload: { current: number; total: number; key: string; ok: boolean }) => void,
): Promise<{ rows: CrownnoteSongMatchRow[]; resolved: number; failed: number }> {
  const pending = rows.filter((r) => !r.match);
  let resolved = 0;
  let failed = 0;
  const next = [...rows];
  const indexByKey = new Map(next.map((r, i) => [r.key, i]));

  for (let i = 0; i < pending.length; i++) {
    const row = pending[i]!;
    const match = await resolveCrownnoteSongViaSpotify(row.crownnoteTitle, row.crownnoteArtist);
    const idx = indexByKey.get(row.key);
    if (idx !== undefined && match) {
      next[idx] = {
        ...row,
        status: "matched",
        match,
        confidence: "fuzzy",
      };
      resolved += 1;
    } else {
      failed += 1;
    }
    onProgress?.({
      current: i + 1,
      total: pending.length,
      key: row.key,
      ok: Boolean(match),
    });
  }

  return { rows: next, resolved, failed };
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

export function mappingsFromMatchRows(
  rows: CrownnoteSongMatchRow[],
  manualSources: Record<string, CrownnoteSongMapping["source"]> = {},
): CrownnoteSongMapping[] {
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
      source: manualSources[row.key] ?? "auto",
    }));
}
