/**
 * Importa linhas de parada no formato Crownnote (prev curr Artista – "Título" …)
 * para entradas existentes de um chart (ex.: posições 11–100 já vazias ou sobrescrever).
 *
 * Uso (na raiz do projeto):
 *   npx tsx scripts/import-crownnote-chart-fragment.ts --dry-run
 *   npx tsx scripts/import-crownnote-chart-fragment.ts --file=./meu-chart.txt
 *   npx tsx scripts/import-crownnote-chart-fragment.ts --delay-ms=450 --market=US
 *
 * Variáveis editáveis abaixo: usuário alvo, data da semana, posição inicial/final, texto padrão.
 * Requer .env: DATABASE_URL, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { buildWeekIndexFromDate } from "../lib/chart-week";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, searchSpotifyTracks, spotifyConfigured } from "../lib/spotify-server";

const USER_HANDLE = "brunoxbubux";
/** Semana de referência (sexta-feira 24/04/2026 → mesmo weekIndex que o app usa). */
const WEEK_REF = new Date(2026, 3, 24);
const POSITION_FROM = 11;
const POSITION_TO = 100;

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function isoWeeksInYear(year: number): number {
  return isoWeek(new Date(Date.UTC(year, 11, 28)));
}

function prevWeekIndex(index: number): number {
  const year = Math.floor(index / 100);
  const week = index % 100;
  if (week > 1) return year * 100 + (week - 1);
  const prevYear = year - 1;
  return prevYear * 100 + isoWeeksInYear(prevYear);
}

function loadEnvFile() {
  const p = path.join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Linha Crownnote: prev (número ou NE), posição atual, artista, título entre aspas (travessão ou hífen antes das aspas). */
const LINE_RE = /^(\d+|NE)\s+(\d+)\s+(.+?)\s+(?:–|-)\s*"([^"]+)"\s*(.*)$/i;

/** Aspas tipográficas (“ ”) e travessões comuns ao colar do Crownnote / Word. */
function normalizePastedLine(s: string): string {
  return s
    .replace(/\u201c|\u201d|\u201e|\u00ab|\u00bb/g, '"')
    .replace(/\u2013|\u2014|\u2212/g, "-")
    .replace(/\u00a0/g, " ");
}

type ParsedRow = {
  prevRaw: string;
  curr: number;
  artist: string;
  title: string;
};

function parseCrownnoteBody(raw: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^https?:\/\//i.test(trimmed)) continue;
    if (/^DROPOUTS/i.test(trimmed)) break;
    const m = normalizePastedLine(trimmed).match(LINE_RE);
    if (!m) continue;
    const prevRaw = m[1];
    const curr = parseInt(m[2], 10);
    if (!Number.isFinite(curr)) continue;
    rows.push({
      prevRaw,
      curr,
      artist: m[3].trim(),
      title: m[4].trim(),
    });
  }
  return rows
    .filter((r) => r.curr >= POSITION_FROM && r.curr <= POSITION_TO)
    .sort((a, b) => a.curr - b.curr);
}

