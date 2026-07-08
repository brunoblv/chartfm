/**
 * Cria 22 paradas "de estilo" para usuários específicos, montadas a partir do Last.fm
 * (top tracks dos últimos 30 dias de até 4 usuários Last.fm por parada, máx. 10 faixas
 * por usuário), filtradas pelas tags de gênero favoritas de cada parada. Publica a
 * primeira edição às 8h BRT no próximo dia da semana indicado na planilha.
 *
 * Usage:
 *   npx tsx scripts/create-genre-paradas.ts --dry-run
 *   npx tsx scripts/create-genre-paradas.ts --dry-run --only=cesarmaziero,keku
 *   npx tsx scripts/create-genre-paradas.ts --prod            (grava em produção)
 *   npx tsx scripts/create-genre-paradas.ts --prod --only=keku
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { fetchTopTracks } from "../lib/lastfm";
import { fetchLastfmTrackTags } from "../lib/lastfm-track-tags";
import { paletteFor } from "../lib/mytrl-weekly-chart";
import { pointsForChartPosition, scoringTierFromPrimary, MAX_PARADAS_PER_USER } from "../lib/parada-points";
import { buildDateRangeFromDate, buildWeekIndexFromDate, buildWeekLabelFromDate, getChartWeekRange } from "../lib/chart-week";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
}

const DRY_RUN = !process.argv.includes("--prod");
const ONLY_ARG = process.argv.find((a) => a.startsWith("--only="));
const ONLY = ONLY_ARG ? new Set(ONLY_ARG.split("=").slice(1).join("=").split(",").map((s) => s.trim().toLowerCase())) : null;

// Sempre lê de produção (é onde os 22 handles existem). --dry-run só pula as gravações.
process.env.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL ?? process.env.DATABASE_URL;

if (DRY_RUN) {
  console.log("=== MODO DRY-RUN (lendo produção, nada será gravado). Use --prod para gravar. ===\n");
} else {
  console.log("=== MODO PRODUÇÃO — vai gravar no banco real. ===\n");
}

const prisma = new PrismaClient();

const WEEKDAY_MAP: Record<string, number> = {
  SEGUNDA: 1,
  TERCA: 2,
  TERÇA: 2,
  QUARTA: 3,
  QUINTA: 4,
  SEXTA: 5,
  SABADO: 6,
  SÁBADO: 6,
  DOMINGO: 0,
};

type Row = {
  handle: string;
  genres: string[];
  paradaName: string;
  size: number;
  lastfmUsers: string[];
  weekday: string;
};

const ROWS: Row[] = [
  { handle: "cesarmaziero", genres: ["pop", "rock", "kpop"], paradaName: "CESAR20", size: 20, lastfmUsers: ["romisk", "lucas_SS", "thunder__", "blvbruno"], weekday: "SEGUNDA" },
  { handle: "demilovatique", genres: ["pop"], paradaName: "Lovatique's Parade", size: 30, lastfmUsers: ["thunder__", "lucas_SS"], weekday: "TERÇA" },
  { handle: "dudabts", genres: ["kpop", "pop"], paradaName: "Serendipity Hot 50", size: 50, lastfmUsers: ["romisk", "ohmymog_", "gabrielhahn", "alephunk"], weekday: "QUARTA" },
  { handle: "kendikamura", genres: ["rock"], paradaName: "Riot Act Top 30", size: 30, lastfmUsers: ["blvbruno", "gabrielhahn", "ohmymog_"], weekday: "QUINTA" },
  { handle: "julianast", genres: ["rock", "pop"], paradaName: "The Hits", size: 20, lastfmUsers: ["boofrnds", "IM4ttthew", "lucas_SS", "gabrielhahn"], weekday: "SEXTA" },
  { handle: "karlacomk", genres: ["pop", "eletronic", "rock"], paradaName: "Top 20", size: 20, lastfmUsers: ["thunder__", "lucas_SS"], weekday: "SEGUNDA" },
  { handle: "theandre", genres: ["rock", "pop"], paradaName: "Top 20", size: 20, lastfmUsers: ["nothingbutcami", "blvbruno", "readingmyeyes", "Khalysto"], weekday: "TERÇA" },
  { handle: "joaoHT", genres: ["pop", "kpop"], paradaName: "Hitlist", size: 20, lastfmUsers: ["okpaulinho", "romisk", "thunder__"], weekday: "QUARTA" },
  { handle: "caiosoares", genres: ["R&B", "pop", "kpop"], paradaName: "As Melhores da Semana", size: 50, lastfmUsers: ["okpaulinho", "romisk", "soprani"], weekday: "QUINTA" },
  { handle: "heavydirtysoul", genres: ["rock", "alternative", "pop"], paradaName: "heavydirtysoul 100+", size: 100, lastfmUsers: ["boofrnds", "blvbruno", "okpaulinho", "RohLeitao"], weekday: "SEXTA" },
  { handle: "jessycv", genres: ["pop", "eletronic"], paradaName: "Top 40", size: 40, lastfmUsers: ["otifaR", "lucas_SS", "blvbruno", "soprani"], weekday: "SEGUNDA" },
  { handle: "midnightrain", genres: ["pop"], paradaName: "Midnight Rain Playlist", size: 100, lastfmUsers: ["evrmr", "lucas_SS", "Leighlstr", "soprani"], weekday: "TERÇA" },
  { handle: "mayaradias", genres: ["rock"], paradaName: "Neon Pulse", size: 50, lastfmUsers: ["blvbruno", "rafael-a7x", "ohmymog_", "Khalysto"], weekday: "QUARTA" },
  { handle: "diegox", genres: ["pop", "rock", "alternative"], paradaName: "Midnight Frequency", size: 30, lastfmUsers: ["thunder__", "gustavocouk", "ohmymog_", "soprani"], weekday: "QUINTA" },
  { handle: "guisouza", genres: ["kpop", "eletronic", "pop"], paradaName: "Global Heat", size: 20, lastfmUsers: ["lucas_SS", "h_aunted", "alephunk"], weekday: "SEXTA" },
  { handle: "kamarcelino", genres: ["rock", "pop"], paradaName: "Pop Horizon", size: 100, lastfmUsers: ["gabrielhahn", "Rapha1907", "rafael-a7x", "leeooh_costa"], weekday: "SEGUNDA" },
  { handle: "marinasemdiamonds", genres: ["pop", "alternative", "rock"], paradaName: "Electric Chart", size: 40, lastfmUsers: ["h_aunted", "blvbruno", "RohLeitao", "boofrnds"], weekday: "TERÇA" },
  { handle: "lachica", genres: ["rock", "alternative", "pop"], paradaName: "Viral Waves", size: 20, lastfmUsers: ["h_aunted", "ohmymog_", "evrmr", "boofrnds"], weekday: "QUARTA" },
  { handle: "xalmeida", genres: ["pop", "rock", "kpop"], paradaName: "Sound Rush", size: 50, lastfmUsers: ["flow_", "BriRy", "romisk", "boofrnds"], weekday: "QUINTA" },
  { handle: "sandman", genres: ["pop", "kpop", "latin"], paradaName: "Hit Spectrum", size: 20, lastfmUsers: ["h_aunted", "alephunk", "Leighlstr", "blvbruno"], weekday: "SEXTA" },
  { handle: "ingrididas7", genres: ["kpop", "pop"], paradaName: "Next Wave 50", size: 50, lastfmUsers: ["h_aunted", "ownconfusion", "daniel_azevedo", "soprani"], weekday: "SEGUNDA" },
  { handle: "keku", genres: ["pop", "brazilian", "mpb"], paradaName: "Echo Charts", size: 20, lastfmUsers: ["mattvieira", "leonardo_alves", "daniel_azevedo", "gabrielhahn"], weekday: "TERÇA" },
];

// Mapeia rótulos de gênero da planilha para substrings de tags do Last.fm (lowercase).
const GENRE_TAG_MATCHERS: Record<string, string[]> = {
  pop: ["pop"],
  rock: ["rock"],
  kpop: ["k-pop", "kpop", "korean"],
  eletronic: ["electro", "edm", "house", "techno", "dance", "synth"],
  "r&b": ["r&b", "rnb", "r n b", "randb", "soul"],
  alternative: ["alternative", "alt rock", "indie"],
  latin: ["latin", "reggaeton", "latino"],
  brazilian: ["brazil", "brasil", "mpb", "sertanejo", "samba", "bossa nova"],
  mpb: ["mpb"],
};

// Artistas banidos — nunca entram em nenhuma dessas paradas, mesmo que apareçam no
// top tracks Last.fm de algum dos usuários-fonte.
const BANNED_ARTISTS = ["Pinguini Tattici Nucleari"];
const BANNED_ARTISTS_NORMALIZED = new Set(BANNED_ARTISTS.map((a) => normalizeKey(a)));

function isBannedArtist(artist: string): boolean {
  const norm = normalizeKey(artist);
  return [...BANNED_ARTISTS_NORMALIZED].some((banned) => norm === banned || norm.includes(banned));
}

function genreMatchers(genre: string): string[] {
  const key = genre.trim().toLowerCase();
  return GENRE_TAG_MATCHERS[key] ?? [key];
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Data do dia da semana `targetDow` dentro da semana ISO corrente (segunda a
 * domingo de `base`) — não "o próximo X a partir de agora". Isso garante que
 * todas as paradas nasçam na mesma semana (a atual), mesmo que o dia já tenha
 * passado esta semana (nesse caso o publishedAt fica no passado, mas ainda
 * dentro da semana corrente).
 */
