/**
 * Recalcula snapshots Global 100 Álbuns no servidor de produção.
 *
 * Uso:
 *   npx tsx scripts/rebuild-album-snapshots-remote.ts
 *   npx tsx scripts/rebuild-album-snapshots-remote.ts --base=https://chartfm.com.br
 *   npx tsx scripts/rebuild-album-snapshots-remote.ts --from=202610
 *   npx tsx scripts/rebuild-album-snapshots-remote.ts --mode=week --async=1
 *   CRON_SECRET=xxx npx tsx scripts/rebuild-album-snapshots-remote.ts
 */
const BASE = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "https://chartfm.com.br";
const fromWeek = Number(process.argv.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "202601");
const toWeek = Number(process.argv.find((a) => a.startsWith("--to="))?.split("=")[1] ?? "202626");
const mode = process.argv.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "all";
const asyncWeek = process.argv.includes("--async=1");
const cronSecret = process.env.CRON_SECRET?.trim();

function weeksBetween(from: number, to: number): number[] {
  const out: number[] = [];
  for (let w = from; w <= to; w++) out.push(w);
  return out;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (cronSecret) headers.Authorization = `Bearer ${cronSecret}`;
  return headers;
}

async function rebuildAll(from: number) {
  const url = `${BASE}/api/cron/rebuild-album-all?from=${from}`;
  const res = await fetch(url, { headers: authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 202) {
    throw new Error(`HTTP ${res.status} — ${JSON.stringify(body)}`);
  }
  return body;
}

async function rebuildWeek(weekIndex: number) {
  const qs = new URLSearchParams({ weekIndex: String(weekIndex) });
  if (asyncWeek) qs.set("async", "1");
  const url = `${BASE}/api/cron/rebuild-album-week?${qs}`;
  const res = await fetch(url, { headers: authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 202) {
    throw new Error(`${weekIndex}: HTTP ${res.status} — ${JSON.stringify(body)}`);
  }
  return body as { entriesCount?: number; contributorCount?: number; status?: string };
}

async function main() {
  console.log(`Rebuild remoto: ${BASE}`);

  if (mode === "all") {
    console.log(`Modo: rebuild-album-all (from=${fromWeek}, async no servidor)\n`);
    const result = await rebuildAll(fromWeek);
    console.log(JSON.stringify(result, null, 2));
    console.log("\nJob iniciado no servidor. Acompanhe os logs da VPS (pm2/docker) ou confira /global/albums.");
    return;
  }

  const weeks = weeksBetween(fromWeek, toWeek);
  console.log(`Modo: semana a semana ${fromWeek}–${toWeek} (${weeks.length} total)${asyncWeek ? ", async=1" : ""}\n`);

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < weeks.length; i++) {
    const weekIndex = weeks[i];
    const prefix = `[${i + 1}/${weeks.length}] ${weekIndex}`;
    try {
      const t0 = Date.now();
      const result = await rebuildWeek(weekIndex);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      if (result.status === "started") {
        console.log(`${prefix} → iniciado em background (${elapsed}s)`);
      } else {
        console.log(
          `${prefix} → ${result.entriesCount ?? "?"} álbum(ns), ${result.contributorCount ?? "?"} ouvintes (${elapsed}s)`,
        );
      }
      ok++;
      if (asyncWeek) await new Promise((r) => setTimeout(r, 90_000));
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
