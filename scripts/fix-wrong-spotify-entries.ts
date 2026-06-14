/**
 * Corrige entradas de parada com música errada no Spotify.
 * Busca a faixa correta pelo ID do Spotify e atualiza ChartEntry.songId.
 *
 * Usage:
 *   npx tsx scripts/fix-wrong-spotify-entries.ts --dry-run
 *   npx tsx scripts/fix-wrong-spotify-entries.ts
 *   npx tsx scripts/fix-wrong-spotify-entries.ts --handle=brunurbano
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

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
const HANDLE_ARG = process.argv.find((a) => a.startsWith("--handle="));
const HANDLE_FILTER = HANDLE_ARG ? HANDLE_ARG.split("=")[1] : null;

type FixRule = {
  spotifyId: string;
  aliases: { artist: string; title: string }[];
};

/** Texto da planilha → faixa correta no Spotify */
const FIXES: FixRule[] = [
  {
    spotifyId: "7BjcYqD0CqXnG45ezWSTYR",
    aliases: [{ artist: "Lady Gaga ft Doechii", title: "RUNAWAY" }],
  },
  {
    spotifyId: "6jtahhWFnTocDmYgyJzS1k",
    aliases: [
      { artist: "Gken Check", title: "Good Ttimes" },
      { artist: "Gleen Check", title: "Good Times" },
      { artist: "Glen Check", title: "Good Times" },
    ],
  },
  {
    spotifyId: "6bbWS27e099GTDcbpcbM9X",
    aliases: [
      { artist: "The Veronicas", title: "12 to 12 (cover)" },
      { artist: "The Veronicas ", title: "12 to 12 (cover)" },
    ],
  },
  {
    spotifyId: "5Y60BnKGNfUSaP2VHWbKCo",
    aliases: [
      {
        artist: "Baiana System, Pitty Tropkillaz e VANDAL",
        title: "COBRA CRIADA / Bicho Solto (refix)",
      },
    ],
  },
  {
    spotifyId: "3fEX9NgOeklq816Fw00uoo",
    aliases: [
      { artist: "XG", title: "HYPNOTIZED" },
      { artist: "XG", title: "HYPNOTIZED " },
      { artist: "XG", title: "HYPNOTIZE" },
    ],
  },
];

type SpotifyHit = {
  spotifyId: string;
  title: string;
  primaryArtistId: string | null;
  primaryArtistName: string | null;
  albumSpotifyId: string | null;
  albumTitle: string | null;
  albumType: "SINGLE" | "EP" | "ALBUM" | "COMPILATION" | null;
  albumCoverUrl: string | null;
  albumReleaseDate: Date | null;
  albumTotalTracks: number | null;
  albumSpotifyUrl: string | null;
  durationMs: number | null;
  trackNumber: number | null;
  previewUrl: string | null;
  spotifyUrl: string | null;
  featuredArtists: { spotifyId: string; name: string }[];
};

const spotifyState = { token: null as string | null, expiresAt: 0 };

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

function aliasKey(artist: string, title: string) {
  return `${norm(artist)}|${norm(title)}`;
}

async function getSpotifyToken(): Promise<string | null> {
  if (spotifyState.token && Date.now() < spotifyState.expiresAt) return spotifyState.token;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token: string; expires_in: number };
  spotifyState.token = data.access_token;
  spotifyState.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyState.token;
}

function mapTrackToHit(track: Record<string, unknown>): SpotifyHit {
  const artists = (track.artists as { id: string; name: string }[]) ?? [];
  const album = track.album as Record<string, unknown> | undefined;
  const images = (album?.images as { url: string }[]) ?? [];
  const release = album?.release_date as string | undefined;
  let albumReleaseDate: Date | null = null;
  if (release) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(release)) albumReleaseDate = new Date(`${release}T00:00:00Z`);
    else if (/^\d{4}-\d{2}$/.test(release)) albumReleaseDate = new Date(`${release}-01T00:00:00Z`);
    else if (/^\d{4}$/.test(release)) albumReleaseDate = new Date(`${release}-01-01T00:00:00Z`);
  }
  const albumTypeRaw = (album?.album_type as string | undefined)?.toUpperCase();
  const albumType =
    albumTypeRaw === "SINGLE" || albumTypeRaw === "EP" || albumTypeRaw === "ALBUM" || albumTypeRaw === "COMPILATION"
      ? albumTypeRaw
      : null;

  return {
    spotifyId: track.id as string,
    title: track.name as string,
    primaryArtistId: artists[0]?.id ?? null,
    primaryArtistName: artists[0]?.name ?? null,
    albumSpotifyId: (album?.id as string) ?? null,
    albumTitle: (album?.name as string) ?? null,
    albumType,
    albumCoverUrl: images[0]?.url ?? null,
    albumReleaseDate,
    albumTotalTracks: (album?.total_tracks as number) ?? null,
    albumSpotifyUrl: ((album?.external_urls as { spotify?: string })?.spotify) ?? null,
    durationMs: (track.duration_ms as number) ?? null,
    trackNumber: (track.track_number as number) ?? null,
    previewUrl: (track.preview_url as string) ?? null,
    spotifyUrl: ((track.external_urls as { spotify?: string })?.spotify) ?? null,
    featuredArtists: artists.slice(1).map((a) => ({ spotifyId: a.id, name: a.name })),
  };
}

