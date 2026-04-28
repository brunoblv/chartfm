/**
 * Corrige "Luz Sin Gravedad" (Belinda) para a faixa do álbum Utopía no Spotify,
 * não a edição/repack Utopía 2.
 *
 * Álbum de referência: https://open.spotify.com/album/0LB4KYFkN5TZgTmwPeCNq0
 *
 * Uso (raiz do chartify):
 *   npx tsx scripts/fix-belinda-luz-sin-gravedad-utopia-track.ts
 *   npx tsx scripts/fix-belinda-luz-sin-gravedad-utopia-track.ts --dry-run
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { prisma } from "../lib/prisma";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

function loadEnvFile() {
  const p = path.join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  const txt = readFileSync(p, "utf8");
  for (const line of txt.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

/** Spotify: Utopía (Belinda) — lista oficial inclui "Luz Sin Gravedad". */
const UTOPIA_ALBUM_SPOTIFY_ID = "0LB4KYFkN5TZgTmwPeCNq0";

/** Faixa "Luz Sin Gravedad" nesse álbum (confirmar via API no script). */
const UTOPIA_TRACK_SPOTIFY_ID = "60CEVNgCHcVyWCPy6Kh2K6";

const SONG_ID_CANDIDATES = [
  "11120e80235b4918ba8e54e4f8ba037b",
  "11120e80-235b-4918-ba8e-54e4f8ba037b",
] as const;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const song = await prisma.song.findFirst({
    where: {
      OR: [
        { id: { in: [...SONG_ID_CANDIDATES] } },
        {
          title: { equals: "Luz Sin Gravedad", mode: "insensitive" },
          artist: { contains: "Belinda", mode: "insensitive" },
        },
      ],
    },
    select: { id: true, title: true, artist: true, spotifyId: true, album: true },
  });

  if (!song) {
    console.error("Nenhuma Song encontrada (id conhecido ou título/artista Belinda).");
    process.exit(1);
  }

  const meta = await getSpotifyTrackMetadataById(UTOPIA_TRACK_SPOTIFY_ID, "MX");
  if (!meta) {
    console.error("Falha ao obter metadados do Spotify para a faixa.");
    process.exit(1);
  }

  if (meta.album.spotifyId !== UTOPIA_ALBUM_SPOTIFY_ID) {
    console.error(
      `Álbum devolvido pela API (${meta.album.spotifyId}) não bate com Utopía (${UTOPIA_ALBUM_SPOTIFY_ID}). Ajuste UTOPIA_TRACK_SPOTIFY_ID no script.`,
    );
    process.exit(1);
  }

  console.log("song", song);
  console.log("spotify_track", meta.title, meta.spotifyId, "album", meta.album.title, meta.album.spotifyId);

  const res = await applySpotifyMetadataToSong(song.id, meta, dryRun);
  if (!res.ok) {
    console.error("Falha:", res.reason);
    process.exit(1);
  }
  console.log(dryRun ? "dry_run_ok" : "updated_ok");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
