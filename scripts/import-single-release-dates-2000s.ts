/**
 * Preenche Song.singleReleaseDate a partir da planilha public/2000s.xlsx
 * (colunas: Release Date | Artist/Band | Single).
 *
 * Match por artista + título (normalizado: minúsculas, sem acento, sem pontuação).
 * - Músicas já existentes no banco: atualiza singleReleaseDate (só se ainda vazio, salvo --force).
 * - Linhas da planilha sem música correspondente no banco: cria Song nova
 *   (título/artista/data da planilha, createdManually=true, sem Spotify).
 *
 * Uso:
 *   npx tsx scripts/import-single-release-dates-2000s.ts --dry-run
 *   npx tsx scripts/import-single-release-dates-2000s.ts
 *   npx tsx scripts/import-single-release-dates-2000s.ts --force
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

for (const name of [".env", ".env.local", ".env.production"]) {
  loadEnvFile(join(process.cwd(), name));
}

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const XLSX_PATH = join(process.cwd(), "public", "2000s.xlsx");

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface XlsxRow {
  releaseDate: Date;
  artist: string;
  title: string;
}

function readRows(): XlsxRow[] {
  if (!existsSync(XLSX_PATH)) {
    throw new Error(`Arquivo não encontrado: ${XLSX_PATH}`);
  }
  const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(ws, {
    header: 1,
    defval: null,
  });

  const rows: XlsxRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const [date, artist, title] = raw[i];
    if (!(date instanceof Date) || typeof artist !== "string" || typeof title !== "string") {
      continue;
    }
    rows.push({ releaseDate: date, artist: artist.trim(), title: title.trim() });
  }
  return rows;
}

function fmt(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

async function main() {
  console.log(`Planilha: ${XLSX_PATH}`);
  console.log(`Modo: ${DRY_RUN ? "dry-run" : "gravar"}${FORCE ? " | force" : ""}\n`);

  const rows = readRows();
  console.log(`Linhas na planilha: ${rows.length}`);

  // Índice das linhas por chave normalizada "artista||título".
  const byKey = new Map<string, XlsxRow>();
  for (const row of rows) {
    const key = `${normalize(row.artist)}||${normalize(row.title)}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }

  // Todas as músicas do banco, pra saber quais chaves da planilha já existem.
  const allSongs = await prisma.song.findMany({
    select: { id: true, title: true, artist: true, singleReleaseDate: true },
  });
  const existingKeys = new Set<string>();
  for (const song of allSongs) {
    existingKeys.add(`${normalize(song.artist)}||${normalize(song.title)}`);
  }

  const updateCandidates = FORCE ? allSongs : allSongs.filter((s) => s.singleReleaseDate === null);
  console.log(`Músicas candidatas a atualizar no banco: ${updateCandidates.length}\n`);

  let matched = 0;
  let updated = 0;
  let skippedSame = 0;

  for (const song of updateCandidates) {
    const key = `${normalize(song.artist)}||${normalize(song.title)}`;
    const row = byKey.get(key);
    if (!row) continue;

    matched += 1;

    const sameDate =
      (song.singleReleaseDate?.toISOString().slice(0, 10) ?? null) === fmt(row.releaseDate);
    if (!FORCE && sameDate) {
      skippedSame += 1;
      continue;
    }

    const line = `  ${DRY_RUN ? "→" : "✓"} ${song.artist} — ${song.title} | single: ${fmt(row.releaseDate)}`;
    if (!DRY_RUN) {
      await prisma.song.update({
        where: { id: song.id },
        data: { singleReleaseDate: row.releaseDate, singleReleaseDateFetchedAt: new Date() },
      });
    }
    console.log(line);
    updated += 1;
  }

  console.log("\n--- Resumo (atualização) ---");
  console.log(`Candidatas processadas: ${updateCandidates.length}`);
  console.log(`Encontradas na planilha: ${matched}`);
  console.log(`${DRY_RUN ? "Seriam atualizadas" : "Atualizadas"}: ${updated}`);
  console.log(`Já corretas (skip): ${skippedSame}`);

  // Linhas da planilha sem música correspondente no banco: cria Song nova.
  const missing = [...byKey.entries()].filter(([key]) => !existingKeys.has(key));
  console.log(`\nLinhas da planilha sem música no banco: ${missing.length}`);

  let created = 0;
  for (const [key, row] of missing) {
    const line = `  ${DRY_RUN ? "→" : "+"} ${row.artist} — ${row.title} | single: ${fmt(row.releaseDate)}`;
    if (!DRY_RUN) {
      await prisma.song.create({
        data: {
          title: row.title,
          artist: row.artist,
          singleReleaseDate: row.releaseDate,
          singleReleaseDateFetchedAt: new Date(),
          createdManually: true,
        },
      });
      existingKeys.add(key);
    }
    console.log(line);
    created += 1;
  }

  console.log("\n--- Resumo (criação) ---");
  console.log(`${DRY_RUN ? "Seriam criadas" : "Criadas"}: ${created}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
