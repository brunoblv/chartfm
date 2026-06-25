import { readFileSync, readdirSync } from "fs";
import { join } from "path";
const DIR = join(process.cwd(), "scripts", "data", "top-monthly-2026");
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\(feat[^)]*\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
for (const file of readdirSync(DIR).filter((f) => /-resolved\.json$/.test(f)).sort()) {
  const d = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  let mismatch = 0;
  const samples: string[] = [];
  for (const r of d.resolved) {
    const q = String(r.query).split(" — ")[0];
    const mt = r.matched ? String(r.matched).split(" — ")[0] : "";
    if (r.matched && norm(q) !== norm(mt)) {
      mismatch++;
      if (samples.length < 6) samples.push(`    "${r.query}"  =>  "${r.matched}"`);
    }
  }
  console.log(`${d.name.padEnd(10)} | ${d.resolved.length} faixas | ${mismatch} títulos divergentes`);
  samples.forEach((s) => console.log(s));
}
