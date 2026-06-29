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

import { getMyTrlOwnerUser, getSpotifyUserAccessToken } from "../lib/spotify-user";

const API = "https://api.spotify.com/v1";

async function main() {
  const owner = await getMyTrlOwnerUser();
  const token = await getSpotifyUserAccessToken(owner!.id);
  if (!token) {
    console.error("sem token");
    process.exit(1);
  }

  let url: string | null = `${API}/me/playlists?limit=50`;
  const all: Array<{ name: string; id: string; total: number }> = [];

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = (await res.json()) as {
      items?: Array<{ id: string; name: string; tracks?: { total?: number } }>;
      next?: string | null;
    };
    for (const pl of json.items ?? []) {
      all.push({ name: pl.name, id: pl.id, total: pl.tracks?.total ?? 0 });
    }
    url = json.next ?? null;
  }

  all.sort((a, b) => b.total - a.total);
  console.log(`Playlists Spotify (${all.length}):\n`);
  for (const pl of all) {
    const cur = pl.id === owner!.spotifyNewHitsPlaylistId ? " ← ATUAL" : "";
    console.log(`${pl.total.toString().padStart(4)} | ${pl.name}${cur}`);
  }
}

main();
