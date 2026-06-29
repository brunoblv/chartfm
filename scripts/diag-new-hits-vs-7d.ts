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

import { fetchTopTracks } from "../lib/lastfm";
import {
  findNewHitsPlaylistId,
  getMyTrlOwnerUser,
  getPlaylistTracksForUser,
  getSpotifyUserAccessToken,
} from "../lib/spotify-user";
import { scoreTrackTitleArtistMatch } from "../lib/lastfm-import";

async function main() {
  const owner = await getMyTrlOwnerUser();
  const token = await getSpotifyUserAccessToken(owner!.id);
  const newHitsId = token ? await findNewHitsPlaylistId(token) : null;
  if (!newHitsId) {
    console.error("Playlist New Hits não encontrada");
    process.exit(1);
  }

  const monthlyId = owner!.spotifyNewHitsPlaylistId;
  const newHitsTracks = await getPlaylistTracksForUser(owner!.id, newHitsId);
  const monthlyTracks = monthlyId ? await getPlaylistTracksForUser(owner!.id, monthlyId) : [];

  console.log(`New Hits (${newHitsId}): ${newHitsTracks.length} faixas`);
  console.log(`Mensal configurada (${monthlyId}): ${monthlyTracks.length} faixas\n`);

  const top7d = await fetchTopTracks("7day", 15, owner!.lastfmUser!);
  console.log("Top 7d vs playlist New Hits:\n");

  for (const t of top7d) {
    let best: (typeof newHitsTracks)[number] | null = null;
    let bestScore = -1;
    for (const pl of newHitsTracks) {
      const sc = scoreTrackTitleArtistMatch(t.track, t.artist, pl.title, pl.artist);
      if (sc > bestScore) {
        bestScore = sc;
        best = pl;
      }
    }
    const ok = bestScore >= 120;
    console.log(
      `${ok ? "✓" : "✗"} ${t.track} — ${t.artist} (${t.playcount})` +
        (best && bestScore > 0 ? ` [${bestScore} → ${best.title}]` : " [sem match]"),
    );
  }
}

main();
