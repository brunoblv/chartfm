/**
 * Calcula as N faixas mais ouvidas por mês de 2026 (fuso BRT) no Last.fm
 * e grava em JSON para a etapa de criação das playlists no Spotify.
 *
 * Uso: npx tsx scripts/_top-monthly-2026.ts [usuario] [limite]
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
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

const BASE_URL = "https://ws.audioscrobbler.com/2.0/";
const USER = process.argv[2] || process.env.LASTFM_USERNAME!;
const LIMIT = Number(process.argv[3] || 300);
const API_KEY = process.env.API_KEY!;
const OUT_DIR = join(process.cwd(), "scripts", "data", "top-monthly-2026");

if (!USER || !API_KEY) throw new Error("LASTFM_USERNAME/API_KEY ausentes");

type Agg = { track: string; artist: string; album: string; plays: number };

// Limites de cada mês em BRT (UTC-3, sem horário de verão no Brasil desde 2019).
// from = inclusivo, to = exclusivo. Em UNIX = (00:00 BRT) = 03:00 UTC do dia 1.
function brtMonthStartUnix(year: number, monthIdx0: number): number {
  // 00:00:00 -03:00  ==  03:00:00 UTC
  return Math.floor(Date.UTC(year, monthIdx0, 1, 3, 0, 0) / 1000);
}

async function fetchAllScrobbles(from: number, toExclusive: number) {
  const tracks: { name: string; artist: string; album: string; uts: number }[] = [];
  let page = 1;
  let totalPages = 1;
  let totalReported = 0;

  do {
    const params = new URLSearchParams({
      method: "user.getRecentTracks",
      user: USER,
      api_key: API_KEY,
      format: "json",
      limit: "200",
      from: String(from),
      to: String(toExclusive),
      page: String(page),
    });
    const res = await fetch(`${BASE_URL}?${params}`, { cache: "no-store" } as RequestInit);
    if (!res.ok) throw new Error(`Last.fm HTTP ${res.status}`);
    const data: any = await res.json();
    if (data.error) throw new Error(`Last.fm error ${data.error}: ${data.message}`);

    const raw = data.recenttracks?.track ?? [];
    const arr = Array.isArray(raw) ? raw : [raw];
    totalPages = Number(data.recenttracks?.["@attr"]?.totalPages ?? 1);
    totalReported = Number(data.recenttracks?.["@attr"]?.total ?? 0);

    for (const t of arr) {
      if (t["@attr"]?.nowplaying || !t.date?.uts) continue;
      tracks.push({
        name: String(t.name || "").trim(),
        artist: String(t.artist?.["#text"] || "").trim(),
        album: String(t.album?.["#text"] || "").trim(),
        uts: Number(t.date.uts),
      });
    }
    page++;
    await new Promise((r) => setTimeout(r, 120)); // gentil com a API
  } while (page <= totalPages);

  return { tracks, totalReported };
}

function normKey(track: string, artist: string): string {
  const n = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return `${n(track)}|||${n(artist)}`;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const now = Math.floor(Date.now() / 1000);
  const year = 2026;
  const summary: { month: number; name: string; scrobbles: number; uniqueTracks: number; top: Agg[] }[] = [];

  for (let m = 0; m < 12; m++) {
    const from = brtMonthStartUnix(year, m);
    if (from > now) break; // mês futuro
    const toExclusive = Math.min(brtMonthStartUnix(year, m + 1), now);

    process.stdout.write(`\n${MONTH_NAMES[m]}/2026 … `);
    const { tracks } = await fetchAllScrobbles(from, toExclusive);

    const grouped = new Map<string, Agg>();
    for (const t of tracks) {
      if (!t.name || !t.artist) continue;
      const key = normKey(t.name, t.artist);
      const cur = grouped.get(key);
      if (cur) cur.plays++;
      else grouped.set(key, { track: t.name, artist: t.artist, album: t.album, plays: 1 });
    }

    const ranked = [...grouped.values()].sort((a, b) => b.plays - a.plays);
    const top = ranked.slice(0, LIMIT);
    process.stdout.write(`${tracks.length} scrobbles, ${ranked.length} faixas únicas, top${top.length}`);

    const fileName = `2026-${String(m + 1).padStart(2, "0")}.json`;
    writeFileSync(join(OUT_DIR, fileName), JSON.stringify({ month: m + 1, name: MONTH_NAMES[m], from, toExclusive, scrobbles: tracks.length, top }, null, 2));

    summary.push({ month: m + 1, name: MONTH_NAMES[m]!, scrobbles: tracks.length, uniqueTracks: ranked.length, top });
  }

  console.log("\n\n=== RESUMO 2026 ===");
  for (const s of summary) {
    console.log(`${s.name.padEnd(10)} | ${String(s.scrobbles).padStart(6)} scrobbles | ${String(s.uniqueTracks).padStart(5)} faixas únicas | top: ${s.top.length}`);
    for (let i = 0; i < Math.min(5, s.top.length); i++) {
      const t = s.top[i]!;
      console.log(`    ${String(i + 1).padStart(2)}. ${t.track} — ${t.artist} (${t.plays})`);
    }
  }
  writeFileSync(join(OUT_DIR, "_summary.json"), JSON.stringify(summary.map((s) => ({ ...s, top: s.top.length })), null, 2));
  console.log(`\nArquivos salvos em ${OUT_DIR}`);
}

main().catch((e) => { console.error("\n[ERRO]", e); process.exit(1); });
