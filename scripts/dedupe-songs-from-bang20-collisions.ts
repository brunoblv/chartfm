/**
 * Corrige músicas duplicadas geradas por imports BANG20 antigos quando havia
 * colisão de spotify_id: a planilha tinha (title, artist) e criava Song sem Spotify,
 * enquanto a faixa canónica já existia com outro (title, artist) e o mesmo spotify_id.
 *
 * Lê JSONs `scripts/_bang20_*_spotify_id_collisions.json` (formato: title, artist, spotify_id).
 * Ignora entradas com reason `reused_existing_same_spotify_track` (só informativo).
 *
 * Uso (raiz do projeto):
 *   npx tsx scripts/dedupe-songs-from-bang20-collisions.ts --dry-run
 *   npx tsx scripts/dedupe-songs-from-bang20-collisions.ts --apply
 *   npx tsx scripts/dedupe-songs-from-bang20-collisions.ts --apply --file=scripts/_bang20_2026_spotify_id_collisions.json
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

type CollisionRow = {
  title: string;
  artist: string;
  spotify_id: string;
  reason?: string;
};

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

function parseArgs() {
  const wantsApply = process.argv.includes("--apply");
  const apply = wantsApply && !process.argv.includes("--dry-run");
  let file: string | null = null;
  for (const a of process.argv) {
    if (a.startsWith("--file=")) file = a.slice("--file=".length);
  }
  return { apply, file };
}

function collisionKey(r: CollisionRow): string {
  return `${r.spotify_id}\0${r.title}\0${r.artist}`;
}

function loadCollisionRows(scriptsDir: string, singleFile: string | null): CollisionRow[] {
  const seen = new Set<string>();
  const out: CollisionRow[] = [];

  const readFile = (abs: string) => {
    const raw = JSON.parse(readFileSync(abs, "utf8")) as CollisionRow[];
    if (!Array.isArray(raw)) return;
    for (const r of raw) {
      if (!r?.title || !r?.artist || !r?.spotify_id) continue;
      if (r.reason === "reused_existing_same_spotify_track") continue;
      const k = collisionKey(r);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  };

  if (singleFile) {
    const abs = path.isAbsolute(singleFile) ? singleFile : path.join(process.cwd(), singleFile);
    readFile(abs);
    return out;
  }

  const names = readdirSync(scriptsDir, { withFileTypes: true })
    .filter((d) => d.isFile() && /^_bang20_\d+_spotify_id_collisions\.json$/.test(d.name))
    .map((d) => d.name)
    .sort();
  for (const n of names) {
    readFile(path.join(scriptsDir, n));
  }
  return out;
}

async function main() {
  const { apply, file } = parseArgs();
  const scriptsDir = path.join(process.cwd(), "scripts");
  const rows = loadCollisionRows(scriptsDir, file);

  console.log(JSON.stringify({ dryRun: !apply, apply, rows: rows.length, file: file ?? "all _bang20_*_collisions in scripts/" }));

  let entriesUpdated = 0;
  let dupSongsRemoved = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const r of rows) {
    const spotifyId = r.spotify_id.trim();
    const [canon, dup] = await Promise.all([
      prisma.song.findFirst({
        where: { spotifyId },
        select: { id: true, title: true, artist: true, spotifyId: true, albumSpotifyId: true },
      }),
      prisma.song.findUnique({
        where: { title_artist: { title: r.title, artist: r.artist } },
        select: { id: true, title: true, artist: true, spotifyId: true, albumSpotifyId: true },
      }),
    ]);

    if (!canon) {
      errors.push(`no_canonical spotify_id=${spotifyId} sheet="${r.title}" — ${r.artist}`);
      skipped += 1;
      continue;
    }
    if (!dup) {
      skipped += 1;
      continue;
    }
    if (dup.id === canon.id) {
      skipped += 1;
      continue;
    }

    const nEntries = await prisma.chartEntry.count({ where: { songId: dup.id } });
    const songSpotifyId = canon.spotifyId?.trim() || null;
    const albumSpotifyId = canon.albumSpotifyId?.trim() || dup.albumSpotifyId?.trim() || null;

    console.log(
      JSON.stringify({
        action: apply ? "apply" : "would",
        dup: { id: dup.id, title: dup.title, artist: dup.artist, spotifyId: dup.spotifyId },
        canon: { id: canon.id, title: canon.title, artist: canon.artist },
        chartEntries: nEntries,
      }),
    );

    if (apply) {
      await prisma.$transaction(async (tx) => {
        const up = await tx.chartEntry.updateMany({
          where: { songId: dup.id },
          data: {
            songId: canon.id,
            songSpotifyId,
            albumSpotifyId,
          },
        });
        entriesUpdated += up.count;
        const left = await tx.chartEntry.count({ where: { songId: dup.id } });
        if (left === 0) {
          await tx.song.delete({ where: { id: dup.id } });
          dupSongsRemoved += 1;
        }
      });
    } else {
      entriesUpdated += nEntries;
    }
  }

  console.log(
    JSON.stringify({
      ok: true,
      apply,
      chart_entries_affected: entriesUpdated,
      dup_songs_deleted: apply ? dupSongsRemoved : 0,
      skipped,
      errors,
    }),
  );
  if (errors.length) console.error(errors.join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