async function fetchTrackById(trackId: string): Promise<SpotifyHit | null> {
  await sleep(150);
  const token = await getSpotifyToken();
  if (!token) return null;
  const res = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}?market=BR`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json?.id) return null;
  return mapTrackToHit(json);
}

async function upsertSongFromHit(hit: SpotifyHit, fallbackArtist: string) {
  if (hit.primaryArtistId) {
    await prisma.artist.upsert({
      where: { spotifyId: hit.primaryArtistId },
      update: { name: hit.primaryArtistName! },
      create: { spotifyId: hit.primaryArtistId, name: hit.primaryArtistName! },
    });
  }

  if (hit.albumSpotifyId && hit.primaryArtistId) {
    await prisma.album.upsert({
      where: { spotifyId: hit.albumSpotifyId },
      update: {
        title: hit.albumTitle ?? "Unknown",
        artistSpotifyId: hit.primaryArtistId,
        ...(hit.albumCoverUrl != null ? { coverUrl: hit.albumCoverUrl } : {}),
        ...(hit.albumReleaseDate != null ? { releaseDate: hit.albumReleaseDate } : {}),
        ...(hit.albumTotalTracks != null ? { totalTracks: hit.albumTotalTracks } : {}),
        ...(hit.albumType != null ? { albumType: hit.albumType } : {}),
        ...(hit.albumSpotifyUrl != null ? { spotifyUrl: hit.albumSpotifyUrl } : {}),
      },
      create: {
        spotifyId: hit.albumSpotifyId,
        title: hit.albumTitle ?? "Unknown",
        artistSpotifyId: hit.primaryArtistId,
        coverUrl: hit.albumCoverUrl ?? null,
        releaseDate: hit.albumReleaseDate ?? null,
        totalTracks: hit.albumTotalTracks ?? null,
        albumType: hit.albumType ?? null,
        spotifyUrl: hit.albumSpotifyUrl ?? null,
      },
    });
  }

  for (const feat of hit.featuredArtists) {
    await prisma.artist.upsert({
      where: { spotifyId: feat.spotifyId },
      update: { name: feat.name },
      create: { spotifyId: feat.spotifyId, name: feat.name },
    });
  }

  const canonicalArtist = hit.primaryArtistName ?? fallbackArtist;
  const spotifyData = {
    album: hit.albumTitle ?? undefined,
    artistSpotifyId: hit.primaryArtistId ?? undefined,
    albumSpotifyId: hit.albumSpotifyId ?? undefined,
    durationMs: hit.durationMs ?? undefined,
    previewUrl: hit.previewUrl ?? undefined,
    spotifyUrl: hit.spotifyUrl ?? undefined,
    trackNumber: hit.trackNumber ?? undefined,
  };

  const existingByName = await prisma.song.findFirst({
    where: { title: hit.title, artist: canonicalArtist },
    select: { id: true, spotifyId: true, albumSpotifyId: true },
  });

  if (existingByName) {
    return prisma.song.update({
      where: { id: existingByName.id },
      data: {
        ...(existingByName.spotifyId == null ? { spotifyId: hit.spotifyId } : {}),
        ...spotifyData,
      },
      select: { id: true, spotifyId: true, albumSpotifyId: true, title: true, artist: true },
    });
  }

  return prisma.song.upsert({
    where: { spotifyId: hit.spotifyId },
    update: { title: hit.title, artist: canonicalArtist, ...spotifyData },
    create: {
      title: hit.title,
      artist: canonicalArtist,
      album: hit.albumTitle ?? null,
      spotifyId: hit.spotifyId,
      artistSpotifyId: hit.primaryArtistId ?? null,
      albumSpotifyId: hit.albumSpotifyId ?? null,
      durationMs: hit.durationMs ?? null,
      previewUrl: hit.previewUrl ?? null,
      spotifyUrl: hit.spotifyUrl ?? null,
      trackNumber: hit.trackNumber ?? null,
    },
    select: { id: true, spotifyId: true, albumSpotifyId: true, title: true, artist: true },
  });
}

async function findWrongSongs(rule: FixRule) {
  const aliasSet = new Set(rule.aliases.map((a) => aliasKey(a.artist, a.title)));
  const candidates = await prisma.song.findMany({
    where: {
      OR: rule.aliases.flatMap((a) => [
        { artist: a.artist, title: a.title },
        { artist: a.artist.trim(), title: a.title.trim() },
      ]),
    },
    select: { id: true, artist: true, title: true, spotifyId: true },
  });

  return candidates.filter(
    (s) => aliasSet.has(aliasKey(s.artist, s.title)) && s.spotifyId !== rule.spotifyId,
  );
}

async function resolveCorrectSong(rule: FixRule, hit: SpotifyHit) {
  const inDb = await prisma.song.findUnique({
    where: { spotifyId: rule.spotifyId },
    select: { id: true, spotifyId: true, albumSpotifyId: true, title: true, artist: true },
  });
  if (inDb) {
    console.log(`  Faixa correta já no banco: song ${inDb.id} (${inDb.artist} — "${inDb.title}")`);
    return inDb;
  }
  const created = await upsertSongFromHit(hit, rule.aliases[0].artist);
  console.log(`  Faixa correta criada/atualizada: song ${created.id} (${created.artist} — "${created.title}")`);
  return created;
}

async function main() {
  console.log("\n=== Corrigir entradas com Spotify errado ===");
  if (DRY_RUN) console.log("(dry-run — nenhuma alteração será salva)\n");
  if (HANDLE_FILTER) console.log(`Filtro: @${HANDLE_FILTER}\n`);

  let totalFixed = 0;
  let totalSkipped = 0;

  for (const rule of FIXES) {
    const hit = await fetchTrackById(rule.spotifyId);
    if (!hit) {
      console.error(`[ERRO] Não foi possível buscar faixa ${rule.spotifyId} no Spotify`);
      continue;
    }

    const wrongSongs = await findWrongSongs(rule);
    if (wrongSongs.length === 0) {
      console.log(`\n${rule.spotifyId} (${hit.primaryArtistName} — "${hit.title}")`);
      console.log("  Nenhuma música errada encontrada no banco.");
      continue;
    }

    const wrongSongIds = wrongSongs.map((s) => s.id);
    const entries = await prisma.chartEntry.findMany({
      where: {
        songId: { in: wrongSongIds },
        ...(HANDLE_FILTER
          ? { chart: { user: { handle: HANDLE_FILTER } } }
          : {}),
      },
      include: {
        song: { select: { artist: true, title: true, spotifyId: true } },
        chart: {
          select: {
            id: true,
            weekLabel: true,
            user: { select: { handle: true } },
            parada: { select: { name: true } },
          },
        },
      },
      orderBy: [{ chart: { weekIndex: "asc" } }, { position: "asc" }],
    });

    console.log(`\n${rule.spotifyId} → ${hit.primaryArtistName} — "${hit.title}"`);
    console.log(`  Músicas erradas: ${wrongSongs.length} | Entradas: ${entries.length}`);
    for (const s of wrongSongs) {
      console.log(`    song ${s.id}: "${s.artist}" — "${s.title}" (spotify=${s.spotifyId ?? "null"})`);
    }

    if (entries.length === 0) {
      totalSkipped++;
      continue;
    }

    let correctSong: { id: string; spotifyId: string | null; albumSpotifyId: string | null };
    if (!DRY_RUN) {
      correctSong = await resolveCorrectSong(rule, hit);
    } else {
      const inDb = await prisma.song.findUnique({
        where: { spotifyId: rule.spotifyId },
        select: { id: true, spotifyId: true, albumSpotifyId: true, title: true, artist: true },
      });
      correctSong = inDb ?? { id: "(dry-run)", spotifyId: hit.spotifyId, albumSpotifyId: hit.albumSpotifyId };
      if (inDb) {
        console.log(`  Faixa correta no banco: song ${inDb.id} (${inDb.artist} — "${inDb.title}")`);
      }
    }

    for (const entry of entries) {
      const label = `  @${entry.chart.user.handle} / ${entry.chart.parada.name} / ${entry.chart.weekLabel} #${entry.position}`;
      const wrongSp = entry.song.spotifyId ?? "null";
      if (DRY_RUN) {
        console.log(`${label}: ${entry.song.artist} — "${entry.song.title}" (${wrongSp}) → ${hit.spotifyId}`);
        totalFixed++;
        continue;
      }

      const dup = await prisma.chartEntry.findFirst({
        where: {
          chartId: entry.chart.id,
          songId: correctSong.id,
          id: { not: entry.id },
        },
        select: { position: true },
      });
      if (dup) {
        console.log(`${label}: PULADO — faixa correta já está na posição #${dup.position}`);
        totalSkipped++;
        continue;
      }

      await prisma.chartEntry.update({
        where: { id: entry.id },
        data: {
          songId: correctSong.id,
          songSpotifyId: correctSong.spotifyId,
          albumSpotifyId: correctSong.albumSpotifyId,
        },
      });
      console.log(`${label}: ${wrongSp} → ${hit.spotifyId} OK`);
      totalFixed++;
    }
  }

  console.log(`\n=== Concluído ===`);
  console.log(`  Corrigidas: ${totalFixed}`);
  console.log(`  Puladas:    ${totalSkipped}`);
}

main()
  .catch((err) => {
    console.error("\nErro fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
