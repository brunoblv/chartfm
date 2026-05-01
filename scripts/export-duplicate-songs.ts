import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type SongRow = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  spotifyId: string | null;
};

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalTitle(title: string): string {
  return normalizeText(
    title
      .replace(/\s*\([^)]*remix[^)]*\)\s*$/i, "")
      .replace(/\s*\[[^\]]*remix[^\]]*\]\s*$/i, "")
      .replace(/\s[-–]\s.*\bremix(?:es)?\b.*$/i, "")
      .trim(),
  );
}

function canonicalArtist(artist: string): string {
  return normalizeText(artist.replace(/\s+(feat\.?|ft\.?|featuring|with)\s+.+$/i, ""));
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const songs = await prisma.song.findMany({
      select: {
        id: true,
        title: true,
        artist: true,
        album: true,
        spotifyId: true,
      },
      orderBy: [{ artist: "asc" }, { title: "asc" }],
    });

    const groups = new Map<string, SongRow[]>();
    for (const song of songs) {
      const key = `${canonicalTitle(song.title)}|||${canonicalArtist(song.artist)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(song);
    }

    const duplicateGroups = [...groups.entries()]
      .filter(([, rows]) => rows.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    const lines: string[] = [];
    lines.push(
      [
        "grupo_chave",
        "quantidade_no_grupo",
        "song_id",
        "title",
        "artist",
        "album",
        "spotify_id",
      ].join(","),
    );

    for (const [groupKey, rows] of duplicateGroups) {
      for (const row of rows) {
        lines.push(
          [
            csvEscape(groupKey),
            String(rows.length),
            row.id,
            csvEscape(row.title),
            csvEscape(row.artist),
            csvEscape(row.album ?? ""),
            row.spotifyId ?? "",
          ].join(","),
        );
      }
    }

    await mkdir(join(process.cwd(), "reports"), { recursive: true });
    const outputPath = join(process.cwd(), "reports", "musicas-duplicadas.csv");
    await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");

    console.log(`Arquivo gerado: ${outputPath}`);
    console.log(`Total de grupos duplicados: ${duplicateGroups.length}`);
    const totalRows = duplicateGroups.reduce((acc, [, rows]) => acc + rows.length, 0);
    console.log(`Total de músicas em grupos duplicados: ${totalRows}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
