import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { revertLiveR16SingleIndices } from "../lib/copa-repair";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
}

const copaId = process.argv[2] ?? "cmqr3sma1000gvacfk24dl970";

revertLiveR16SingleIndices(copaId)
  .then((n) => {
    console.log(`Oitavas LIVE/DONE corrigidas: ${n} jogo(s) voltaram ao slot 3.`);
  })
  .catch((e) => {
    console.error("ERR:", e.message);
    process.exit(1);
  });
