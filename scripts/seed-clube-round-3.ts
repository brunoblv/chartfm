/**
 * Insere a Rodada 3 do Clube do Álbum com a lista de indicações.
 *
 * Uso:
 *   npx tsx scripts/seed-clube-round-3.ts
 *   npx tsx scripts/seed-clube-round-3.ts --dry-run
 */

import { AlbumClubPhase, AlbumType, PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  getSpotifyAlbumDetails,
  getSpotifyArtistById,
  searchSpotifyAlbums,
  spotifyConfigured,
} from "../lib/spotify-server";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const ROUND_NUMBER = 3;
const ROUND_ID = "clube_round_003";
const THEME = "UM DISCO lançado no ano de 2006 e outro no ano de 2016";

/** artist | album title — ordem da lista fornecida */
const ALBUMS: { artist: string; title: string; search?: string; spotifyId?: string }[] = [
  { artist: "Belinda", title: "Utopia", search: "Belinda Utopia" },
  { artist: "Fresno", title: "A Sinfonia de Tudo Que Há", search: "Fresno A Sinfonia de Tudo Que Há" },
  { artist: "Cansei de Ser Sexy", title: "CSS", search: "Cansei de Ser Sexy CSS album" },
  { artist: "Majid Jordan", title: "Majid Jordan", search: "Majid Jordan Majid Jordan" },
  { artist: "Beyoncé", title: "B'Day", search: "Beyonce B'Day" },
  { artist: "Utada Hikaru", title: "Fantôme", search: "Utada Fantome" },
  { artist: "Red Hot Chili Peppers", title: "Stadium Arcadium", search: "Red Hot Chili Peppers Stadium Arcadium" },
  { artist: "Beyoncé", title: "Lemonade", search: "Beyonce Lemonade" },
  { artist: "Evanescence", title: "The Open Door", search: "Evanescence The Open Door" },
  { artist: "Sia", title: "This Is Acting", search: "Sia This Is Acting" },
  { artist: "Christina Aguilera", title: "Back to Basics", search: "Christina Aguilera Back to Basics" },
  { artist: "Britney Spears", title: "Glory", search: "Britney Spears Glory" },
  { artist: "Kelly Key", title: "Por Que Não?", search: "Kelly Key Por Que Não" },
  { artist: "Arctic Monkeys", title: "Whatever People Say I Am, That's What I'm Not", search: "Arctic Monkeys Whatever People Say" },
  { artist: "O Terno", title: "Melhor do Que Parece", spotifyId: "7nf6cMzbnj1BqhY5VBwT16" },
  { artist: "Rihanna", title: "ANTI", spotifyId: "48i37aZTC1prDr4EcpQeEa" },
  { artist: "Sandy e Junior", title: "Sandy & Junior", search: "Sandy e Junior Sandy & Junior" },
  { artist: "Biffy Clyro", title: "Ellipsis", search: "Biffy Clyro Ellipsis" },
  { artist: "Lily Allen", title: "Alright, Still", search: "Lily Allen Alright Still" },
  { artist: "Frank Ocean", title: "Blonde", search: "Frank Ocean Blonde" },
  { artist: "My Chemical Romance", title: "The Black Parade", search: "My Chemical Romance The Black Parade" },
  { artist: "Foxes", title: "All I Need", search: "Foxes All I Need album" },
];

