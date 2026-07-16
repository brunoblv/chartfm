/**
 * Remove as linhas [CLIP_REVIEW_NEEDED] acumuladas em Song.editorialNote
 * (bug do backfill de clipes que anexava a flag a cada rodada) e converte a
 * marcação para Song.sourcesNotFound ("youtube_clip"), o novo mecanismo.
 *
 * Uso: npx tsx scripts/clean-clip-review-flags.ts [--dry-run]
 * Prod: DATABASE_URL=$PRODUCTION_DATABASE_URL npx tsx scripts/clean-clip-review-flags.ts
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

import { prisma } from "../lib/prisma";
import { YOUTUBE_CLIP_SOURCE } from "../lib/youtube-music-clip-backfill";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const songs = await prisma.song.findMany({
    where: { editorialNote: { contains: "[CLIP_REVIEW_NEEDED]" } },
    select: { id: true, title: true, artist: true, editorialNote: true, sourcesNotFound: true },
  });

  console.log(`${songs.length} música(s) com [CLIP_REVIEW_NEEDED] no editorialNote${DRY_RUN ? " (dry-run)" : ""}`);

  for (const song of songs) {
    const cleaned =
      song.editorialNote
        ?.split("\n")
        .filter((line) => !line.includes("[CLIP_REVIEW_NEEDED]"))
        .join("\n")
        .trim() || null;

    const sourcesNotFound = song.sourcesNotFound.includes(YOUTUBE_CLIP_SOURCE)
      ? song.sourcesNotFound
      : [...song.sourcesNotFound, YOUTUBE_CLIP_SOURCE];

    console.log(
      `- ${song.title} — ${song.artist}: nota ${song.editorialNote?.length ?? 0} → ${cleaned?.length ?? 0} chars` +
        (cleaned ? " (mantém texto editorial)" : " (nota fica vazia)"),
    );

    if (!DRY_RUN) {
      await prisma.song.update({
        where: { id: song.id },
        data: { editorialNote: cleaned, sourcesNotFound },
      });
    }
  }

  console.log(DRY_RUN ? "Dry-run concluído, nada foi alterado." : "Limpeza concluída.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
