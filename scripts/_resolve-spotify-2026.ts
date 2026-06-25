/**
 * Resolve as faixas do top mensal (Last.fm) para URIs do Spotify via
 * client-credentials (não precisa de login do usuário). Grava *-resolved.json.
 *
 * Uso: npx tsx scripts/_resolve-spotify-2026.ts
 */
import { existsSync, readFileSync, writeFileSync, readdirSync } from "fs";
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

import { getAccessToken } from "../lib/spotify-server";

const DIR = join(process.cwd(), "scripts", "data", "top-monthly-2026");
const API_BASE = "https://api.spotify.com/v1";

type Agg = { track: string; artist: string; album: string; plays: number };

function normTitle(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\(feat[^)]*\)/g, "").replace(/feat\.?.*$/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

async function searchOne(token: string, t: Agg): Promise<{ uri: string; name: string; artist: string } | null> {
  const artistMain = t.artist.replace(/\s+(feat\.?|ft\.?|featuring)\s+.+$/i, "").trim();
  const queries = [
    `track:${t.track} artist:${artistMain}`,
    `${t.track} ${artistMain}`,
    `${t.track} ${t.artist}`,
  ];
  for (const q of queries) {
    const url = new URL(`${API_BASE}/search`);
    url.searchParams.set("q", q);
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", "5");
    url.searchParams.set("market", "BR");
    let res: Response;
    try {
      res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    } catch { continue; }
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") || 2) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) continue;
    const json: any = await res.json();
    const items = json.tracks?.items ?? [];
    if (!items.length) continue;
    // tenta casar título; senão pega o primeiro
    const want = normTitle(t.track);
    const exact = items.find((it: any) => normTitle(it.name) === want);
    const pick = exact ?? items[0];
    return { uri: pick.uri, name: pick.name, artist: (pick.artists || []).map((a: any) => a.name).join(", ") };
  }
  return null;
}

async function main() {
  const token = await getAccessToken();
  if (!token) throw new Error("Sem access token Spotify (client credentials)");

  const files = readdirSync(DIR).filter((f) => /^2026-\d{2}\.json$/.test(f)).sort();
  for (const file of files) {
    const data = JSON.parse(readFileSync(join(DIR, file), "utf-8")) as { name: string; top: Agg[] };
    const resolved: { plays: number; query: string; uri: string | null; matched: string | null }[] = [];
    let hits = 0;
    for (let i = 0; i < data.top.length; i++) {
      const t = data.top[i]!;
      const r = await searchOne(token, t);
      if (r) {
        hits++;
        resolved.push({ plays: t.plays, query: `${t.track} — ${t.artist}`, uri: r.uri, matched: `${r.name} — ${r.artist}` });
      } else {
        resolved.push({ plays: t.plays, query: `${t.track} — ${t.artist}`, uri: null, matched: null });
      }
      await new Promise((r) => setTimeout(r, 90));
    }
    const outName = file.replace(".json", "-resolved.json");
    writeFileSync(join(DIR, outName), JSON.stringify({ name: data.name, total: data.top.length, hits, resolved }, null, 2));
    console.log(`${data.name.padEnd(10)} | ${hits}/${data.top.length} faixas encontradas no Spotify`);
  }
  console.log("\nResolução concluída.");
}

main().catch((e) => { console.error("[ERRO]", e); process.exit(1); });
