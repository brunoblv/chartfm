import { prisma } from "../lib/prisma";

const misses = [
  ["From the Bottom of My Broken Heart", "Britney Spears"],
  ["Heartbreaker", "Mariah Carey ft. JAY-Z"],
  ["All the Small Things", "blink-182"],
  ["I Wanna Love You Forever", "Jessica Simpson"],
  ["Thank God I Found You", "Mariah Carey ft. 98 Degrees & Joe"],
  ["American Pie", "Madonna"],
  ["Thong Song", "Sisqó"],
];

async function main() {
  for (const [title, artist] of misses) {
    const clean = artist.replace(/\s+ft\..*$/i, "").trim();
    const rows = await prisma.song.findMany({
      where: {
        OR: [
          {
            AND: [
              { title: { contains: title.split(" ")[0], mode: "insensitive" } },
              { artist: { contains: clean.split(" ")[0], mode: "insensitive" } },
            ],
          },
          {
            AND: [
              { title: { contains: title.slice(0, 8), mode: "insensitive" } },
              { artist: { contains: clean.split(/[\s&]+/)[0], mode: "insensitive" } },
            ],
          },
        ],
      },
      select: { id: true, title: true, artist: true },
      take: 6,
    });
    console.log("\n===", artist, "-", title);
    for (const r of rows) console.log(" ", r.artist, "-", r.title);
    if (!rows.length) console.log("  (nenhum)");
  }
}

main().finally(() => prisma.$disconnect());
