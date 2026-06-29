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

import { fetchTopTracks, fetchTracksBetweenUnix } from "../lib/lastfm";
import { getMyTrlOwnerUser, getNewHitsTracksForUser, getSpotifyUserAccessToken } from "../lib/spotify-user";
import { scoreTrackTitleArtistMatch } from "../lib/lastfm-import";

async function fetchPlaylistMeta(playlistId: string, token: string) {
  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name,tracks.total`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { name?: string; tracks?: { total?: number } };
}

async function main() {
  const owner = await getMyTrlOwnerUser();
  if (!owner?.lastfmUser || !owner.spotifyNewHitsPlaylistId) {
    console.error("Config incompleta");
    process.exit(1);
  }

  const token = await getSpotifyUserAccessToken(owner.id);
  const meta = token ? await fetchPlaylistMeta(owner.spotifyNewHitsPlaylistId, token) : null;
  const playlistTracks = await getNewHitsTracksForUser(owner.id, owner.spotifyNewHitsPlaylistId);

  console.log("=== Diagnóstico @bruno ===\n");
  console.log(`Last.fm: ${owner.lastfmUser}`);
  console.log(`Playlist ID: ${owner.spotifyNewHitsPlaylistId}`);
  console.log(`Playlist nome (Spotify): ${meta?.name ?? "?"}`);
  console.log(`Playlist total (Spotify API): ${meta?.tracks?.total ?? "?"}`);
  console.log(`Faixas carregadas: ${playlistTracks.length}\n`);

  const top7d = await fetchTopTracks("7day", 30, owner.lastfmUser);
  console.log(`Last.fm top 7day: ${top7d.length} faixas\n`);

  console.log("--- Top 7d: match na playlist ---\n");
  for (const t of top7d.slice(0, 20)) {
    let bestPl: (typeof playlistTracks)[number] | null = null;
    let bestScore = -1;
    for (const pl of playlistTracks) {
      const sc = scoreTrackTitleArtistMatch(t.track, t.artist, pl.title, pl.artist);
      if (sc > bestScore) {
        bestScore = sc;
        bestPl = pl;
      }
    }
    const ok = bestScore >= 120;
    const hint = bestPl ? `→ ${bestPl.title} / ${bestPl.artist.split(",")[0]} (score ${bestScore})` : "";
    console.log(`${ok ? "✓" : "✗"} ${t.track} — ${t.artist} (${t.playcount} plays) ${hint}`);
  }

  const anchor = new Date();
  const toExclusive = Math.floor(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + 1) / 1000,
  );
  const from7 = toExclusive - 7 * 86400;
  const raw7 = await fetchTracksBetweenUnix(from7, toExclusive, owner.lastfmUser);
  console.log(`\nScrobbles brutos últimos 7d (API recenttracks): ${raw7.length} faixas únicas`);

  const from30 = toExclusive - 30 * 86400;
  const raw30 = await fetchTracksBetweenUnix(from30, toExclusive, owner.lastfmUser);
  console.log(`Scrobbles brutos últimos 30d: ${raw30.length} faixas únicas`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