const DEFAULT_CROWNNOTE_SNIPPET = `
2 1 Harry Styles – "American Girls" 1(×1) 8
3 2 Slayyyter – "CRANK" 2 15
7 3 Sabrina Carpenter – "House Tour" 3 4
1 4 Holly Humberstone – "To Love Somebody" 1(×1) 12
5 5 Charlie Puth ft. Utada Hikaru – "Home" 5 8
11 6 Lady Gaga & Doechii – "RUNWAY" 6 4
8 7 Hilary Duff – "Weather for Tennis" 7 8
6 8 Jessie Ware – "Ride" 6 9
17 9 Bebe Rexha & Faithless – "New Religion" 9 5
14 10 METTE – "ANXIOUS TO LOVE YOU" 10 8
4 11 Capitão Fausto – "Escolhas" 1(×1) 14
10 12 Arlo Parks – "2SIDED" 8 13
15 13 Slayyyter – "OLD TECHNOLOGY" 13 5
22 14 The Strokes – "Going Shopping" 14 4
12 15 Lana Del Rey – "White Feather Hawk Tail Deer Hunter" 11 8
16 16 Danny L Harle & Dua Lipa – "Two Hearts" 16 9
9 17 Charlie Puth – "Beat Yourself Up" 1(×1) 13
23 18 Mitski – "I'll Change for You" 18 9
24 19 Brigitte Calls Me Baby – "I Danced with Another Love In My Dream" 19 8
25 20 Slayyyter – "DANCE..." 20 11
21 21 James Blake – "I Had a Dream She Took My Hand" 21 6
38 22 CA7RIEL & Paco Amoroso ft. Sting – "HASTA JESÚS TUVO UN MAL DÍA" 22 5
33 23 SIENNA SPIRO – "Die On This Hill" 10 15
20 24 Waterbaby – "Memory Be a Blade" 17 8
54 25 sombr – "Potential" 25 2
18 26 Haute & Freddy – "Dance the Pain Away" 8 13
84 27 Olivia Rodrigo – "drop dead" 27 2
28 28 Robyn – "Talk to Me" 1(×1) 16
13 29 FKA twigs – "Love Crimes" 13 11
37 30 Charlie Puth & Kenny G – "Cry" 30 4
42 31 underscores – "Tell Me (U Want It)" 31 5
39 32 beabadoobee ft. The Marías – "All I Did Was Dream of You" 32 3
29 33 Hilary Duff – "Roommates" 1(×1) 13
19 34 KiiiKiii – "404 (New Era)" 15 9
44 35 BLACKPINK – "GO" 35 4
47 36 Lykke Li – "Lucky Again" 36 5
58 37 Tsatsamis – "Recreational" 37 5
31 38 Westside Cowboy – "Can't See" 29 10
34 39 Harry Styles – "Aperture" 1(×1) 15
41 40 Arlo Parks – "Heaven" 40 9
30 41 Amber Mark ft. Anderson .Paak – "Don't Remind Me" 1(×1) 18
35 42 Young The Giant – "Different Kind Of Love" 35 9
36 43 PinkPantheress & Zara Larsson – "Stateside" 7 10
46 44 dexter in the newsagent – "Stranger to Love" 44 10
52 45 James Blake – "Death of Love" 13 13
49 46 PONY – "Superglue" 46 6
27 47 sombr – "Homewrecker" 15 9
51 48 Chet Faker – "Over You" 48 7
89 49 Holly Humberstone – "Cruel World" 49 2
53 50 Sofi Tukker ft. J Balvin – "COOK" 50 6
62 51 Angèle ft. Justice – "What You Want" 51 4
26 52 KATSEYE – "Internet Girl" 13 10
65 53 Marmozets – "Running With The Sun In Your Eyes" 53 3
40 54 Naomi Scott – "Losing You" 40 11
82 55 Kacey Musgraves – "Dry Spell" 55 3
48 56 Usted Señalemelo – "Deseo" 48 6
64 57 Melanie C – "What Could Possibly Go Wrong?" 57 4
NE 58 Suki Waterhouse – "Back in Love" 58 1
55 59 Addison Rae – "Aquamarine" 5 15
45 60 Addison Rae – "Headphones On" 1(×1) 37
68 61 Lola Young – "Post Sex Clarity" 61 6
72 62 Bazzi – "moment" 62 3
43 63 Jon Bellion & Swae Lee – "Two Car Garage" 37 9
60 64 Softcult – "Pill To Swallow" 60 6
32 65 The Boxer Rebellion – "Hidden Meanings" 25 8
71 66 2BYG – "Karma" 66 5
80 67 Baby Keem ft. Kendrick Lamar & Momo Boyd – "Good Flirts" 67 2
74 68 Chalk – "Tongue" 68 3
66 69 5 Seconds of Summer – "Everyone's a Star!" 66 5
75 70 Cruz Beckham – "for your love" 70 4
57 71 Addison Rae – "High Fashion" 1(×1) 44
63 72 Robyn – "Dopamine" 1(×1) 24
56 73 Lola Young – "d£aler" 5 18
88 74 Temples – "Jet Stream Heart" 74 3
79 75 Iceage – "Star" 75 3
83 76 Ditonellapiaga – "Che fastidio!" 76 4
59 77 Good Neighbours – "Somebody" 59 6
50 78 Bleachers – "You and Forever" 50 8
NE 79 My New Band Believe – "Love Story" 79 1
85 80 Fcukers – "Beatback" 80 3
78 81 Benjamin Steer – "Trophy" 78 5
86 82 My First Time – "Celebrity" 82 2
73 83 Biffy Clyro – "Goodbye" 9 18
61 84 KNEECAP – "Liars Tale" 29 12
90 85 BAYLI ft. Banoffee – "Monster" 85 4
NE 86 Muse – "Be With You" 86 1
91 87 Mitski – "If I Leave" 87 2
93 88 Death Cab for Cutie – "Riptides" 88 2
94 89 SIENNA SPIRO – "The Visitor" 89 2
NE 90 Niall Horan – "Dinner Party" 90 1
95 91 flowerovlove – "Casual Lady" 91 3
97 92 MUNA – "So What" 92 2
NE 93 Nessa Barrett – "Buffalo 66" 93 1
98 94 Haute & Freddy – "Showgirl at Heart" 94 2
99 95 Violet Grohl – "595" 95 2
NE 96 Borderline – "Watching It Burn" 96 1
NE 97 Pond – "Terrestrials" 97 1
100 98 Spacey Jane – "Do You Really Love Her" 98 2
NE 99 Young The Giant – "Bitter Fruit" 99 1
NE 100 FLO – "Leak It" 100 1
DROPOUTS:
`;