function mapAlbumType(raw: string | null): AlbumType | undefined {
  if (!raw) return undefined;
  const v = raw.toUpperCase();
  if (v === "SINGLE" || v === "EP" || v === "ALBUM" || v === "COMPILATION") return v as AlbumType;
  return undefined;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureAlbumInDb(spotifyAlbumId: string): Promise<number> {
  const existing = await prisma.album.findUnique({
    where: { spotifyId: spotifyAlbumId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const details = await getSpotifyAlbumDetails(spotifyAlbumId);
  if (!details?.artistSpotifyId) throw new Error(`Detalhes incompletos: ${spotifyAlbumId}`);

  const artistProfile = await getSpotifyArtistById(details.artistSpotifyId);
  await prisma.artist.upsert({
    where: { spotifyId: details.artistSpotifyId },
    update: {
      name: artistProfile?.name ?? details.artistName ?? "Artista",
      genres: artistProfile?.genres ?? [],
      ...(artistProfile?.spotifyUrl ? { spotifyUrl: artistProfile.spotifyUrl } : {}),
      ...(artistProfile?.imageUrl ? { imageUrl: artistProfile.imageUrl } : {}),
    },
    create: {
      spotifyId: details.artistSpotifyId,
      name: artistProfile?.name ?? details.artistName ?? "Artista",
      genres: artistProfile?.genres ?? [],
      spotifyUrl: artistProfile?.spotifyUrl ?? null,
      imageUrl: artistProfile?.imageUrl ?? null,
    },
  });

  const album = await prisma.album.upsert({
    where: { spotifyId: spotifyAlbumId },
    update: {
      title: details.title,
      coverUrl: details.coverUrl ?? null,
      spotifyUrl: details.spotifyUrl ?? null,
    },
    create: {
      spotifyId: spotifyAlbumId,
      title: details.title,
      artistSpotifyId: details.artistSpotifyId,
      albumType: mapAlbumType(details.albumType),
      releaseDate: details.releaseDate ? new Date(`${details.releaseDate}T12:00:00.000Z`) : null,
      coverUrl: details.coverUrl ?? null,
      spotifyUrl: details.spotifyUrl ?? null,
      totalTracks: details.totalTracks ?? null,
      label: details.label ?? null,
    },
    select: { id: true },
  });

  return album.id;
}

async function resolveSpotifyId(entry: (typeof ALBUMS)[number]): Promise<string> {
  if (entry.spotifyId) return entry.spotifyId;

  const q = entry.search ?? `${entry.artist} ${entry.title}`;
  const hits = await searchSpotifyAlbums(q, 5);
  await sleep(250);

  if (!hits.length) throw new Error(`Spotify: nenhum resultado para "${q}"`);

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[''´`]/g, "'");

  const artistKey = norm(entry.artist);
  const titleKey = norm(entry.title);

  const scored = hits.map((h) => {
    const ha = norm(h.artist);
    const ht = norm(h.title);
    let score = 0;
    if (ha.includes(artistKey) || artistKey.includes(ha.split(",")[0] ?? "")) score += 2;
    if (ht.includes(titleKey) || titleKey.includes(ht)) score += 2;
    if (h.releaseDate?.startsWith("2006") || h.releaseDate?.startsWith("2016")) score += 1;
    return { h, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]?.h ?? hits[0];
  console.log(`  → ${best.artist} — ${best.title} (${best.spotifyId})`);
  return best.spotifyId;
}

async function ensureImportUsers(count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 1; i <= count; i++) {
    const handle = `clube_r3_import_${String(i).padStart(2, "0")}`;
    const user = await prisma.user.upsert({
      where: { handle },
      update: {},
      create: {
        handle,
        name: `Importação Clube R3 #${i}`,
        email: null,
      },
      select: { id: true },
    });
    ids.push(user.id);
  }
  return ids;
}

function buildSchedule() {
  const now = new Date();
  const nominationsOpenAt = new Date(now);
  nominationsOpenAt.setDate(nominationsOpenAt.getDate() - 5);
  nominationsOpenAt.setHours(6, 0, 0, 0);

  const nominationsCloseAt = new Date(now);
  nominationsCloseAt.setHours(nominationsCloseAt.getHours() - 1);

  const pollCloseAt = new Date(now);
  pollCloseAt.setDate(pollCloseAt.getDate() + 2);
  pollCloseAt.setHours(20, 0, 0, 0);

  const resultCloseAt = new Date(pollCloseAt);
  const listeningCloseAt = new Date(now);
  listeningCloseAt.setDate(listeningCloseAt.getDate() + 7);
  listeningCloseAt.setHours(20, 0, 0, 0);

  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const fmt = (d: Date) => `${d.getDate()} ${months[d.getMonth()]}`;
  const dateRange = `${fmt(nominationsOpenAt)} – ${fmt(listeningCloseAt)} ${listeningCloseAt.getFullYear()}`;

  return {
    nominationsOpenAt,
    nominationsCloseAt,
    pollCloseAt,
    resultCloseAt,
    listeningCloseAt,
    dateRange,
    phase: AlbumClubPhase.POLL,
  };
}

async function main() {
  if (!spotifyConfigured()) {
    console.error("Spotify não configurado (.env SPOTIFY_CLIENT_ID / SECRET).");
    process.exit(1);
  }

  console.log(`Rodada ${ROUND_NUMBER} — ${ALBUMS.length} álbuns\n`);

  const albumIds: number[] = [];
  for (const entry of ALBUMS) {
    console.log(`Buscando: ${entry.artist} — ${entry.title}`);
    if (DRY_RUN) continue;
    const spotifyId = await resolveSpotifyId(entry);
    const dbId = await ensureAlbumInDb(spotifyId);
    albumIds.push(dbId);
  }

  if (DRY_RUN) {
    console.log("\n[dry-run] Nada gravado no banco.");
    return;
  }

  const otherActive = await prisma.albumClubRound.findFirst({
    where: { phase: { not: AlbumClubPhase.COMPLETED }, number: { not: ROUND_NUMBER } },
  });
  if (otherActive) {
    console.log(`\nEncerrando rodada ativa #${otherActive.number} (${otherActive.id})…`);
    await prisma.albumClubRound.update({
      where: { id: otherActive.id },
      data: { phase: AlbumClubPhase.COMPLETED },
    });
  }

  const schedule = buildSchedule();
  const userCount = Math.ceil(ALBUMS.length / 2);
  const userIds = await ensureImportUsers(userCount);

  await prisma.$transaction(async (tx) => {
    await tx.albumClubPollVote.deleteMany({ where: { roundId: ROUND_ID } });
    await tx.albumClubWinner.deleteMany({ where: { roundId: ROUND_ID } });
    await tx.albumClubNomination.deleteMany({ where: { roundId: ROUND_ID } });

    await tx.albumClubRound.upsert({
      where: { id: ROUND_ID },
      update: {
        number: ROUND_NUMBER,
        theme: THEME,
        dateRange: schedule.dateRange,
        phase: schedule.phase,
        nominationsOpenAt: schedule.nominationsOpenAt,
        nominationsCloseAt: schedule.nominationsCloseAt,
        pollCloseAt: schedule.pollCloseAt,
        resultCloseAt: schedule.resultCloseAt,
        listeningCloseAt: schedule.listeningCloseAt,
      },
      create: {
        id: ROUND_ID,
        number: ROUND_NUMBER,
        theme: THEME,
        dateRange: schedule.dateRange,
        phase: schedule.phase,
        nominationsOpenAt: schedule.nominationsOpenAt,
        nominationsCloseAt: schedule.nominationsCloseAt,
        pollCloseAt: schedule.pollCloseAt,
        resultCloseAt: schedule.resultCloseAt,
        listeningCloseAt: schedule.listeningCloseAt,
      },
    });

    let slot = 1;
    let userIdx = 0;
    for (let i = 0; i < albumIds.length; i++) {
      if (slot > 2) {
        slot = 1;
        userIdx++;
      }
      await tx.albumClubNomination.create({
        data: {
          roundId: ROUND_ID,
          userId: userIds[userIdx]!,
          albumId: albumIds[i]!,
          slot,
        },
      });
      slot++;
    }
  });

  console.log(`\n✓ Rodada #${ROUND_NUMBER} criada (${ROUND_ID})`);
  console.log(`  Tema: ${THEME}`);
  console.log(`  Fase: POLL (enquete aberta)`);
  console.log(`  ${albumIds.length} indicações`);
  console.log(`  Enquete até: ${schedule.pollCloseAt.toLocaleString("pt-BR")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
