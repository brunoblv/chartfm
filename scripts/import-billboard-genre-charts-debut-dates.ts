/**
 * Preenche Song.billboardGenreChartDebutDate / billboardGenreChartName a partir
 * dos JSONs gerados por scripts/billboard-genre-charts-scrape.py
 * (scripts/data/billboard-genre-charts/*.json — um arquivo por chart secundário
 * da Billboard: Mainstream Rock, Alternative Airplay, Hot Latin Songs etc.),
 * considerando apenas semanas entre 1970-01-01 e 2026-12-31.
 *
 * Para cada música (título + artista, normalizado) calcula a data da primeira
 * semana em que apareceu em QUALQUER um desses charts (a mais antiga entre
 * todos), junto com o nome do chart correspondente. Se a música já existe na
 * base (match exato de title+artist), só atualiza a data se ainda não tiver
 * uma ou se a calculada for mais antiga. Se não existe, cadastra
 * (createdManually: true, sem vínculo Spotify).
 *
 * A coluna billboard_genre_chart_debut_date ainda não está no Prisma Client
 * gerado (mesma limitação do import do Hot 100), então é lida/escrita via SQL
 * bruto; o resto usa o client tipado normalmente.
 *
 * Uso:
 *   npx tsx scripts/import-billboard-genre-charts-debut-dates.ts --dry-run
 *   npx tsx scripts/import-billboard-genre-charts-debut-dates.ts
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
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
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;
const DATA_DIR = join(process.cwd(), "scripts", "data", "billboard-genre-charts");
const RANGE_START = "1970-01-01";
const RANGE_END = "2026-12-31";
const CONCURRENCY = 20;
const UPDATE_BATCH_SIZE = 1000;

// slug -> nome legível, usado como fallback caso o JSON não traga um título de chart.
const CHART_LABELS: Record<string, string> = {
  "hot-mainstream-rock-tracks": "Mainstream Rock Airplay",
  "alternative-airplay": "Alternative Airplay",
  "hot-rock-songs": "Hot Rock & Alternative Songs",
  "hot-hard-rock-songs": "Hot Hard Rock Songs",
  "rock-airplay": "Rock Airplay",
  "country-airplay": "Country Airplay",
  "r-b-hip-hop-songs": "Hot R&B/Hip-Hop Songs",
  "rap-song": "Hot Rap Songs",
  "latin-songs": "Hot Latin Songs",
  "dance-electronic-songs": "Hot Dance/Electronic Songs",
  "pop-songs": "Pop Airplay",
  "adult-contemporary": "Adult Contemporary",
  "triple-a": "Triple A (Adult Album Alternative) Airplay",
  "rhythmic-40": "Rhythmic Airplay",
};

interface WeekEntry {
  song: string;
  artist: string;
}

interface Week {
  date: string;
  data: WeekEntry[];
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface DebutInfo {
  title: string;
  artist: string;
  debutDate: string; // YYYY-MM-DD
  chartName: string;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function main() {
  if (!existsSync(DATA_DIR)) {
    console.error(`Diretório não encontrado: ${DATA_DIR}. Rode scripts/billboard-genre-charts-scrape.py primeiro.`);
    process.exit(1);
  }

  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  console.log(`${files.length} charts encontrados em ${DATA_DIR}: ${files.join(", ")}`);

  const debutByKey = new Map<string, DebutInfo>();
  let entriesInRange = 0;
  let weeksTotal = 0;

  for (const file of files) {
    const slug = file.replace(/\.json$/, "");
    const chartName = CHART_LABELS[slug] ?? slug;
    const weeks: Week[] = JSON.parse(readFileSync(join(DATA_DIR, file), "utf-8"));
    weeksTotal += weeks.length;

    for (const week of weeks) {
      if (week.date < RANGE_START || week.date > RANGE_END) continue;
      for (const entry of week.data) {
        if (!entry.song || !entry.artist) continue;
        entriesInRange++;
        const key = `${normalize(entry.song)}|${normalize(entry.artist)}`;
        const existing = debutByKey.get(key);
        if (!existing || week.date < existing.debutDate) {
          debutByKey.set(key, { title: entry.song, artist: entry.artist, debutDate: week.date, chartName });
        }
      }
    }
  }

  console.log(
    `${weeksTotal} semanas lidas, ${entriesInRange} entradas em [${RANGE_START}, ${RANGE_END}], ${debutByKey.size} músicas únicas (título+artista normalizado).`
  );

  if (DRY_RUN) {
    let sample = 0;
    for (const info of debutByKey.values()) {
      if (sample++ >= 10) break;
      console.log(`  [dry-run] ${info.title} — ${info.artist} → estreia ${info.debutDate} (${info.chartName})`);
    }
    console.log("[dry-run] nenhuma alteração aplicada.");
    await prisma.$disconnect();
    return;
  }

  const debuts = LIMIT ? Array.from(debutByKey.values()).slice(0, LIMIT) : Array.from(debutByKey.values());

  const results = await mapWithConcurrency(debuts, CONCURRENCY, async (info) => {
    const song = await prisma.song.upsert({
      where: { title_artist: { title: info.title, artist: info.artist } },
      update: {},
      create: { title: info.title, artist: info.artist, createdManually: true },
      select: { id: true },
    });
    return { id: song.id, debutDate: info.debutDate, chartName: info.chartName };
  });

  const ids = results.map((r) => r.id);
  const dates = results.map((r) => r.debutDate);
  const chartNames = results.map((r) => r.chartName);

  console.log(`${ids.length} músicas upsertadas (criadas + já existentes).`);

  let totalUpdated = 0;
  for (let i = 0; i < ids.length; i += UPDATE_BATCH_SIZE) {
    const idBatch = ids.slice(i, i + UPDATE_BATCH_SIZE);
    const dateBatch = dates.slice(i, i + UPDATE_BATCH_SIZE);
    const chartBatch = chartNames.slice(i, i + UPDATE_BATCH_SIZE);
    const result: { count: bigint }[] = await prisma.$queryRawUnsafe(
      `
      WITH v AS (
        SELECT * FROM UNNEST($1::text[], $2::date[], $3::text[]) AS t(id, debut, chart_name)
      )
      UPDATE "Song" AS s
      SET billboard_genre_chart_debut_date = v.debut,
          billboard_genre_chart_name = v.chart_name
      FROM v
      WHERE s.id = v.id
        AND (s.billboard_genre_chart_debut_date IS NULL OR s.billboard_genre_chart_debut_date > v.debut)
      RETURNING 1 AS count
      `,
      idBatch,
      dateBatch,
      chartBatch
    );
    totalUpdated += Array.isArray(result) ? result.length : 0;
    console.log(`  batch ${i / UPDATE_BATCH_SIZE + 1}: ${idBatch.length} ids processados`);
  }

  console.log(`Concluído. ${totalUpdated} registros com billboard_genre_chart_debut_date definida/atualizada.`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
