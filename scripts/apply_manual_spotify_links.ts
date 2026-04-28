import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById } from "../lib/spotify-server";

type Mapping = {
  artist: string;
  title: string;
  trackId: string;
};

function loadMappings(filePath: string): Mapping[] {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const raw = readFileSync(abs, "utf8");
  const parsed = JSON.parse(raw) as Mapping[];
  return parsed;
}

async function main() {
  const argv = process.argv.slice(2);
  const fileArg = argv.find((a) => a.startsWith("--file="));
  const dryRun = argv.includes("--dry-run");
  const createMissing = argv.includes("--create-missing");
  const marketArg = argv.find((a) => a.startsWith("--market="));
  const market = marketArg?.split("=")[1] ?? "BR";

  const file = fileArg?.split("=")[1] ?? "scripts/manual_spotify_2010_batch1.json";
  const mappings = loadMappings(file);

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const m of mappings) {
    let song = await prisma.song.findUnique({
      where: { title_artist: { title: m.title, artist: m.artist } },
      select: { id: true, title: true, artist: true },
    });
    if (!song && createMissing && !dryRun) {
      song = await prisma.song.create({
        data: {
          title: m.title,
          artist: m.artist,
          album: null,
        },
        select: { id: true, title: true, artist: true },
      });
      console.log(`CREATED "${m.title}" — ${m.artist}`);
    }
    if (!song) {
      console.log(`SKIP song_not_found "${m.title}" — ${m.artist}`);
      skip += 1;
      continue;
    }

    const meta = await getSpotifyTrackMetadataById(m.trackId, market);
    if (!meta) {
      console.log(`SKIP meta_not_found ${m.trackId} "${m.title}"`);
      skip += 1;
      continue;
    }

    const res = await applySpotifyMetadataToSong(song.id, meta, dryRun);
    if (!res.ok) {
      console.log(`FAIL "${m.title}" — ${m.artist} :: ${res.reason}`);
      fail += 1;
      continue;
    }
    console.log(`${dryRun ? "DRY" : "OK"} "${m.title}" — ${m.artist} -> ${m.trackId}`);
    ok += 1;
  }

  console.log(JSON.stringify({ ok, skip, fail, dryRun, createMissing, market, file }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

