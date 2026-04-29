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

function pickBestResult(results, title, artist) {
  const t = normalize(title);
  const a = normalize(artist);

  const exact = results.find((r) => normalize(r.trackName) === t && normalize(r.artistName).includes(a));
  if (exact) return exact;

  const byTrack = results.find((r) => normalize(r.trackName) === t);
  if (byTrack) return byTrack;

  return results[0] || null;
}

async function fetchItunesCover(title, artist, country) {
  const term = encodeURIComponent(`${title} ${artist}`);
  const url = `https://itunes.apple.com/search?term=${term}&entity=song&limit=8&country=${encodeURIComponent(country)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];
  if (!results.length) return null;

  const hit = pickBestResult(results, title, artist);
  if (!hit?.artworkUrl100) return null;
  return String(hit.artworkUrl100).replace("100x100bb", "600x600bb");
}

async function main() {
  const dryRun = toBool(process.env.DRY_RUN || "0");
  const delayMs = Number(process.env.DELAY_MS || 700);
  const batchSize = Number(process.env.BATCH_SIZE || 300);
  const maxToProcess = Number(process.env.MAX_TO_PROCESS || 0);
  const country = process.env.ITUNES_COUNTRY || "BR";

  const whereMissing = { OR: [{ coverImageUrl: null }, { coverImageUrl: "" }] };
  const totalMissing = await prisma.song.count({ where: whereMissing });

  console.log(
    JSON.stringify(
      { totalMissing, delayMs, batchSize, maxToProcess, country, dryRun },
      null,
      2,
    ),
  );

  const cache = new Map();
  let processed = 0;
  let updated = 0;
  let skippedNoResult = 0;
  let failed = 0;

  while (true) {
    const remaining = await prisma.song.findMany({
      where: whereMissing,
      select: { id: true, title: true, artist: true, coverImageUrl: true },
      orderBy: { id: "asc" },
      take: batchSize,
    });

    if (!remaining.length) break;

    for (const song of remaining) {
      if (maxToProcess > 0 && processed >= maxToProcess) break;
      processed += 1;

      const key = `${normalize(song.title)}|${normalize(song.artist)}`;
      let coverUrl = cache.get(key);

      if (coverUrl === undefined) {
        try {
          coverUrl = await fetchItunesCover(song.title, song.artist, country);
          cache.set(key, coverUrl || null);
        } catch (err) {
          failed += 1;
          console.log(`[${processed}] erro request id=${song.id} ${song.title} - ${song.artist}: ${String(err)}`);
          await sleep(delayMs);
          continue;
        }
      }

      if (!coverUrl) {
        skippedNoResult += 1;
      } else if (!dryRun) {
        await prisma.song.update({
          where: { id: song.id },
          data: { coverImageUrl: coverUrl },
        });
        updated += 1;
      } else {
        updated += 1;
      }

      if (processed % 25 === 0) {
        console.log(
          JSON.stringify({ processed, updated, skippedNoResult, failed, cacheSize: cache.size }),
        );
      }

      await sleep(delayMs);
    }

    if (maxToProcess > 0 && processed >= maxToProcess) break;
  }

  console.log(
    JSON.stringify(
      { done: true, processed, updated, skippedNoResult, failed, dryRun, delayMs, cacheSize: cache.size },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
