import { readFileSync } from "fs";
import { matchSongInCatalog } from "../lib/crownnote-song-match";
import { prisma } from "../lib/prisma";

async function main() {
  const samples = [
    ["What a Girl Wants", "Christina Aguilera"],
    ["Heartbreaker", "Mariah Carey ft. JAY-Z"],
    ["Around The World", "Red Hot Chili Peppers"],
    ["Say My Name", "Destiny's Child"],
    ["Imortal", "Sandy & Junior"],
    ["Learn to Fly", "Foo Fighters"],
    ["the cure", "Olivia Rodrigo"],
  ];

  for (const [title, artist] of samples) {
    const r = await matchSongInCatalog(title, artist);
    const db = await prisma.song.findMany({
      where: {
        AND: [
          { title: { contains: title.slice(0, Math.min(title.length, 12)), mode: "insensitive" } },
          { artist: { contains: artist.split(/\s+/)[0], mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, artist: true },
      take: 5,
    });
    console.log("---", artist, "-", title);
    console.log("match:", r?.match?.songId ?? "NONE", r?.confidence ?? "");
    for (const s of db) console.log("  db:", s.artist, "-", s.title, `(${s.id})`);
  }

  const jsonPath = process.argv[2] ?? "C:/Users/blvbr/Downloads/crownnote-whatthelucas-2026-07-05.json";
  const data = JSON.parse(readFileSync(jsonPath, "utf8")) as {
    charts: { entries: { artist: string; title: string }[] }[];
  };
  const uniq = new Map<string, { artist: string; title: string }>();
  for (const c of data.charts) {
    for (const e of c.entries) {
      const k = `${e.artist.toLowerCase()}|${e.title.toLowerCase()}`;
      if (!uniq.has(k)) uniq.set(k, e);
    }
  }

  let matched = 0;
  let unmatched = 0;
  const misses: string[] = [];
  for (const e of uniq.values()) {
    const r = await matchSongInCatalog(e.title, e.artist);
    if (r) matched++;
    else {
      unmatched++;
      if (misses.length < 20) misses.push(`${e.artist} - ${e.title}`);
    }
  }
  console.log("\nFULL SCAN:", { unique: uniq.size, matched, unmatched });
  console.log("sample misses:", misses.join("\n"));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