function currentWeekWeekdayDate(base: Date, targetDow: number): Date {
  const { start } = getChartWeekRange(base); // segunda da semana corrente
  const mondayOffset = targetDow === 0 ? 6 : targetDow - 1; // 0=domingo -> 6 dias após a segunda
  const d = new Date(start);
  d.setDate(d.getDate() + mondayOffset);
  return d;
}

/** 8h BRT = 11:00 UTC (BRT não tem horário de verão). */
function publishAt8amBrt(localDate: Date): Date {
  return new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 11, 0, 0, 0));
}

type Candidate = {
  track: string;
  artist: string;
  album: string;
  playcount: number;
};

// Cache por username Last.fm — evita refazer a mesma consulta em linhas diferentes.
const topTracksCache = new Map<string, Candidate[]>();
const invalidLastfmUsers = new Set<string>();
async function getTopTracksCached(username: string): Promise<Candidate[]> {
  const key = username.toLowerCase();
  if (topTracksCache.has(key)) return topTracksCache.get(key)!;
  try {
    const tracks = await fetchTopTracks("1month", 10, username);
    topTracksCache.set(key, tracks);
    return tracks;
  } catch (err) {
    invalidLastfmUsers.add(username);
    console.log(`    [aviso] Last.fm @${username} inválido/indisponível: ${String((err as Error)?.message ?? err)}`);
    topTracksCache.set(key, []);
    return [];
  }
}

