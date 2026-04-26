const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const AUTH_URL = "https://accounts.spotify.com/api/token";
const ARTIST_URL = "https://api.spotify.com/v1/artists";
let tokenState = { token: null, expiresAt: 0 };

async function getSpotifyToken() {
  if (tokenState.token && Date.now() < tokenState.expiresAt) return tokenState.token;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const json = await res.json();
  tokenState = { token: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 };
  return tokenState.token;
}

async function spotifyArtistById(spotifyId) {
  const token = await getSpotifyToken();
  if (!token) return null;
  const res = await fetch(`${ARTIST_URL}/${encodeURIComponent(spotifyId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const a = await res.json();
  const image = Array.isArray(a.images) && a.images.length ? a.images[0].url : null;
  return {
    spotifyId: a.id,
    name: a.name,
    imageUrl: image,
    spotifyUrl: a.external_urls?.spotify ?? null,
  };
}

function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  loadEnvFile();
  const prisma = new PrismaClient();
  const report = {
    songsArtistTextNormalized: 0,
    songsArtistTextSkippedByConflict: 0,
    duplicateGroupsProcessed: 0,
    artistRefsMovedInSongs: 0,
    artistRefsMovedInAlbums: 0,
    artistRefsMovedInFeats: 0,
    duplicateArtistRowsDeleted: 0,
    artistRowsImageUpdated: 0,
  };

  try {
    // 1) Normaliza songs.artist para o nome canônico de artistRef
    const songs = await prisma.song.findMany({
      where: { artistSpotifyId: { not: null } },
      select: {
        id: true,
        title: true,
        artist: true,
        artistSpotifyId: true,
        artistRef: { select: { name: true } },
      },
    });
    for (const s of songs) {
      const canonical = s.artistRef?.name?.trim();
      if (!canonical || canonical === s.artist) continue;
      const conflict = await prisma.song.findFirst({
        where: {
          id: { not: s.id },
          title: s.title,
          artist: canonical,
        },
        select: { id: true },
      });
      if (conflict) {
        report.songsArtistTextSkippedByConflict += 1;
        continue;
      }
      await prisma.song.update({
        where: { id: s.id },
        data: { artist: canonical },
      });
      report.songsArtistTextNormalized += 1;
    }

    // 2) Dedup de artists por nome normalizado
    const allArtists = await prisma.artist.findMany({
      select: { spotifyId: true, name: true, imageUrl: true, createdAt: true, updatedAt: true },
    });
    const grouped = new Map();
    for (const a of allArtists) {
      const key = normalizeName(a.name);
      const arr = grouped.get(key) || [];
      arr.push(a);
      grouped.set(key, arr);
    }

    for (const [, group] of grouped) {
      if (group.length <= 1) continue;
      report.duplicateGroupsProcessed += 1;

      // escolhe canônico priorizando quem está referenciado em songs
      const ids = group.map((g) => g.spotifyId);
      const [songRefs, albumRefs, featRefs] = await Promise.all([
        prisma.song.groupBy({ by: ["artistSpotifyId"], where: { artistSpotifyId: { in: ids } }, _count: { artistSpotifyId: true } }),
        prisma.album.groupBy({ by: ["artistSpotifyId"], where: { artistSpotifyId: { in: ids } }, _count: { artistSpotifyId: true } }),
        prisma.songFeat.groupBy({ by: ["artistSpotifyId"], where: { artistSpotifyId: { in: ids } }, _count: { artistSpotifyId: true } }),
      ]);
      const refCount = new Map();
      for (const id of ids) refCount.set(id, 0);
      for (const r of songRefs) refCount.set(r.artistSpotifyId, (refCount.get(r.artistSpotifyId) || 0) + r._count.artistSpotifyId);
      for (const r of albumRefs) refCount.set(r.artistSpotifyId, (refCount.get(r.artistSpotifyId) || 0) + r._count.artistSpotifyId);
      for (const r of featRefs) refCount.set(r.artistSpotifyId, (refCount.get(r.artistSpotifyId) || 0) + r._count.artistSpotifyId);

      const sorted = [...group].sort((a, b) => {
        const diff = (refCount.get(b.spotifyId) || 0) - (refCount.get(a.spotifyId) || 0);
        if (diff !== 0) return diff;
        if (!!b.imageUrl !== !!a.imageUrl) return b.imageUrl ? 1 : -1;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      const canonical = sorted[0];
      const duplicates = sorted.slice(1);
      for (const dup of duplicates) {
        const [s, a, f] = await Promise.all([
          prisma.song.updateMany({
            where: { artistSpotifyId: dup.spotifyId },
            data: { artistSpotifyId: canonical.spotifyId },
          }),
          prisma.album.updateMany({
            where: { artistSpotifyId: dup.spotifyId },
            data: { artistSpotifyId: canonical.spotifyId },
          }),
          prisma.songFeat.updateMany({
            where: { artistSpotifyId: dup.spotifyId },
            data: { artistSpotifyId: canonical.spotifyId },
          }),
        ]);
        report.artistRefsMovedInSongs += s.count;
        report.artistRefsMovedInAlbums += a.count;
        report.artistRefsMovedInFeats += f.count;

        await prisma.artist.delete({ where: { spotifyId: dup.spotifyId } });
        report.duplicateArtistRowsDeleted += 1;
      }
    }

    // 3) Atualiza imagens faltantes
    const missingImages = await prisma.artist.findMany({
      where: { OR: [{ imageUrl: null }, { imageUrl: "" }] },
      select: { spotifyId: true, name: true },
    });
    for (const a of missingImages) {
      const profile = await spotifyArtistById(a.spotifyId);
      if (!profile) continue;
      await prisma.artist.update({
        where: { spotifyId: a.spotifyId },
        data: {
          name: profile.name,
          spotifyUrl: profile.spotifyUrl ?? undefined,
          ...(profile.imageUrl ? { imageUrl: profile.imageUrl } : {}),
        },
      });
      if (profile.imageUrl) report.artistRowsImageUpdated += 1;
    }

    const final = {
      artists: await prisma.artist.count(),
      artistsWithoutImage: await prisma.artist.count({ where: { OR: [{ imageUrl: null }, { imageUrl: "" }] } }),
      songsWithoutArtistRef: await prisma.song.count({ where: { artistSpotifyId: null } }),
    };

    console.log(JSON.stringify({ ok: true, report, final }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
