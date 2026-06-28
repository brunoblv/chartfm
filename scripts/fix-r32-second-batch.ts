import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { ensureR32SecondBatchClosed } from "../lib/copa-knockout";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
}

const copaId = process.argv[2] ?? "cmqr3sma1000gvacfk24dl970";

ensureR32SecondBatchClosed(copaId)
  .then((n) => console.log(`2ª rodada do 1/16 fechada: ${n} jogo(s) → UPCOMING`))
  .finally(() => process.exit(0));
