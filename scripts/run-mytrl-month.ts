/**
 * MyTRL mensal (@bruno) — paradas diárias (top 10) e semanais (top 20 = soma dos pontos)
 * com filtro de faixas pela playlist Spotify do mês.
 *
 * Paradas:
 *   Top 10 diário  → cmc06e6c262cf93ad97616c3c (UMS Request Live)
 *   Top 20 semanal → cmpn5qqi20001mly9beqx3xkt (Under My Skin Video Countdown)
 *
 * Usage:
 *   npx tsx scripts/run-mytrl-month.ts --month=janeiro --year=2026 --playlist=73s0LQhMVLSkkyDKwpbZxK
 *   npx tsx scripts/run-mytrl-month.ts --from=2026-01-01 --to=2026-01-31 --playlist-url="https://open.spotify.com/playlist/73s0LQhMVLSkkyDKwpbZxK"
 *   npx tsx scripts/run-mytrl-month.ts --month=janeiro --year=2026 --playlist=... --persist-playlist
 *   npx tsx scripts/run-mytrl-month.ts --month=janeiro --year=2026 --playlist=... --clear-range
 *   npx tsx scripts/run-mytrl-month.ts --month=janeiro --year=2026 --playlist=... --dry-run
 *   npx tsx scripts/run-mytrl-month.ts --month=janeiro --year=2026 --playlist=... --snapshots-only
 *
 * Cron automático (seg–sex 8h / sexta 8:05 BRT): use --persist-playlist para gravar a playlist
 * no perfil @bruno; o cron /api/cron/mytrl passará a usar essa playlist até trocar de mês.
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
import { buildPeriodFromDate } from "../lib/chart-cadence";
import {
  MYTRL_OWNER_HANDLE,
  MYTRL_WEEKLY_PARADA_ID,
  UMS_REQUEST_LIVE_PARADA_ID,
} from "../lib/mytrl-access";
import {
  brtDateKey,
  brtWeekday,
  buildMyTrlPeriod,
  parseMyTrlReferenceDate,
  toBrtDate,
} from "../lib/mytrl-chart-engine";
import { runDailyMyTrlJob } from "../lib/mytrl-daily-parada";
import { generateMyTrlSnapshot } from "../lib/mytrl-generate";
import { parseMyTrlWeeklyReferenceDate, publishMyTrlWeeklyChart } from "../lib/mytrl-weekly-chart";
import { recomputeAllMyTrlSnapshots } from "../lib/mytrl-recompute";
import { getMyTrlOwnerUser, parseSpotifyPlaylistId } from "../lib/spotify-user";

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  janeiro: 0,
  fev: 1,
  fevereiro: 1,
  mar: 2,
  março: 2,
  marco: 2,
  abr: 3,
  abril: 3,
  mai: 4,
  maio: 4,
  jun: 5,
  junho: 5,
  jul: 6,
  julho: 6,
  ago: 7,
  agosto: 7,
  set: 8,
  setembro: 8,
  out: 9,
  outubro: 9,
  nov: 10,
  novembro: 10,
  dez: 11,
  dezembro: 11,
};

const DRY_RUN = process.argv.includes("--dry-run");
const CLEAR_RANGE = process.argv.includes("--clear-range");
const PERSIST_PLAYLIST = process.argv.includes("--persist-playlist");
const SNAPSHOTS_ONLY = process.argv.includes("--snapshots-only");
const SKIP_WEEKLY = process.argv.includes("--skip-weekly");

const MONTH_ARG = process.argv.find((a) => a.startsWith("--month="));
const YEAR_ARG = process.argv.find((a) => a.startsWith("--year="));
const FROM_ARG = process.argv.find((a) => a.startsWith("--from="));
const TO_ARG = process.argv.find((a) => a.startsWith("--to="));
const PLAYLIST_ARG = process.argv.find((a) => a.startsWith("--playlist="));
const PLAYLIST_URL_ARG = process.argv.find((a) => a.startsWith("--playlist-url="));

function argValue(flag: string): string {
  return flag.split("=").slice(1).join("=");
}

function resolveMonthRange(monthRaw: string, year: number): { from: string; to: string } {
  const monthIndex = MONTH_MAP[monthRaw.toLowerCase().replace(".", "")];
  if (monthIndex == null) {
    throw new Error(`Mês inválido: "${monthRaw}". Use janeiro, fevereiro, março, etc.`);
  }
  const mm = String(monthIndex + 1).padStart(2, "0");
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function resolveDateRange(): { from: string; to: string } {
  if (MONTH_ARG) {
    const year = YEAR_ARG ? Number(argValue(YEAR_ARG)) : new Date().getFullYear();
    if (!Number.isFinite(year)) throw new Error("--year inválido");
    return resolveMonthRange(argValue(MONTH_ARG), year);
  }
  if (FROM_ARG && TO_ARG) {
    return { from: argValue(FROM_ARG), to: argValue(TO_ARG) };
  }
  throw new Error("Informe --month=janeiro --year=2026 ou --from=AAAA-MM-DD --to=AAAA-MM-DD");
}

function resolvePlaylistId(): string {
  const raw = PLAYLIST_ARG
    ? argValue(PLAYLIST_ARG)
    : PLAYLIST_URL_ARG
      ? argValue(PLAYLIST_URL_ARG)
      : null;
  if (!raw) {
    throw new Error("Informe --playlist=<id> ou --playlist-url=<url do Spotify>");
  }
  const id = parseSpotifyPlaylistId(raw);
  if (!id) throw new Error(`Playlist inválida: ${raw}`);
  return id;
}

function weekdaysBetween(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${fromKey}T00:00:00Z`);
  const end = new Date(`${toKey}T00:00:00Z`);
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    const ref = parseMyTrlReferenceDate(key);
    if (ref && brtWeekday(ref) !== 0) out.push(key);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function fridaysBetween(fromKey: string, toKey: string): string[] {
  return weekdaysBetween(fromKey, toKey).filter((key) => {
    const ref = parseMyTrlWeeklyReferenceDate(key);
    return ref != null;
  });
}

async function clearRangeData(fromKey: string, toKey: string) {
  const weekdayKeys = new Set(weekdaysBetween(fromKey, toKey));
  const weekIndices = new Set<number>();
  const dailyPeriodIndices = new Set<number>();

  for (const key of weekdayKeys) {
    const ref = parseMyTrlReferenceDate(key);
    if (!ref) continue;
    const { weekIndex } = buildMyTrlPeriod(ref);
    weekIndices.add(weekIndex);
    const brt = toBrtDate(ref);
    const localDate = new Date(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate());
    dailyPeriodIndices.add(buildPeriodFromDate(localDate, "DAILY").periodIndex);
  }

  const snapshots = await prisma.myTrlSnapshot.findMany({
    select: { id: true, weekday: true, weekIndex: true, computedAt: true },
  });
  const snapshotIds = snapshots
    .filter((s) => weekdayKeys.has(brtDateKey(s.computedAt)))
    .map((s) => s.id);

  const deletedSnapshots = snapshotIds.length
    ? await prisma.myTrlSnapshot.deleteMany({ where: { id: { in: snapshotIds } } })
    : { count: 0 };

  const deletedDaily = dailyPeriodIndices.size
    ? await prisma.chart.deleteMany({
        where: {
          paradaId: UMS_REQUEST_LIVE_PARADA_ID,
          weekIndex: { in: [...dailyPeriodIndices] },
        },
      })
    : { count: 0 };

  const weeklyCharts = await prisma.chart.findMany({
    where: { paradaId: MYTRL_WEEKLY_PARADA_ID },
    select: { id: true, weekIndex: true },
  });
  const weeklyIds = weeklyCharts.filter((c) => weekIndices.has(c.weekIndex)).map((c) => c.id);
  const deletedWeekly = weeklyIds.length
    ? await prisma.chart.deleteMany({ where: { id: { in: weeklyIds } } })
    : { count: 0 };

  return {
    snapshots: deletedSnapshots.count,
    dailyCharts: deletedDaily.count,
    weeklyCharts: deletedWeekly.count,
  };
}

async function main() {
  const { from, to } = resolveDateRange();
  const playlistId = resolvePlaylistId();
  const weekdays = weekdaysBetween(from, to);
  const fridays = fridaysBetween(from, to);

  const owner = await getMyTrlOwnerUser();
  if (!owner) throw new Error(`Usuário @${MYTRL_OWNER_HANDLE} não encontrado.`);

  console.log("=== MyTRL mensal (@bruno) ===");
  console.log(`Período: ${from} → ${to} (${weekdays.length} dias úteis, ${fridays.length} sextas)`);
  console.log(`Playlist Spotify: ${playlistId}`);
  console.log(`Top 10 diário: ${UMS_REQUEST_LIVE_PARADA_ID}`);
  console.log(`Top 20 semanal: ${MYTRL_WEEKLY_PARADA_ID}`);
  console.log(`Spotify conectado: ${Boolean(owner.spotifyRefreshToken)}`);
  console.log(`Last.fm: ${owner.lastfmUser ?? process.env.LASTFM_USERNAME ?? "(não configurado)"}`);
  if (DRY_RUN) console.log("Modo: dry-run");
  if (SNAPSHOTS_ONLY) console.log("Modo: snapshots-only (sem publicar paradas)");
  console.log("");

  if (!owner.spotifyRefreshToken && !DRY_RUN) {
    throw new Error("Conecte o Spotify do @bruno antes de rodar.");
  }

  if (CLEAR_RANGE && !DRY_RUN) {
    console.log("Limpando snapshots e paradas do intervalo...");
    const cleared = await clearRangeData(from, to);
    console.log(
      `Apagados: ${cleared.snapshots} snapshots, ${cleared.dailyCharts} diárias, ${cleared.weeklyCharts} semanais\n`,
    );
  } else if (CLEAR_RANGE) {
    console.log("[dry-run] Limparia snapshots e paradas do intervalo\n");
  }

  if (PERSIST_PLAYLIST && !DRY_RUN) {
    await prisma.user.update({
      where: { id: owner.id },
      data: { spotifyNewHitsPlaylistId: playlistId },
    });
    console.log(`Playlist gravada no perfil @${MYTRL_OWNER_HANDLE} (cron usará esta playlist).\n`);
  } else if (PERSIST_PLAYLIST) {
    console.log(`[dry-run] Gravaria playlist ${playlistId} no perfil @${MYTRL_OWNER_HANDLE}\n`);
  }

  let dailyOk = 0;
  let dailyFail = 0;
  let weeklyOk = 0;
  let weeklyFail = 0;

  for (const dateKey of weekdays) {
    const ref = parseMyTrlReferenceDate(dateKey)!;
    process.stdout.write(`${dateKey} (diária) ... `);

    if (DRY_RUN) {
      console.log("dry-run");
      dailyOk++;
      continue;
    }

    try {
      if (SNAPSHOTS_ONLY) {
        const snap = await generateMyTrlSnapshot(ref, { skipRecompute: true, playlistId });
        if (!snap.ok) {
          console.log(`SKIP — ${snap.error}`);
          dailyFail++;
          continue;
        }
        console.log(`OK snapshot — top ${snap.count}`);
        dailyOk++;
        continue;
      }

      const result = await runDailyMyTrlJob(ref, {
        skipSnapshotRecompute: true,
        playlistId,
      });

      if (!result.ok) {
        console.log(`SKIP — ${result.error}`);
        dailyFail++;
        continue;
      }

      console.log(
        `OK — top ${result.publish.count} publicado (${result.publish.created ? "novo" : "atualizado"})`,
      );
      dailyOk++;
    } catch (err) {
      console.log(`ERROR — ${String(err)}`);
      dailyFail++;
    }
  }

  if (!SNAPSHOTS_ONLY && !SKIP_WEEKLY) {
    console.log("");
    for (const dateKey of fridays) {
      const ref = parseMyTrlWeeklyReferenceDate(dateKey)!;
      process.stdout.write(`${dateKey} (semanal) ... `);

      if (DRY_RUN) {
        console.log("dry-run");
        weeklyOk++;
        continue;
      }

      try {
        const result = await publishMyTrlWeeklyChart(ref);
        if (!result.ok) {
          console.log(`FAIL — ${result.error}`);
          weeklyFail++;
          continue;
        }
        console.log(
          `OK — ${result.count} faixas (${result.created ? "nova parada" : "atualizada"}) week ${result.weekIndex}`,
        );
        weeklyOk++;
      } catch (err) {
        console.log(`ERROR — ${String(err)}`);
        weeklyFail++;
      }
    }
  }

  if (!DRY_RUN) {
    console.log("\nRecalculando estatísticas MyTRL...");
    const recomputed = await recomputeAllMyTrlSnapshots();
    console.log(`Recomputadas: ${recomputed.editions} edições`);
  }

  console.log("\n=== RESUMO ===");
  console.log(`Diárias: ${dailyOk} ok, ${dailyFail} falhas`);
  if (!SNAPSHOTS_ONLY && !SKIP_WEEKLY) {
    console.log(`Semanais: ${weeklyOk} ok, ${weeklyFail} falhas`);
  }
  if (!PERSIST_PLAYLIST) {
    console.log(
      "\nDica: use --persist-playlist para o cron automático (seg–sex 8h) usar esta playlist.",
    );
  }
}

main()
  .catch((err) => {
    console.error("[erro]", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