// Cache por título+artista — evita refazer fetchLastfmTrackTags para a mesma faixa.
const tagsCache = new Map<string, string[]>();
async function getTagsCached(title: string, artist: string): Promise<string[]> {
  const key = `${normalizeKey(title)}|||${normalizeKey(artist)}`;
  if (tagsCache.has(key)) return tagsCache.get(key)!;
  const result = await fetchLastfmTrackTags(title, artist);
  const tags = result?.tags ?? [];
  tagsCache.set(key, tags);
  await sleep(120);
  return tags;
}

function mergeCandidates(all: Candidate[][]): Candidate[] {
  const byKey = new Map<string, Candidate>();
  for (const list of all) {
    for (const t of list) {
      const key = `${normalizeKey(t.track)}|||${normalizeKey(t.artist)}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.playcount += t.playcount;
      } else {
        byKey.set(key, { ...t });
      }
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.playcount - a.playcount);
}

type ResolvedSong = { id: string; spotifyId: string | null };

const spotifyResolveCache = new Map<string, ResolvedSong | null>();

const SIX_MONTHS_AGO = new Date(Date.now() - 183 * 24 * 60 * 60 * 1000);

async function resolveSongFromDb(title: string, artist: string): Promise<ResolvedSong | null> {
  const row = await prisma.song.findFirst({
    where: {
      title: { equals: title, mode: "insensitive" },
      artist: { contains: artist.split(",")[0]?.trim() ?? artist, mode: "insensitive" },
      createdAt: { gte: SIX_MONTHS_AGO },
    },
    select: { id: true, spotifyId: true },
  });
  return row ? { id: row.id, spotifyId: row.spotifyId } : null;
}

async function resolveSong(title: string, artist: string): Promise<ResolvedSong | null> {
  const key = `${normalizeKey(title)}|||${normalizeKey(artist)}`;
  if (spotifyResolveCache.has(key)) return spotifyResolveCache.get(key)!;

  // Só usa músicas já existentes no banco (criadas nos últimos 6 meses) — sem
  // fallback para busca no Spotify, para evitar rate limit e acelerar a criação em lote.
  const resolved = await resolveSongFromDb(title, artist);
  spotifyResolveCache.set(key, resolved);
  return resolved;
}

async function buildParadaSongs(row: Row): Promise<{ candidates: Candidate[]; matchedCount: number }> {
  const uniqueUsers = [...new Set(row.lastfmUsers)];
  const perUser = await Promise.all(uniqueUsers.map((u) => getTopTracksCached(u)));
  const merged = mergeCandidates(perUser).filter((c) => !isBannedArtist(c.artist));

  const matchers = row.genres.flatMap(genreMatchers);
  const matched: Candidate[] = [];
  const unmatched: Candidate[] = [];

  for (const c of merged) {
    const tags = await getTagsCached(c.track, c.artist);
    const isMatch = tags.some((tag) => matchers.some((m) => tag.includes(m)));
    if (isMatch) matched.push(c);
    else unmatched.push(c);
  }

  const combined = [...matched];
  if (combined.length < row.size) {
    combined.push(...unmatched.slice(0, row.size - combined.length));
  }

  return { candidates: combined.slice(0, row.size), matchedCount: matched.length };
}

async function processRow(row: Row, index: number, total: number) {
  console.log(`\n[${index + 1}/${total}] @${row.handle} — "${row.paradaName}" (${row.size} posições, gêneros: ${row.genres.join("/")})`);

  const user = await prisma.user.findUnique({ where: { handle: row.handle }, select: { id: true, handle: true } });
  if (!user) {
    console.log(`  [erro] usuário @${row.handle} não encontrado — pulando.`);
    return;
  }

  const paradaCount = await prisma.parada.count({ where: { userId: user.id } });
  if (paradaCount >= MAX_PARADAS_PER_USER) {
    console.log(`  [aviso] @${row.handle} já tem ${paradaCount} paradas (limite ${MAX_PARADAS_PER_USER}) — criando mesmo assim via script.`);
  }

  const existing = await prisma.parada.findFirst({
    where: { userId: user.id, name: { equals: row.paradaName, mode: "insensitive" } },
  });
  if (existing) {
    console.log(`  [skip] parada "${row.paradaName}" já existe (${existing.id}).`);
    return;
  }

  const { candidates, matchedCount } = await buildParadaSongs(row);
  console.log(`  [info] ${candidates.length}/${row.size} candidatas (${matchedCount} bateram tag de gênero, ${candidates.length - matchedCount} preenchidas sem filtro).`);

  if (!candidates.length) {
    console.log(`  [erro] nenhuma faixa encontrada — pulando.`);
    return;
  }

  const resolvedEntries: Array<{ position: number; song: ResolvedSong; title: string; artist: string }> = [];
  let position = 1;
  for (const c of candidates) {
    const resolved = await resolveSong(c.track, c.artist);
    if (!resolved) {
      console.log(`  [miss] não resolvida no Spotify: ${c.artist} - ${c.track}`);
      continue;
    }
    resolvedEntries.push({ position, song: resolved, title: c.track, artist: c.artist });
    position++;
  }

  if (!resolvedEntries.length) {
    console.log(`  [erro] nenhuma faixa resolvida no Spotify — pulando.`);
    return;
  }

  const targetDow = WEEKDAY_MAP[row.weekday.toUpperCase()];
  const publishLocalDate = currentWeekWeekdayDate(new Date(), targetDow);
  const publishedAt = publishAt8amBrt(publishLocalDate);
  const weekIndex = buildWeekIndexFromDate(publishLocalDate);
  const weekLabel = buildWeekLabelFromDate(publishLocalDate);
  const dateRange = buildDateRangeFromDate(publishLocalDate);
  const { start: weekStartDate } = getChartWeekRange(publishLocalDate);

  console.log(`  [info] publica ${row.weekday} ${publishLocalDate.toLocaleDateString("pt-BR")} 08:00 BRT (weekIndex ${weekIndex})`);

  if (DRY_RUN) {
    for (const e of resolvedEntries.slice(0, 10)) {
      console.log(`    #${e.position} ${e.artist} - ${e.title}`);
    }
    if (resolvedEntries.length > 10) console.log(`    ... +${resolvedEntries.length - 10} faixas`);
    return;
  }

  const sortOrder = await prisma.parada.count({ where: { userId: user.id } });
  const scoringTier = scoringTierFromPrimary(false);

  const parada = await prisma.parada.create({
    data: {
      userId: user.id,
      name: row.paradaName,
      genres: row.genres,
      isPrimary: false,
      sortOrder,
      chartSize: row.size,
      cadence: "WEEKLY",
    },
  });

  const entryPayload = resolvedEntries.map((e) => {
    const { palette, seed } = paletteFor(e.artist, e.title);
    return {
      position: e.position,
      songId: e.song.id,
      songSpotifyId: e.song.spotifyId,
      points: pointsForChartPosition(e.position, scoringTier, row.size, "WEEKLY"),
      status: "new",
      delta: null,
      prevPos: null,
      peak: e.position,
      weeks: 1,
      coverPaletteA: palette[0],
      coverPaletteB: palette[1],
      coverSeed: seed,
    };
  });

  await prisma.chart.create({
    data: {
      userId: user.id,
      paradaId: parada.id,
      weekIndex,
      weekLabel,
      dateRange,
      publishedAt,
      postedAt: publishedAt,
      weekStartDate,
      maxItems: row.size,
      isPublished: true,
      entries: { create: entryPayload },
    },
  });

  console.log(`  [ok] parada criada: ${parada.id} — ${entryPayload.length} entradas.`);
}

async function main() {
  const rows = ONLY ? ROWS.filter((r) => ONLY.has(r.handle.toLowerCase())) : ROWS;
  if (!rows.length) {
    console.log("Nenhuma linha selecionada (verifique --only=).");
    return;
  }
  for (let i = 0; i < rows.length; i++) {
    await processRow(rows[i], i, rows.length);
  }

  if (invalidLastfmUsers.size) {
    console.log(`\n[aviso] usuários Last.fm inválidos (verifique digitação na planilha): ${[...invalidLastfmUsers].join(", ")}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
