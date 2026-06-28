import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { realignCopaLivePhase } from "../lib/copa-repair";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
}

const copaId = process.argv[2] ?? "cmqr3sma1000gvacfk24dl970";

realignCopaLivePhase(copaId)
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error("ERR:", e.message);
    process.exit(1);
  });
