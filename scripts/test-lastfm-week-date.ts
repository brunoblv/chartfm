/**
 * Teste Last.fm: semana da parada que contém uma data (AAAA-MM-DD).
 * Uso: npx tsx scripts/test-lastfm-week-date.ts 2026-02-12
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

async function main() {
  loadEnvFile();
  const weekDateArg = process.argv[2] ?? "2026-02-12";
  const { chartWeekUnixRangeFromAnchor, getChartWeekRange, parseChartWeekPickerDate } = await import("../lib/chart-week.js");
  const { fetchTracksBetweenUnix } = await import("../lib/lastfm.js");
  const { scoreLastfmTracks } = await import("../lib/lastfm-chart-engine.js");

  const anchor = parseChartWeekPickerDate(weekDateArg);
  if (!anchor) {
    console.error("Data inválida. Use AAAA-MM-DD (ex.: 2026-02-12 para 12/02/2026).");
    process.exit(1);
  }

  const { start, end } = getChartWeekRange(anchor);
  const { from, toExclusive } = chartWeekUnixRangeFromAnchor(anchor);
  const scoreAnchor = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));

  console.log(
    JSON.stringify(
      {
        weekDateInput: weekDateArg,
        weekLocalStart: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
        weekLocalEnd: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
        unixFrom: from,
        unixToExclusive: toExclusive,
        lastfmUser: process.env.LASTFM_USERNAME ?? "(não definido)",
      },
      null,
      2,
    ),
  );

  const plays = await fetchTracksBetweenUnix(from, toExclusive);
  const ranked = scoreLastfmTracks(plays, scoreAnchor, 200);

  console.log("\nTop 50 (score: 7d×5 + 8–14d×3 + 15–21d×2 + 22–28d×1; âncora = domingo fim da semana):\n");
  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    console.log(`${String(i + 1).padStart(3, " ")}  score=${r.score.toFixed(2).padStart(8, " ")}  ${r.artist} — ${r.track}`);
  }
  console.log(`\nTotal faixas agregadas na janela: ${plays.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
