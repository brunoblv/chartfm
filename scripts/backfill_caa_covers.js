const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toBool(v) {
  return v === "1" || v === "true" || v === "yes";
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const USER_AGENT =
  process.env.MB_USER_AGENT ||
  "chartfm-cover-backfill/1.0 (contact: local-dev)";

async function mbRecordingSearch(title, artist) {
  const query = `recording:"${title}" AND artist:"${artist}"`;
  const url = `https://musicbrainz.org/ws/2/recording?fmt=json&limit=6&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`MusicBrainz ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.recordings) ? data.recordings : [];
}

function pickBestReleaseMbid(recordings, title, artist) {
  const t = normalize(title);
  const a = normalize(artist);
  for (const rec of recordings) {
    const recTitle = normalize(rec.title);
    const ac = Array.isArray(rec["artist-credit"]) ? rec["artist-credit"] : [];
    const artistNames = ac.map((c) => normalize(c?.name || c?.artist?.name || ""));
    const titleOk = recTitle === t || recTitle.includes(t) || t.includes(recTitle);
    const artistOk = artistNames.some((n) => n && (n.includes(a) || a.includes(n)));
    const rels = Array.isArray(rec.releases) ? rec.releases : [];
    if (titleOk && artistOk && rels.length > 0) return rels[0].id;
  }
  for (const rec of recordings) {
    const rels = Array.isArray(rec.releases) ? rec.releases : [];
    if (rels.length > 0) return rels[0].id;
  }
  return null;
}

async function caaCoverFromRelease(releaseMbid) {
  const url = `https://coverartarchive.org/release/${encodeURIComponent(releaseMbid)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`CAA ${res.status}`);
  const data = await res.json();
  const images = Array.isArray(data.images) ? data.images : [];
  const front = images.find((img) => img && img.front) || images[0];
  if (!front) return null;
  return (
    front.thumbnails?.large ||
    front.thumbnails?.small ||
    front.image ||
    null
  );
}

async function findCoverUrlCAA(title, artist) {
  const recordings = await mbRecordingSearch(title, artist);
  if (!recordings.length) return null;
  const releaseMbid = pickBestReleaseMbid(recordings, title, artist);
  if (!releaseMbid) return null;
  return caaCoverFromRelease(releaseMbid);
}

async function main() {
  const dryRun = toBool(process.env.DRY_RUN || "0");
  const delayMs = Number(process.env.DELAY_MS || 1200);
  const batchSize = Number(process.env.BATCH_SIZE || 200);
  const maxToProcess = Number(process.env.MAX_TO_PROCESS || 0);

  const whereMissing = {
    albumSpotifyId: { not: null },
    OR: [{ albumRef: null }, { albumRef: { OR: [{ coverUrl: null }, { coverUrl: "" }] } }],
  };
  const totalMissing = await prisma.song.count({ where: whereMissing });
  console.log(JSON.stringify({ totalMissing, dryRun, delayMs, batchSize, maxToProcess }, null, 2));

  const cache = new Map();
  let processed = 0;
  let updated = 0;
  let skippedNoResult = 0;
  let failed = 0;

  while (true) {
    const rows = await prisma.song.findMany({
      where: whereMissing,
      select: { id: true, title: true, artist: true, albumSpotifyId: true },
      orderBy: { id: "asc" },
      take: batchSize,
    });
    if (!rows.length) break;

    for (const s of rows) {
      if (maxToProcess > 0 && processed >= maxToProcess) break;
      processed += 1;
      const key = `${normalize(s.title)}|${normalize(s.artist)}`;
      let coverUrl = cache.get(key);

      if (coverUrl === undefined) {
        try {
          coverUrl = await findCoverUrlCAA(s.title, s.artist);
          cache.set(key, coverUrl || null);
        } catch (err) {
          failed += 1;
          console.log(`[${processed}] erro id=${s.id} ${s.title} - ${s.artist}: ${String(err)}`);
          await sleep(delayMs);
          continue;
        }
      }

      if (!coverUrl) {
        skippedNoResult += 1;
      } else if (!dryRun && s.albumSpotifyId) {
        await prisma.album.updateMany({
          where: { spotifyId: s.albumSpotifyId, OR: [{ coverUrl: null }, { coverUrl: "" }] },
          data: { coverUrl: coverUrl },
        });
        updated += 1;
      } else {
        updated += 1;
      }

      if (processed % 20 === 0) {
        console.log(JSON.stringify({ processed, updated, skippedNoResult, failed, cacheSize: cache.size }));
      }
      await sleep(delayMs);
    }

    if (maxToProcess > 0 && processed >= maxToProcess) break;
  }

  console.log(JSON.stringify({ done: true, processed, updated, skippedNoResult, failed, dryRun }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
