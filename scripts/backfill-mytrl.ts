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
import { clearAllMyTrlData } from "../lib/mytrl-clear";
import { generateMyTrlSnapshot } from "../lib/mytrl-generate";
import { recomputeAllMyTrlSnapshots } from "../lib/mytrl-recompute";
import { brtWeekday, parseMyTrlReferenceDate } from "../lib/mytrl-chart-engine";

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

async function main() {
  const from = process.argv[2] ?? "2026-05-01";
  const to = process.argv[3] ?? "2026-06-18";

  const user = await prisma.user.findUnique({
    where: { handle: "bruno" },
    select: {
      handle: true,
      lastfmUser: true,
      spotifyNewHitsPlaylistId: true,
      spotifyRefreshToken: true,
    },
  });

  if (!user) {
    console.error("Usuário @bruno não encontrado.");
    process.exit(1);
  }
  console.log("@bruno:", {
    lastfmUser: user.lastfmUser ?? process.env.LASTFM_USERNAME,
    spotifyConnected: Boolean(user.spotifyRefreshToken),
    newHitsPlaylist: Boolean(user.spotifyNewHitsPlaylistId),
  });

  const dates = weekdaysBetween(from, to);
  console.log(`\nLimpando MyTRL existente...`);
  const cleared = await clearAllMyTrlData();
  console.log(`Apagados: ${cleared.snapshots} snapshots, ${cleared.weeklyCharts} paradas semanais`);

  console.log(`\nGerando ${dates.length} edições (${from} → ${to})...\n`);

  let ok = 0;
  let fail = 0;
  for (const dateKey of dates) {
    const ref = parseMyTrlReferenceDate(dateKey)!;
    process.stdout.write(`${dateKey} ... `);
    try {
      const result = await generateMyTrlSnapshot(ref, { skipRecompute: true });
      if (result.ok) {
        console.log(`OK — top ${result.count}, week ${result.weekIndex}`);
        ok++;
      } else {
        console.log(`SKIP/FAIL — ${result.error}`);
        fail++;
      }
    } catch (err) {
      console.log(`ERROR — ${String(err)}`);
      fail++;
    }
  }

  console.log("\nRecalculando estatísticas de todas as edições...");
  const recomputed = await recomputeAllMyTrlSnapshots();
  console.log(`Recomputadas: ${recomputed.editions} edições`);

  const final = await prisma.myTrlSnapshot.findMany({
    orderBy: [{ computedAt: "asc" }],
    select: { weekday: true, weekIndex: true, computedAt: true },
  });
  console.log(`\nConcluído: ${ok} ok, ${fail} falhas. Total no banco: ${final.length}`);
  if (final.length) {
    console.log(`Primeira: ${final[0].computedAt.toISOString().slice(0, 10)}`);
    console.log(`Última: ${final[final.length - 1].computedAt.toISOString().slice(0, 10)}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
