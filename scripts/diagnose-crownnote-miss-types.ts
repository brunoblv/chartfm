import { readFileSync } from "fs";
import { prisma } from "../lib/prisma";
import {
  cleanArtistForLookup,
  crownnoteSongKey,
  matchSongInCatalog,
  normalizeMatchText,
} from "../lib/crownnote-song-match";

function stripFeatFromTitle(title: string): string {
  return title
    .replace(/\s*\((feat\.?|ft\.?|featuring)[^)]*\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function looseDbExists(title: string, artistRaw: string): Promise<boolean> {
  const artist = cleanArtistForLookup(artistRaw);
  const artistToken = artist.split(/[\s&]+/)[0] ?? artist;
  const titleCore = stripFeatFromTitle(title);
  const titleToken = titleCore.split(" ").slice(0, 3).join(" ");
  if (!titleToken || !artistToken) return false;

  const count = await prisma.song.count({
    where: {
      title: { contains: titleToken, mode: "insensitive" },
      artist: { contains: artistToken, mode: "insensitive" },
    },
  });
  return count > 0;
}

async function main() {
  const data = JSON.parse(
    readFileSync("C:/Users/blvbr/Downloads/crownnote-whatthelucas-2026-07-05.json", "utf8"),
  ) as { charts: { entries: { artist: string; title: string }[] }[] };

  const uniq = new Map<string, { artist: string; title: string }>();
  for (const c of data.charts) {
    for (const e of c.entries) {
      const k = crownnoteSongKey(e.artist, e.title);
      if (!uniq.has(k)) uniq.set(k, e);
    }
  }

  let strictMissLooseHit = 0;
  let strictMissNoLoose = 0;
  const fixable: string[] = [];

  for (const e of uniq.values()) {
    const strict = await matchSongInCatalog(e.title, e.artist);
    if (strict) continue;
    const loose = await looseDbExists(e.title, e.artist);
    if (loose) {
      strictMissLooseHit++;
      if (fixable.length < 15) fixable.push(`${e.artist} - ${e.title}`);
    } else {
      strictMissNoLoose++;
    }
  }

  console.log({
    unique: uniq.size,
    strictMissLooseHit,
    strictMissNoLoose,
    fixableSample: fixable,
  });
}

main().finally(() => prisma.$disconnect());