const PALETTES: [string, string][] = [
  ["#FF6B6B", "#FFE66D"],
  ["#4ECDC4", "#556270"],
  ["#C7F464", "#4ECDC4"],
  ["#FF8C94", "#FFAAA5"],
  ["#A8E6CF", "#3D5A80"],
  ["#E07856", "#F2D8A7"],
  ["#2E294E", "#EA698B"],
  ["#1B2021", "#FFD166"],
  ["#EF476F", "#06D6A0"],
  ["#073B4C", "#FFD166"],
  ["#8338EC", "#FB5607"],
];

function paletteFor(artist: string, title: string) {
  const key = artist + title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return { palette: PALETTES[Math.abs(hash) % PALETTES.length], seed: Math.abs(hash) };
}

async function findSongInDb(artist: string, title: string) {
  const a = artist.trim();
  const t = title.trim();
  return prisma.song.findFirst({
    where: {
      title: { equals: t, mode: "insensitive" },
      artist: { equals: a, mode: "insensitive" },
    },
    select: { id: true, spotifyId: true, albumSpotifyId: true },
  });
}

async function ensureSongWithSpotify(
  artist: string,
  title: string,
  market: string,
  delayMs: number,
): Promise<{ id: string; spotifyId: string | null; albumSpotifyId: string | null } | null> {
  let song = await findSongInDb(artist, title);
  if (song?.spotifyId) {
    return { id: song.id, spotifyId: song.spotifyId, albumSpotifyId: song.albumSpotifyId };
  }

  if (song && !song.spotifyId) {
    await sleep(delayMs);
    const hits = await searchSpotifyTracks(`${artist} ${title}`, 10, market);
    if (!hits.length) {
      console.error(`NO_SPOTIFY_HIT "${title}" — ${artist}`);
      return null;
    }
    await sleep(delayMs);
    const meta = await getSpotifyTrackMetadataById(hits[0].spotifyId, market);
    if (!meta) {
      console.error(`NO_META ${hits[0].spotifyId} "${title}"`);
      return null;
    }
    const res = await applySpotifyMetadataToSong(song.id, meta, false);
    if (!res.ok) {
      if (res.reason.startsWith("spotify_id_conflict:")) {
        const otherId = res.reason.split(":")[1];
        await prisma.song.delete({ where: { id: song.id } }).catch(() => {});
        const other = await prisma.song.findUnique({
          where: { id: otherId },
          select: { id: true, spotifyId: true, albumSpotifyId: true },
        });
        return other ?? null;
      }
      console.error(`APPLY_FAIL "${title}"`, res);
      return null;
    }
    const updated = await prisma.song.findUnique({
      where: { id: song.id },
      select: { id: true, spotifyId: true, albumSpotifyId: true },
    });
    return updated;
  }

  await sleep(delayMs);
  const hits = await searchSpotifyTracks(`${artist} ${title}`, 10, market);
  if (!hits.length) {
    console.error(`NO_SPOTIFY_HIT "${title}" — ${artist}`);
    return null;
  }
  await sleep(delayMs);
  const meta = await getSpotifyTrackMetadataById(hits[0].spotifyId, market);
  if (!meta?.primaryArtist) {
    console.error(`NO_META ${hits[0].spotifyId}`);
    return null;
  }

  const created = await prisma.song.create({
    data: {
      title,
      artist,
      album: null,
    },
    select: { id: true },
  });

  const res = await applySpotifyMetadataToSong(created.id, meta, false);
  if (!res.ok) {
    if (res.reason.startsWith("spotify_id_conflict:")) {
      const otherId = res.reason.split(":")[1];
      await prisma.song.delete({ where: { id: created.id } }).catch(() => {});
      const other = await prisma.song.findUnique({
        where: { id: otherId },
        select: { id: true, spotifyId: true, albumSpotifyId: true },
      });
      if (other) await applySpotifyMetadataToSong(other.id, meta, false);
      return other ?? null;
    }
    console.error(`APPLY_FAIL`, res);
    await prisma.song.delete({ where: { id: created.id } }).catch(() => {});
    return null;
  }

  return prisma.song.findUnique({
    where: { id: created.id },
    select: { id: true, spotifyId: true, albumSpotifyId: true },
  });
}

