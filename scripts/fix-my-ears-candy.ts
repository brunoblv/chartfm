import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const prisma = new PrismaClient();
const TRACK_ID = "38rI8D0820xh1Xz5FJzDMV";

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!spotifyConfigured()) throw new Error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");

  const meta = await getSpotifyTrackMetadataById(TRACK_ID, "KR");
  if (!meta) throw new Error("Não foi possível carregar metadados do Spotify.");

  const candidates = await prisma.song.findMany({
    where: {
      OR: [
        { title: { contains: "ear", mode: "insensitive" } },
        { title: { contains: "candy", mode: "insensitive" } },
        { title: { contains: "귀에", mode: "insensitive" } },
        { title: { contains: "캔디", mode: "insensitive" } },
        { spotifyId: TRACK_ID },
      ],
    },
    select: { id: true, title: true, artist: true, spotifyId: true },
    orderBy: { id: "asc" },
    take: 50,
  });

  const titleLooksLikeCandy = (title: string) => {
    const t = title.toLowerCase();
    return (
      t.includes("my ear") ||
      t.includes("ear's candy") ||
      t.includes("ears candy") ||
      t.includes("candy in my ear") ||
      t.includes("내 귀에 캔디") ||
      t.includes("귀에 캔디")
    );
  };

  let target = candidates.find((s) => s.spotifyId === TRACK_ID)
    ?? candidates.find((s) => titleLooksLikeCandy(s.title));

  if (!target) {
    if (dryRun) {
      console.log("DRY create", { title: meta.title, artist: meta.primaryArtist?.name });
      return;
    }
    target = await prisma.song.create({
      data: {
        title: meta.title,
        artist: meta.primaryArtist?.name ?? "Baek Z Young",
        album: meta.album.title ?? null,
      },
      select: { id: true, title: true, artist: true, spotifyId: true },
    });
  }

  console.log("target", target);
  const res = await applySpotifyMetadataToSong(target.id, meta, dryRun);
  if (!res.ok) throw new Error(res.reason);

  console.log(dryRun ? "dry_run_ok" : "updated_ok", {
    songId: target.id,
    spotifyId: meta.spotifyId,
    title: meta.title,
    artist: meta.primaryArtist?.name,
    album: meta.album.title,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
