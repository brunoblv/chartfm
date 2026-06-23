/**
 * Recalcula snapshots Global 100 Álbuns no servidor de produção, semana a semana.
 *
 * Uso:
 *   npx tsx scripts/rebuild-album-snapshots-remote.ts
 *   npx tsx scripts/rebuild-album-snapshots-remote.ts --base=https://chartfm.com.br
 *   npx tsx scripts/rebuild-album-snapshots-remote.ts --from=202610
 *   CRON_SECRET=xxx npx tsx scripts/rebuild-album-snapshots-remote.ts
 */
const BASE = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "https://chartfm.com.br";
const fromWeek = Number(process.argv.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "202601");
const toWeek = Number(process.argv.find((a) => a.startsWith("--to="))?.split("=")[1] ?? "202626");
const cronSecret = process.env.CRON_SECRET?.trim();

function weeksBetween(from: number, to: number): number[] {
  const out: number[] = [];
  for (let w = from; w <= to; w++) out.push(w);
  return out;
}

async function rebuildWeek(weekIndex: number) {
  const headers: Record<string, string> = {};
  if (cronSecret) headers.Authorization = `Bearer ${cronSecret}`;

  const url = `${BASE}/api/cron/rebuild-album-week?weekIndex=${weekIndex}`;
  const res = await fetch(url, { headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${weekIndex}: HTTP ${res.status} — ${JSON.stringify(body)}`);
  }
  return body as { entriesCount: number; contributorCount: number };
}

async function main() {
  const weeks = weeksBetween(fromWeek, toWeek);
  console.log(`Rebuild remoto: ${BASE}`);
  console.log(`Semanas ${fromWeek}–${toWeek} (${weeks.length} total)\n`);

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < weeks.length; i++) {
    const weekIndex = weeks[i];
    const prefix = `[${i + 1}/${weeks.length}] ${weekIndex}`;
    try {
      const t0 = Date.now();
      const result = await rebuildWeek(weekIndex);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`${prefix} → ${result.entriesCount} álbum(ns), ${result.contributorCount} ouvintes (${elapsed}s)`);
      ok++;
    } catch (err) {
      console.error(`${prefix} ERRO:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`\nConcluído — ${ok} OK, ${failed} erro(s).`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