function entryStatus(prevRaw: string, curr: number, prevNum: number | null): { status: string; delta: number | null; prevPos: number | null } {
  if (prevRaw === "NE" || prevNum == null) {
    return { status: "new", delta: null, prevPos: null };
  }
  const delta = prevNum - curr;
  if (delta > 0) return { status: "up", delta, prevPos: prevNum };
  if (delta < 0) return { status: "down", delta, prevPos: prevNum };
  return { status: "same", delta: 0, prevPos: prevNum };
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const fileArg = argv.find((a) => a.startsWith("--file="));
  const delayArg = argv.find((a) => a.startsWith("--delay-ms="));
  const delayMs = delayArg ? Math.max(0, parseInt(delayArg.split("=")[1] ?? "400", 10) || 400) : 400;
  const marketArg = argv.find((a) => a.startsWith("--market="));
  const market = (marketArg?.split("=")[1] ?? "US").trim() || "US";

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const filePath = fileArg ? fileArg.slice("--file=".length).trim() : "";
  const raw = filePath
    ? readFileSync(path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath), "utf8")
    : DEFAULT_CROWNNOTE_SNIPPET;

  const rows = parseCrownnoteBody(raw);
  console.log(JSON.stringify({ linhas_11_a_100: rows.length, weekIndex: buildWeekIndexFromDate(WEEK_REF), handle: USER_HANDLE, dryRun, delayMs, market }));

  const user = await prisma.user.findFirst({
    where: { handle: { equals: USER_HANDLE, mode: "insensitive" } },
    select: { id: true, handle: true },
  });
  if (!user) {
    console.error("Usuário não encontrado:", USER_HANDLE);
    process.exit(1);
  }

  const weekIndex = buildWeekIndexFromDate(WEEK_REF);
  const chart = await prisma.chart.findUnique({
    where: { userId_weekIndex: { userId: user.id, weekIndex } },
    include: { entries: { orderBy: { position: "asc" } } },
  });
  if (!chart) {
    console.error("Chart não encontrado para user+weekIndex:", user.id, weekIndex);
    process.exit(1);
  }

  const prevIdx = prevWeekIndex(weekIndex);
  const prevChart = await prisma.chart.findFirst({
    where: { userId: user.id, weekIndex: prevIdx },
    include: { entries: true },
  });
  const prevBySongId = new Map(prevChart?.entries.map((e) => [e.songId, e]) ?? []);

  let ok = 0;
  let fail = 0;

  if (dryRun) {
    for (const r of rows) {
      const inDb = await findSongInDb(r.artist, r.title);
      console.log(
        `DRY pos ${r.curr} "${r.title}" — ${r.artist} | já na base: ${inDb ? "sim" + (inDb.spotifyId ? " (com Spotify)" : "") : "não"}`,
      );
      ok += 1;
    }
    console.log(JSON.stringify({ ok, fail: 0, dryRun: true }));
    return;
  }

  for (const r of rows) {
    const prevNum = r.prevRaw === "NE" ? null : parseInt(r.prevRaw, 10);
    const { status, delta, prevPos } = entryStatus(r.prevRaw, r.curr, prevNum);
    const points = 101 - r.curr;
    const { palette, seed } = paletteFor(r.artist, r.title);

    const songRow = await ensureSongWithSpotify(r.artist, r.title, market, delayMs);
    if (!songRow) {
      fail += 1;
      continue;
    }

    const prevEntry = prevBySongId.get(songRow.id);
    let peak = r.curr;
    let weeks = 1;
    let finalStatus = status;
    let finalDelta = delta;
    let finalPrevPos = prevPos;

    if (prevEntry) {
      finalDelta = prevEntry.position - r.curr;
      finalPrevPos = prevEntry.position;
      finalStatus = finalDelta > 0 ? "up" : finalDelta < 0 ? "down" : "same";
      peak = Math.min(r.curr, prevEntry.peak);
      weeks = prevEntry.weeks + 1;
    } else {
      peak = prevNum != null ? Math.min(r.curr, prevNum) : r.curr;
    }

    await prisma.chartEntry.upsert({
      where: {
        chartId_position: { chartId: chart.id, position: r.curr },
      },
      create: {
        chartId: chart.id,
        songId: songRow.id,
        position: r.curr,
        points,
        songSpotifyId: songRow.spotifyId,
        albumSpotifyId: songRow.albumSpotifyId,
        status: finalStatus,
        delta: finalDelta,
        prevPos: finalPrevPos,
        peak,
        weeks,
        coverPaletteA: palette[0],
        coverPaletteB: palette[1],
        coverSeed: seed,
      },
      update: {
        songId: songRow.id,
        points,
        songSpotifyId: songRow.spotifyId,
        albumSpotifyId: songRow.albumSpotifyId,
        status: finalStatus,
        delta: finalDelta,
        prevPos: finalPrevPos,
        peak,
        weeks,
        coverPaletteA: palette[0],
        coverPaletteB: palette[1],
        coverSeed: seed,
      },
    });
    ok += 1;
    console.log(`OK pos ${r.curr} "${r.title}" — ${r.artist}`);
  }

  console.log(JSON.stringify({ ok, fail, dryRun }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
