/**
 * OAuth local (uma vez) na conta Spotify do usuário e criação de uma playlist
 * por mês de 2026 com as faixas resolvidas em *-resolved.json.
 *
 * Uso: npx tsx scripts/_create-playlists-2026.ts
 *  -> abre um link, você aprova no seu Spotify, e as playlists são criadas.
 */
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { createServer } from "http";
import { randomBytes } from "crypto";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

const DIR = join(process.cwd(), "scripts", "data", "top-monthly-2026");
const API_BASE = "https://api.spotify.com/v1";
const AUTH_URL = "https://accounts.spotify.com/api/token";
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const REDIRECT_URI = process.env.SPOTIFY_USER_REDIRECT_URI!; // http://localhost:3000/api/spotify/connect/callback
const SCOPES = "playlist-modify-private playlist-modify-public user-read-private";
const PUBLIC = process.env.PLAYLIST_PUBLIC === "1";

const redirectUrl = new URL(REDIRECT_URI);
const PORT = Number(redirectUrl.port || 80);
const CALLBACK_PATH = redirectUrl.pathname;

function authorizeUrl(state: string): string {
  const u = new URL("https://accounts.spotify.com/authorize");
  u.searchParams.set("client_id", CLIENT_ID);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", REDIRECT_URI);
  u.searchParams.set("scope", SCOPES);
  u.searchParams.set("state", state);
  u.searchParams.set("show_dialog", "true");
  return u.toString();
}

function waitForCode(state: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, `http://localhost:${PORT}`);
      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404); res.end("not found"); return;
      }
      const code = url.searchParams.get("code");
      const gotState = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (error || !code || gotState !== state) {
        res.end(`<h2>Falha na autorização: ${error || "código/estado inválido"}</h2><p>Pode fechar esta aba.</p>`);
        server.close();
        reject(new Error(error || "código/estado inválido"));
        return;
      }
      res.end("<h2>Autorizado! ✅</h2><p>Pode voltar para o terminal e fechar esta aba.</p>");
      server.close();
      resolve(code);
    });
    server.on("error", reject);
    server.listen(PORT, () => {
      console.log(`\nAguardando autorização em ${REDIRECT_URI} (porta ${PORT})...`);
    });
  });
}

async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`token exchange falhou: ${res.status} ${await res.text()}`);
  return (await res.json()) as { access_token: string; refresh_token: string };
}

async function me(token: string): Promise<string> {
  const res = await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`/me falhou: ${res.status}`);
  return ((await res.json()) as { id: string }).id;
}

async function createPlaylist(token: string, userId: string, name: string, description: string): Promise<{ id: string; url: string }> {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/playlists`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.slice(0, 100), description: description.slice(0, 300), public: PUBLIC }),
  });
  if (!res.ok) throw new Error(`criar playlist falhou: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { id: string; external_urls?: { spotify?: string } };
  return { id: j.id, url: j.external_urls?.spotify ?? `https://open.spotify.com/playlist/${j.id}` };
}

async function addTracks(token: string, playlistId: string, uris: string[]) {
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    const res = await fetch(`${API_BASE}/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: batch }),
    });
    if (!res.ok) throw new Error(`adicionar faixas falhou: ${res.status} ${await res.text()}`);
  }
}

type Resolved = { name: string; total: number; hits: number; resolved: { plays: number; uri: string | null }[] };

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("SPOTIFY_CLIENT_ID/SECRET ausentes");

  const files = readdirSync(DIR).filter((f) => /^2026-\d{2}-resolved\.json$/.test(f)).sort();
  if (!files.length) throw new Error("Nenhum *-resolved.json encontrado. Rode o resolver antes.");

  const state = randomBytes(8).toString("hex");
  console.log("\n==============================================================");
  console.log("ABRA ESTE LINK NO NAVEGADOR, FAÇA LOGIN NO SEU SPOTIFY E APROVE:");
  console.log("\n" + authorizeUrl(state) + "\n");
  console.log("==============================================================");

  const code = await waitForCode(state);
  const tokens = await exchangeCode(code);
  const userId = await me(tokens.access_token);
  console.log(`\nLogado como Spotify user: ${userId}\n`);

  const results: { month: string; url: string; added: number; missing: number }[] = [];
  for (const file of files) {
    const data = JSON.parse(readFileSync(join(DIR, file), "utf-8")) as Resolved;
    const uris: string[] = [];
    const seen = new Set<string>();
    let missing = 0;
    for (const r of data.resolved) {
      if (r.uri && !seen.has(r.uri)) { seen.add(r.uri); uris.push(r.uri); }
      else if (!r.uri) missing++;
    }
    const name = `Mais ouvidas — ${data.name} 2026`;
    const desc = `Top ${uris.length} faixas mais ouvidas em ${data.name}/2026 (via Last.fm @${process.env.LASTFM_USERNAME}). Gerada automaticamente.`;
    const pl = await createPlaylist(tokens.access_token, userId, name, desc);
    await addTracks(tokens.access_token, pl.id, uris);
    results.push({ month: data.name, url: pl.url, added: uris.length, missing });
    console.log(`✅ ${name}: ${uris.length} faixas adicionadas (${missing} não encontradas) -> ${pl.url}`);
  }

  console.log("\n=== PLAYLISTS CRIADAS ===");
  for (const r of results) console.log(`${r.month.padEnd(10)} | ${String(r.added).padStart(3)} faixas | ${r.url}`);
}

main().catch((e) => { console.error("\n[ERRO]", e.message ?? e); process.exit(1); });
