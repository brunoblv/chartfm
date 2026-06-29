import { existsSync, readFileSync } from "fs";
import { join } from "path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

for (const name of [".env", ".env.local"]) {
  loadEnvFile(join(process.cwd(), name));
}

import { resolveMusicBrainzSongGenres, getMusicBrainzReleaseDates } from "../lib/musicbrainz";
import { getYouTubeMusicVideoReleaseDate } from "../lib/youtube-music-video-date";

const title = process.argv[2] ?? "Satellite";
const artist = process.argv[3] ?? "Rise Against";

function fmt(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

async function main() {
  console.log(`=== ${title} — ${artist} ===\n`);

  const mb = await resolveMusicBrainzSongGenres({ title, artist });
  if (mb) {
    console.log("Recording MBID:", mb.mbid);
    console.log("Tags:", mb.tags.join(", ") || "(nenhuma)");
    const mbDates = await getMusicBrainzReleaseDates(mb.mbid, { title, artist });
    console.log("\n--- MusicBrainz ---");
    console.log("Single:      ", fmt(mbDates.singleReleaseDate));
    console.log("Music video: ", fmt(mbDates.musicVideoReleaseDate));
  } else {
    console.log("Recording MBID: não encontrado");
  }

  const yt = await getYouTubeMusicVideoReleaseDate(title, artist);
  console.log("\n--- YouTube ---");
  console.log("Publicado:   ", fmt(yt.date));
  if (yt.videoId) console.log("Vídeo:       ", `https://www.youtube.com/watch?v=${yt.videoId}`);
  if (yt.title) console.log("Título:      ", yt.title);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
