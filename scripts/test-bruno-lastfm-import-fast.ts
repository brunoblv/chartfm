/**
 * Teste rápido: pontuação 30d + playlist "New Hits" (nome no Spotify).
 */
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

import { resolveBrunoNewHitsImportTracks } from "../lib/lastfm-import";
import { getMyTrlOwnerUser, getNamedNewHitsPlaylistTracks } from "../lib/spotify-user";

async function main() {
  const owner = await getMyTrlOwnerUser();
  if (!owner?.lastfmUser) {
    console.error("bruno / lastfm não configurado");
    process.exit(1);
  }

  const named = await getNamedNewHitsPlaylistTracks(owner.id);
  if (!named) {
    console.error("Playlist New Hits não encontrada");
    process.exit(1);
  }

  console.log(`Last.fm: ${owner.lastfmUser} | Playlist "New Hits": ${named.tracks.length} faixas\n`);

  const { tracks, periodLabel } = await resolveBrunoNewHitsImportTracks(undefined, owner.lastfmUser, named.tracks);
  console.log(`Período: ${periodLabel}`);
  console.log(`Faixas elegíveis: ${tracks.length}\n`);

  console.log("=== TOP 15 MAIS PONTUADAS ===\n");
  for (let i = 0; i < Math.min(15, tracks.length); i++) {
    const t = tracks[i]!;
    console.log(`${String(i + 1).padStart(2)}. ${t.track} — ${t.artist} | ${t.playcount} pts`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
