/**
 * Configura manualmente a música "Shout To The Lord" com artista
 * "American Idol 7 Top 8" e álbum "Shout To The Lord" (entrada manual,
 * sem Spotify).
 *
 * Uso: npx tsx scripts/fix-shout-to-the-lord-american-idol.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

const ARTIST_NAME = "American Idol 7 Top 8";
const ARTIST_SPOTIFY_ID = "manual_american-idol-7-top-8";
const ALBUM_TITLE = "Shout To The Lord";
const ALBUM_SPOTIFY_ID = "manual_american-idol-7-top-8_shout-to-the-lord";
const SONG_TITLE_CANONICAL = "Shout To The Lord";

// Termos para encontrar variações do título na base
const TITLE_VARIANTS = ["Shout To The Lord", "Shout Out to the Lord", "Shout to the Lord"];

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // 1. Buscar todas as Songs que se enquadrem nas variações
  const songs = await prisma.song.findMany({
    where: {
      OR: TITLE_VARIANTS.map((t) => ({ title: { equals: t, mode: "insensitive" as const } })),
    },
    select: {
      id: true,
      title: true,
      artist: true,
      album: true,
      spotifyId: true,
      artistSpotifyId: true,
      albumSpotifyId: true,
      _count: { select: { entries: true } },
    },
    orderBy: { id: "asc" },
  });

  console.log("=== Songs encontradas ===");
  console.log(JSON.stringify(songs, null, 2));

  if (songs.length === 0) {
    console.error("Nenhuma Song encontrada com os títulos buscados.");
    process.exit(1);
  }

  // Canônica = a que tem mais entradas, ou a primeira
  const canonical =
    songs.reduce((best, s) => (s._count.entries >= best._count.entries ? s : best), songs[0]);

  console.log(`\n→ Song canônica: id=${canonical.id} | "${canonical.title}" — ${canonical.artist}`);
  console.log(`  Entradas nas paradas: ${canonical._count.entries}`);

  // 2. Upsert artist
  if (!dryRun) {
    await prisma.artist.upsert({
      where: { spotifyId: ARTIST_SPOTIFY_ID },
      update: { name: ARTIST_NAME },
      create: { spotifyId: ARTIST_SPOTIFY_ID, name: ARTIST_NAME },
    });
    console.log("\n✓ Artista upserted:", ARTIST_NAME, ARTIST_SPOTIFY_ID);
  } else {
    console.log("\nDRY upsert artista:", ARTIST_NAME, ARTIST_SPOTIFY_ID);
  }

  // 3. Upsert album (sem cover por enquanto — upload via UI)
  if (!dryRun) {
    await prisma.album.upsert({
      where: { spotifyId: ALBUM_SPOTIFY_ID },
      update: { title: ALBUM_TITLE, artistSpotifyId: ARTIST_SPOTIFY_ID },
      create: {
        spotifyId: ALBUM_SPOTIFY_ID,
        title: ALBUM_TITLE,
        artistSpotifyId: ARTIST_SPOTIFY_ID,
        albumType: "SINGLE",
      },
    });
    console.log("✓ Álbum upserted:", ALBUM_TITLE, ALBUM_SPOTIFY_ID);
  } else {
    console.log("DRY upsert álbum:", ALBUM_TITLE, ALBUM_SPOTIFY_ID);
  }

  // 4. Atualizar a song canônica
  if (!dryRun) {
    await prisma.song.update({
      where: { id: canonical.id },
      data: {
        title: SONG_TITLE_CANONICAL,
        artist: ARTIST_NAME,
        artistSpotifyId: ARTIST_SPOTIFY_ID,
        album: ALBUM_TITLE,
        albumSpotifyId: ALBUM_SPOTIFY_ID,
        spotifyId: null, // sem Spotify
      },
    });
    console.log("✓ Song canônica atualizada:", canonical.id);
  } else {
    console.log("DRY update song:", canonical.id, "→", SONG_TITLE_CANONICAL, "/", ARTIST_NAME);
  }

  // 5. Mesclar duplicatas (se houver) para a canônica
  for (const dup of songs) {
    if (dup.id === canonical.id) continue;
    const entryCount = await prisma.chartEntry.count({ where: { songId: dup.id } });
    console.log(`\nDuplicata: id=${dup.id} "${dup.title}" — ${dup.artist} | entradas=${entryCount}`);

    if (!dryRun && entryCount > 0) {
      await prisma.chartEntry.updateMany({
        where: { songId: dup.id },
        data: {
          songId: canonical.id,
          songSpotifyId: null,
          albumSpotifyId: ALBUM_SPOTIFY_ID,
        },
      });
      console.log(`  ✓ ${entryCount} entradas movidas para a canônica`);
    } else if (dryRun) {
      console.log(`  DRY move ${entryCount} entradas`);
    }

    if (!dryRun) {
      const remaining = await prisma.chartEntry.count({ where: { songId: dup.id } });
      if (remaining === 0) {
        await prisma.song.delete({ where: { id: dup.id } });
        console.log(`  ✓ Duplicata deletada: ${dup.id}`);
      }
    }
  }

  // 6. Atualizar albumSpotifyId nas entradas da song canônica
  if (!dryRun) {
    const updated = await prisma.chartEntry.updateMany({
      where: { songId: canonical.id },
      data: { albumSpotifyId: ALBUM_SPOTIFY_ID, songSpotifyId: null },
    });
    console.log(`\n✓ ${updated.count} ChartEntry(s) com albumSpotifyId atualizado`);
  } else {
    const count = await prisma.chartEntry.count({ where: { songId: canonical.id } });
    console.log(`\nDRY update ${count} ChartEntry(s) albumSpotifyId → ${ALBUM_SPOTIFY_ID}`);
  }

  console.log(dryRun ? "\n=== DRY RUN concluído ===" : "\n=== Concluído! ===");
  console.log("Próximo passo: fazer upload da capa do álbum na página de edição do álbum.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
