/**
 * Mescla um álbum duplicado no principal: migra músicas, charts, reviews e remove o duplicado.
 *
 * Uso:
 *   npx tsx scripts/merge-duplicate-album.ts --keep=66927 --drop=69779
 *   npx tsx scripts/merge-duplicate-album.ts --artist="Olivia Rodrigo" --title="you seem pretty sad"
 *   npx tsx scripts/merge-duplicate-album.ts --keep=66927 --drop=69779 --dry-run
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { mergeAlbums } from "../lib/merge-albums";
import { canonicalAlbumTitle, canonicalArtistName } from "../lib/duplicate-utils";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

const dryRun = process.argv.includes("--dry-run");

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
}

async function resolveIds(prisma: PrismaClient): Promise<{ keepId: number; dropId: number }> {
  const keepRaw = arg("keep");
  const dropRaw = arg("drop");
  if (keepRaw && dropRaw) {
    const keepId = Number(keepRaw);
    const dropId = Number(dropRaw);
    if (!Number.isInteger(keepId) || !Number.isInteger(dropId) || keepId <= 0 || dropId <= 0 || keepId === dropId) {
      throw new Error("IDs inválidos em --keep / --drop");
    }
    return { keepId, dropId };
  }

  const artist = arg("artist");
  const title = arg("title");
  if (!artist || !title) {
    throw new Error("Informe --keep e --drop, ou --artist e --title");
  }

  const albums = await prisma.album.findMany({
    where: {
      artist: { name: { contains: artist, mode: "insensitive" } },
      OR: [
        { title: { contains: title, mode: "insensitive" } },
        { exhibitionName: { contains: title, mode: "insensitive" } },
      ],
    },
    include: {
      artist: { select: { name: true } },
      _count: { select: { reviews: true, songs: true, chartEntries: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const key = `${canonicalAlbumTitle(title)}|||${canonicalArtistName(artist)}`;
  const matches = albums.filter(
    (a) =>
      `${canonicalAlbumTitle(a.title)}|||${canonicalArtistName(a.artist.name)}` === key ||
      (a.exhibitionName &&
        `${canonicalAlbumTitle(a.exhibitionName)}|||${canonicalArtistName(a.artist.name)}` === key),
  );

  if (matches.length < 2) {
    throw new Error(`Encontrados ${matches.length} álbum(ns) para "${title}" — ${artist}`);
  }

  const [keep, ...rest] = [...matches].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const drop = rest[0];
  if (!drop) throw new Error("Não foi possível determinar o álbum duplicado");

  console.log(`Álbum principal (mais antigo): #${keep.id} "${keep.title}" (${keep.createdAt.toISOString()})`);
  console.log(`Álbum a remover: #${drop.id} "${drop.title}" (${drop.createdAt.toISOString()})`);
  return { keepId: keep.id, dropId: drop.id };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const { keepId, dropId } = await resolveIds(prisma);

    const [keep, drop] = await Promise.all([
      prisma.album.findUnique({
        where: { id: keepId },
        include: { _count: { select: { reviews: true, songs: true, chartEntries: true } } },
      }),
      prisma.album.findUnique({
        where: { id: dropId },
        include: { _count: { select: { reviews: true, songs: true, chartEntries: true } } },
      }),
    ]);

    if (!keep || !drop) throw new Error("Álbum não encontrado");
    console.log(`Manter #${keep.id} "${keep.title}" (${keep._count.reviews} reviews)`);
    console.log(`Remover #${drop.id} "${drop.title}" (${drop._count.reviews} reviews)`);

    if (dryRun) {
      console.log("[dry-run] Nenhuma alteração aplicada.");
      return;
    }

    const result = await mergeAlbums(prisma, keepId, dropId);
    console.log("Merge concluído:", result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
