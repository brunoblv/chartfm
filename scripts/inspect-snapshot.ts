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

async function main() {
  // Consulta SQL direta para ver o que está no banco de verdade
  const rows = await prisma.$queryRaw<{ week_index: number; weekly_songs_len: number; frozen_at: Date }[]>`
    SELECT
      week_index,
      jsonb_array_length(weekly_songs::jsonb) AS weekly_songs_len,
      frozen_at
    FROM global_snapshots
    ORDER BY week_index ASC
  `;

  console.log("Resultado SQL direto da tabela global_snapshots:\n");
  console.log("week_index | weekly_songs_len | frozen_at");
  console.log("-".repeat(60));
  for (const r of rows) {
    console.log(`${r.week_index}      | ${String(r.weekly_songs_len).padStart(16)} | ${new Date(r.frozen_at).toISOString().slice(0, 16)}`);
  }
  console.log(`\nTotal de linhas: ${rows.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
