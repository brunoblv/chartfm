/**
 * Lista músicas sem correspondente na tabela `albums`:
 * LEFT JOIN albums ON albums.spotify_id = Song.album_spotify_id WHERE albums.spotify_id IS NULL
 * (inclui album_spotify_id NULL e FK órfã se existir).
 *
 * Opcional: --out=path.json  (padrão scripts/_songs_sem_album_catalog.json)
 * --limit=N (padrão 5000)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnvFile();

function parseArg(name: string, def: string): string {
  const a = process.argv.slice(2).find((x) => x.startsWith(`--${name}=`));
  if (!a) return def;
  const i = a.indexOf("=");
  return i > 0 ? a.slice(i + 1).trim() : def;
}

async function main() {
  const limit = Math.max(1, parseInt(parseArg("limit", "5000"), 10) || 5000);
  const outPath = path.resolve(process.cwd(), parseArg("out", "scripts/_songs_sem_album_catalog.json"));

  const semAlbumJoin = { albumRef: { is: null } } as const;
  const total = await prisma.song.count({ where: semAlbumJoin });
  const rows = await prisma.song.findMany({
    where: semAlbumJoin,
    select: { id: true, title: true, artist: true, album: true, spotifyId: true, albumSpotifyId: true },
    orderBy: [{ artist: "asc" }, { title: "asc" }],
    take: limit,
  });

  const payload = { gerado_em: new Date().toISOString(), total_no_banco: total, listados: rows.length, musicas: rows };
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

  console.log(JSON.stringify({ total_no_banco: total, exportados: rows.length, arquivo: outPath }));
  for (const r of rows.slice(0, 40)) {
    console.log(`- ${r.artist} — ${r.title} | texto_album=${r.album ?? "∅"} | spotify_id=${r.spotifyId ?? "∅"} | id=${r.id}`);
  }
  if (rows.length > 40) console.log(`… e mais ${rows.length - 40} no JSON.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
