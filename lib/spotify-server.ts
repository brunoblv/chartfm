/**
 * Integração com a Web API do Spotify (client credentials).
 * Usar apenas em Route Handlers / Server Components — nunca no bundle do cliente.
 *
 * Apps:
 * - principal (SPOTIFY_CLIENT_ID) + backup (…_BACKUP): uso geral (busca manual, admin)
 * - backup2 (…_BACKUP2): exclusivo do pool "user-charts" — criação/import de paradas de
 *   usuário (POST /api/charts, /api/charts/[id], /api/lastfm/import). Só cai pro
 *   principal/backup se o BACKUP2 tomar 429.
 * - backup3 (…_BACKUP3): exclusivo do pool "crownnote" — tela /admin/crownnote-export,
 *   isolado da contenção dos outros três apps
 *   (ver lib/spotify-user-charts-pool.ts — não importar async_hooks aqui: este arquivo
 *   também é puxado por componentes client via lib/copa.ts)
 */

import { isInstrumentalTitle } from "./is-instrumental-title";
import { recordSpotifyCall } from "./spotify-usage-log";

type SpotifyAppPool = "default" | "user-charts" | "crownnote";

/** Injetado por lib/spotify-user-charts-pool.ts (server-only) no boot das rotas de parada. */
let spotifyAppPoolGetter: () => SpotifyAppPool = () => "default";

/** @internal — só para spotify-user-charts-pool.ts */
export function __setSpotifyAppPoolGetter(getter: () => SpotifyAppPool): void {
  spotifyAppPoolGetter = getter;
}

function currentSpotifyPool(): SpotifyAppPool {
  return spotifyAppPoolGetter();
}

const AUTH_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";
const SPOTIFY_RETRY_MAX_ATTEMPTS = 4;
const SPOTIFY_RETRY_BASE_DELAY_MS = 450;
const SPOTIFY_RETRY_MAX_DELAY_MS = 15000;

// Espaçamento global entre chamadas à API (gateway): serializa a saída num ritmo
// constante em vez de rajadas — o perfil de rajada é o que dispara 429, não o volume.
const SPOTIFY_MIN_CALL_SPACING_MS = 250;
let nextCallAt = 0;

async function acquireCallSlot(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextCallAt);
  nextCallAt = slot + SPOTIFY_MIN_CALL_SPACING_MS;
  if (slot > now) await sleep(slot - now);
}

// Dedup de chamadas em voo: várias requisições simultâneas pelo mesmo recurso
// compartilham uma única chamada à API (versão in-process do "lock distribuído").
const inFlight = new Map<string, Promise<unknown>>();

function dedupeInFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

type SpotifyImage = { url: string; height: number | null; width: number | null };

type SpotifyTrackApi = {
  id: string;
  name: string;
  artists: { id: string; name: string; external_urls?: { spotify?: string } }[];
  album: {
    id: string;
    name: string;
    images: SpotifyImage[];
    album_type?: string;
    artists?: { id: string; name: string }[];
    release_date?: string;
    total_tracks?: number;
    external_urls?: { spotify?: string };
  };
  external_urls: { spotify: string };
  preview_url: string | null;
  duration_ms?: number;
  track_number?: number;
  external_ids?: { isrc?: string };
};

type SpotifySearchJson = {
  tracks?: { items: SpotifyTrackApi[] };
};

type TokenState = { accessToken: string | null; expiresAt: number; failedUntil?: number };

const tokenState: TokenState = {
  accessToken: null,
  expiresAt: 0,
};

// App de backup (SPOTIFY_CLIENT_ID_BACKUP/_SECRET_BACKUP): assume as chamadas quando o
// app principal recebe 429. O principal fica marcado como limitado pelo prazo do
// Retry-After (ou 5min) e getAccessToken passa a entregar o token do backup nesse período.
const backupTokenState: TokenState = {
  accessToken: null,
  expiresAt: 0,
};
// BACKUP2 — exclusivo para paradas de usuário (pool user-charts), só se principal + backup
// estiverem limitados/indisponíveis.
const backup2TokenState: TokenState = {
  accessToken: null,
  expiresAt: 0,
};
// BACKUP3 — exclusivo do pool "crownnote" (tela /admin/crownnote-export), isolado dos
// outros apps para não competir por rate limit com o resto do site.
const backup3TokenState: TokenState = {
  accessToken: null,
  expiresAt: 0,
};
// Falha ao obter token fica cacheada por 60s: sem isso, com credencial quebrada cada
// chamada re-tenta o endpoint de token (até 10s de timeout cada) e estoura o prazo da rota.
const TOKEN_FAILURE_CACHE_MS = 60_000;
let primaryLimitedUntil = 0;
let backupLimitedUntil = 0;
let backup2LimitedUntil = 0;
let backup3LimitedUntil = 0;
const PRIMARY_LIMITED_DEFAULT_MS = 5 * 60_000;

export function backupSpotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID_BACKUP && process.env.SPOTIFY_CLIENT_SECRET_BACKUP);
}

export function backup2SpotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID_BACKUP2 && process.env.SPOTIFY_CLIENT_SECRET_BACKUP2);
}

export function backup3SpotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID_BACKUP3 && process.env.SPOTIFY_CLIENT_SECRET_BACKUP3);
}

/** Epoch ms até quando o app principal está marcado como limitado (0 = não limitado). */
export function getPrimaryLimitedUntil(): number {
  return primaryLimitedUntil;
}

/** Epoch ms até quando o backup1 está marcado como limitado (0 = não limitado). */
export function getBackupLimitedUntil(): number {
  return backupLimitedUntil;
}

/** Epoch ms até quando o BACKUP2 (pool "user-charts") está marcado como limitado (0 = não limitado). */
export function getBackup2LimitedUntil(): number {
  return backup2LimitedUntil;
}

/** Epoch ms até quando o BACKUP3 está marcado como limitado (0 = não limitado). */
export function getBackup3LimitedUntil(): number {
  return backup3LimitedUntil;
}

/** Marca o app principal como limitado — getAccessToken passa a entregar o token do backup no período. */
export function markPrimaryLimited(ms: number = PRIMARY_LIMITED_DEFAULT_MS): void {
  primaryLimitedUntil = Math.max(primaryLimitedUntil, Date.now() + ms);
}

export function markBackupLimited(ms: number = PRIMARY_LIMITED_DEFAULT_MS): void {
  backupLimitedUntil = Math.max(backupLimitedUntil, Date.now() + ms);
}

const coverCache = new Map<string, string | null>();
const COVER_CACHE_MAX = 500;

type SearchCacheEntry = { tracks: ReturnType<typeof mapTrackToResult>[]; expiresAt: number };
const searchCache = new Map<string, SearchCacheEntry>();
const SEARCH_CACHE_MAX = 5000;
// Resultados de busca mudam devagar — cache longo elimina re-consultas dos mesmos termos.
const SEARCH_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
  return null;
}

const SPOTIFY_FETCH_TIMEOUT_MS = 10000;

function appForAuthHeader(
  init: RequestInit,
  input: string | URL,
): "primary" | "backup" | "backup2" | "backup3" | "token" {
  const raw = typeof input === "string" ? input : input.toString();
  if (raw.includes("accounts.spotify.com")) return "token";
  const authHeader = (init.headers as Record<string, string> | undefined)?.Authorization;
  if (backup3TokenState.accessToken && authHeader === `Bearer ${backup3TokenState.accessToken}`) return "backup3";
  if (backup2TokenState.accessToken && authHeader === `Bearer ${backup2TokenState.accessToken}`) return "backup2";
  if (backupTokenState.accessToken && authHeader === `Bearer ${backupTokenState.accessToken}`) return "backup";
  return "primary";
}

async function spotifyFetch(
  input: string | URL,
  init: RequestInit,
  maxAttempts: number = SPOTIFY_RETRY_MAX_ATTEMPTS,
  // Prazo absoluto (epoch ms): não inicia espera de retry que ultrapasse o prazo —
  // essencial em rotas atrás do nginx (~60s), onde dormir 120s num 429 vira 504.
  deadlineAt?: number,
): Promise<Response | null> {
  let triedBackup = false;
  let triedPrimaryFromBackup2 = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await acquireCallSlot();
    let res: Response;
    const timeoutSignal = AbortSignal.timeout(SPOTIFY_FETCH_TIMEOUT_MS);
    const mergedSignal =
      init.signal
        ? AbortSignal.any([init.signal as AbortSignal, timeoutSignal])
        : timeoutSignal;
    try {
      res = await fetch(input, { ...init, signal: mergedSignal });
    } catch {
      recordSpotifyCall({ input, app: appForAuthHeader(init, input), status: null });
      if (attempt >= maxAttempts) return null;
      await sleep(SPOTIFY_RETRY_BASE_DELAY_MS * attempt);
      continue;
    }

    recordSpotifyCall({
      input,
      app: appForAuthHeader(init, input),
      status: res.status,
      retryAfterS:
        res.status === 429 ? Math.round((parseRetryAfterMs(res.headers.get("retry-after")) ?? 0) / 1000) || null : null,
    });

    if (res.ok) return res;

    // Failover: erro de limite/credencial/servidor (429, 401, 403, 5xx) com o token do app
    // principal → marca o principal como limitado e refaz na hora com o app de backup (não
    // conta como retry). 400/404 ficam de fora: são "recurso não encontrado", não problema
    // do app. Se a chamada já estava no backup (ou é a rota de token), segue o fluxo normal.
    // BACKUP2 só entra no pool user-charts (criação de paradas), quando backup1 também falha.
    const failoverEligible =
      res.status === 429 || res.status === 401 || res.status === 403 || res.status >= 500;
    const authHeader = (init.headers as Record<string, string> | undefined)?.Authorization;
    const limitMs = parseRetryAfterMs(res.headers.get("retry-after")) ?? PRIMARY_LIMITED_DEFAULT_MS;
    const onPrimary =
      Boolean(tokenState.accessToken) && authHeader === `Bearer ${tokenState.accessToken}`;
    const onBackup =
      Boolean(backupTokenState.accessToken) && authHeader === `Bearer ${backupTokenState.accessToken}`;
    const onBackup2 =
      Boolean(backup2TokenState.accessToken) && authHeader === `Bearer ${backup2TokenState.accessToken}`;
    const onBackup3 =
      Boolean(backup3TokenState.accessToken) && authHeader === `Bearer ${backup3TokenState.accessToken}`;

    // BACKUP3 é isolado (pool "crownnote"): só se marca como limitado, sem cadeia de
    // failover pros outros apps — evita reintroduzir a contenção que ele existe pra evitar.
    if (failoverEligible && onBackup3) {
      backup3LimitedUntil = Math.max(backup3LimitedUntil, Date.now() + limitMs);
    }

    // BACKUP2 é exclusivo do pool "user-charts" (criação/import de paradas de usuário):
    // ao falhar, marca como limitado e cai pro app principal na hora (que segue a cadeia
    // normal principal → backup logo abaixo, se também falhar).
    if (failoverEligible && onBackup2 && !triedPrimaryFromBackup2) {
      triedPrimaryFromBackup2 = true;
      backup2LimitedUntil = Math.max(backup2LimitedUntil, Date.now() + limitMs);
      const primaryToken = await getPrimaryAccessToken();
      if (primaryToken) {
        console.warn(
          `[spotify] HTTP ${res.status} no BACKUP2 (paradas de usuário) — usando app principal por ${Math.ceil(limitMs / 1000)}s`,
        );
        init = { ...init, headers: { ...init.headers, Authorization: `Bearer ${primaryToken}` } };
        attempt -= 1;
        continue;
      }
    }

    if (failoverEligible && !triedBackup && backupSpotifyConfigured() && onPrimary) {
      triedBackup = true;
      primaryLimitedUntil = Date.now() + limitMs;
      const backupToken = await getBackupAccessToken();
      if (backupToken) {
        console.warn(`[spotify] HTTP ${res.status} no app principal — usando app de backup por ${Math.ceil(limitMs / 1000)}s`);
        init = { ...init, headers: { ...init.headers, Authorization: `Bearer ${backupToken}` } };
        attempt -= 1;
        continue;
      }
    }

    if (failoverEligible && onBackup) {
      backupLimitedUntil = Math.max(backupLimitedUntil, Date.now() + limitMs);
    }

    if (res.status !== 429) return res;

    if (attempt >= maxAttempts) return res;

    const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
    const delay =
      retryAfterMs != null
        ? Math.min(120_000, retryAfterMs)
        : Math.min(SPOTIFY_RETRY_MAX_DELAY_MS, SPOTIFY_RETRY_BASE_DELAY_MS * attempt);
    // Com prazo, desiste em vez de dormir além dele (quem chamou trata o 429).
    if (deadlineAt !== undefined && Date.now() + delay >= deadlineAt) return res;
    await sleep(delay);
  }
  return null;
}

function trimKey(artist: string, title: string) {
  return `${artist.trim().toLowerCase()}|${title.trim().toLowerCase()}`;
}

function cacheSet(key: string, url: string | null) {
  if (coverCache.size >= COVER_CACHE_MAX) {
    const first = coverCache.keys().next().value;
    if (first !== undefined) coverCache.delete(first);
  }
  coverCache.set(key, url);
}

function searchCacheSet(key: string, tracks: SearchCacheEntry["tracks"]) {
  if (searchCache.size >= SEARCH_CACHE_MAX) {
    const first = searchCache.keys().next().value;
    if (first !== undefined) searchCache.delete(first);
  }
  searchCache.set(key, { tracks, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
}

export function spotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

/** ID de faixa Spotify: 22 caracteres base62 com ao menos uma maiúscula. */
export function isSpotifyTrackId(id: string): boolean {
  const s = id.trim();
  return /^[A-Za-z0-9]{22}$/.test(s) && /[A-Z]/.test(s);
}

async function fetchClientCredentialsToken(
  clientId: string,
  clientSecret: string,
  state: TokenState,
): Promise<string | null> {
  if (state.accessToken && Date.now() < state.expiresAt) {
    return state.accessToken;
  }
  if (state.failedUntil && Date.now() < state.failedUntil) {
    return null;
  }

  const res = await spotifyFetch(
    AUTH_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    },
    1, // 1 tentativa: falha rápido em vez de acumular retries longos
  );

  if (!res?.ok) {
    console.error(`[spotify] getAccessToken failed: status=${res?.status ?? "no_response"}`);
    state.failedUntil = Date.now() + TOKEN_FAILURE_CACHE_MS;
    return null;
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  state.accessToken = data.access_token;
  state.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  state.failedUntil = 0;
  return state.accessToken;
}

/** Token do app principal — usado pelo failover do BACKUP2 (pool "user-charts") em spotifyFetch. */
async function getPrimaryAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return fetchClientCredentialsToken(clientId, clientSecret, tokenState);
}

/** Token do app de backup — exportado para o /api/spotify/search entregar ao browser
 * como fallback quando a busca direta tomar 429 no token principal. */
export async function getBackupAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID_BACKUP;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET_BACKUP;
  if (!clientId || !clientSecret) return null;
  return fetchClientCredentialsToken(clientId, clientSecret, backupTokenState);
}

/** Token do BACKUP2 — só usado no pool user-charts (paradas de usuário). */
export async function getBackup2AccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID_BACKUP2;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET_BACKUP2;
  if (!clientId || !clientSecret) return null;
  return fetchClientCredentialsToken(clientId, clientSecret, backup2TokenState);
}

/** Token do BACKUP3 — dedicado ao pool "crownnote" (tela /admin/crownnote-export). */
export async function getBackup3AccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID_BACKUP3;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET_BACKUP3;
  if (!clientId || !clientSecret) return null;
  return fetchClientCredentialsToken(clientId, clientSecret, backup3TokenState);
}

export async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const pool = currentSpotifyPool();
  const now = Date.now();

  // Pool "crownnote": usa o BACKUP3 dedicado, isolado da contenção dos outros três
  // apps. Só cai pro fluxo normal abaixo se o BACKUP3 não estiver configurado ou o
  // token dele falhar.
  if (pool === "crownnote" && backup3SpotifyConfigured()) {
    const backup3Token = await getBackup3AccessToken();
    if (backup3Token) return backup3Token;
  }

  // Pool "user-charts" (criação/import de paradas de usuário): BACKUP2 é exclusivo —
  // primeira opção sempre, sem competir com o principal/backup usados pelo resto do
  // site. Só cai pro fluxo normal abaixo se não estiver configurado, sem token, ou
  // marcado como limitado por um 429 recente (ver spotifyFetch).
  if (pool === "user-charts" && backup2SpotifyConfigured() && now >= backup2LimitedUntil) {
    const backup2Token = await getBackup2AccessToken();
    if (backup2Token) return backup2Token;
  }

  // App principal em 429 recente: entrega o token do backup enquanto durar o prazo.
  if (now < primaryLimitedUntil) {
    if (backupSpotifyConfigured() && now >= backupLimitedUntil) {
      const backupToken = await getBackupAccessToken();
      if (backupToken) return backupToken;
    }
  }

  const primaryToken = await fetchClientCredentialsToken(clientId, clientSecret, tokenState);
  if (primaryToken) return primaryToken;

  // Token do principal falhou (credencial inválida/rede) → tenta o backup na hora.
  if (backupSpotifyConfigured() && now >= backupLimitedUntil) {
    const backupToken = await getBackupAccessToken();
    if (backupToken) return backupToken;
  }

  return getBackupAccessToken();
}

export type SpotifyProbeResult = {
  ok: boolean;
  error?: string;
  status?: number;
  retryAfterMs?: number | null;
};

/** Testa credenciais e conectividade com a API do Spotify. */
export async function probeSpotifyApi(): Promise<SpotifyProbeResult> {
  if (!spotifyConfigured()) {
    return { ok: false, error: "SPOTIFY_CLIENT_ID ou SPOTIFY_CLIENT_SECRET ausentes no ambiente" };
  }
  const token = await getAccessToken();
  if (!token) {
    return { ok: false, error: "Não foi possível obter access token (credenciais inválidas ou rede)" };
  }
  const res = await spotifyFetch(
    `${API_BASE}/tracks/11dFghVXANMlKmJXsNCbNl?market=BR`,
    { headers: { Authorization: `Bearer ${token}` } },
    1, // probe é diagnóstico: falha rápido e reporta status/retry-after em vez de dormir nos retries
  );
  if (!res?.ok) {
    const status = res?.status;
    const retryAfterMs = status === 429 ? parseRetryAfterMs(res?.headers.get("retry-after") ?? null) : null;
    return {
      ok: false,
      status,
      retryAfterMs,
      error: `API Spotify respondeu HTTP ${status ?? "sem resposta"}`,
    };
  }
  return { ok: true };
}

/** Testa credenciais e conectividade do app de backup (SPOTIFY_CLIENT_ID_BACKUP), sem tocar o app principal. */
export async function probeSpotifyBackupApi(): Promise<SpotifyProbeResult> {
  if (!backupSpotifyConfigured()) {
    return { ok: false, error: "SPOTIFY_CLIENT_ID_BACKUP ou SPOTIFY_CLIENT_SECRET_BACKUP ausentes no ambiente" };
  }
  const token = await getBackupAccessToken();
  if (!token) {
    return { ok: false, error: "Não foi possível obter access token do backup (credenciais inválidas ou rede)" };
  }
  const res = await spotifyFetch(
    `${API_BASE}/tracks/11dFghVXANMlKmJXsNCbNl?market=BR`,
    { headers: { Authorization: `Bearer ${token}` } },
    1,
  );
  if (!res?.ok) {
    const status = res?.status;
    const retryAfterMs = status === 429 ? parseRetryAfterMs(res?.headers.get("retry-after") ?? null) : null;
    return {
      ok: false,
      status,
      retryAfterMs,
      error: `API Spotify (backup) respondeu HTTP ${status ?? "sem resposta"}`,
    };
  }
  return { ok: true };
}

/** Testa o BACKUP2 (paradas de usuário), sem failover para os outros apps. */
export async function probeSpotifyBackup2Api(): Promise<SpotifyProbeResult> {
  if (!backup2SpotifyConfigured()) {
    return {
      ok: false,
      error: "SPOTIFY_CLIENT_ID_BACKUP2 ou SPOTIFY_CLIENT_SECRET_BACKUP2 ausentes no ambiente",
    };
  }
  const token = await getBackup2AccessToken();
  if (!token) {
    return {
      ok: false,
      error: "Não foi possível obter access token do BACKUP2 (credenciais inválidas ou rede)",
    };
  }
  const res = await spotifyFetch(
    `${API_BASE}/tracks/11dFghVXANMlKmJXsNCbNl?market=BR`,
    { headers: { Authorization: `Bearer ${token}` } },
    1,
  );
  if (!res?.ok) {
    const status = res?.status;
    const retryAfterMs = status === 429 ? parseRetryAfterMs(res?.headers.get("retry-after") ?? null) : null;
    return {
      ok: false,
      status,
      retryAfterMs,
      error: `API Spotify (BACKUP2) respondeu HTTP ${status ?? "sem resposta"}`,
    };
  }
  return { ok: true };
}

/** Testa o BACKUP3 (pool "crownnote"), sem failover para os outros apps. */
export async function probeSpotifyBackup3Api(): Promise<SpotifyProbeResult> {
  if (!backup3SpotifyConfigured()) {
    return {
      ok: false,
      error: "SPOTIFY_CLIENT_ID_BACKUP3 ou SPOTIFY_CLIENT_SECRET_BACKUP3 ausentes no ambiente",
    };
  }
  const token = await getBackup3AccessToken();
  if (!token) {
    return {
      ok: false,
      error: "Não foi possível obter access token do BACKUP3 (credenciais inválidas ou rede)",
    };
  }
  const res = await spotifyFetch(
    `${API_BASE}/tracks/11dFghVXANMlKmJXsNCbNl?market=BR`,
    { headers: { Authorization: `Bearer ${token}` } },
    1,
  );
  if (!res?.ok) {
    const status = res?.status;
    const retryAfterMs = status === 429 ? parseRetryAfterMs(res?.headers.get("retry-after") ?? null) : null;
    return {
      ok: false,
      status,
      retryAfterMs,
      error: `API Spotify (BACKUP3) respondeu HTTP ${status ?? "sem resposta"}`,
    };
  }
  return { ok: true };
}

/** Aguarda rate limit (429) antes de scripts em lote. */
export async function waitForSpotifyApi(opts?: { maxWaitMs?: number }): Promise<SpotifyProbeResult> {
  const maxWaitMs = opts?.maxWaitMs ?? 180_000;
  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;

  while (true) {
    const probe = await probeSpotifyApi();
    if (probe.ok) return probe;

    const is429 = probe.status === 429;
    if (!is429 || Date.now() >= deadline) return probe;

    const waitMs = Math.min(
      deadline - Date.now(),
      probe.retryAfterMs ?? Math.min(60_000, 5_000 * (attempt + 1)),
    );
    attempt += 1;
    console.log(`Spotify rate limit (429) — aguardando ${Math.ceil(waitMs / 1000)}s (tentativa ${attempt})...`);
    await sleep(waitMs);
  }
}

export function pickAlbumImageUrl(images: SpotifyImage[] | undefined): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  const preferred = sorted.find((i) => (i.height ?? 0) >= 300) ?? sorted[0];
  return preferred?.url ?? null;
}

export function mapTrackToResult(track: SpotifyTrackApi) {
  const artist = track.artists.map((a) => a.name).join(", ");
  return {
    spotifyId: track.id,
    title: track.name,
    artist,
    artistNames: track.artists.map((a) => a.name),
    album: track.album.name,
    albumType: track.album.album_type?.toLowerCase() ?? null,
    albumArtistNames: (track.album.artists ?? []).map((a) => a.name),
    imageUrl: pickAlbumImageUrl(track.album.images),
    previewUrl: track.preview_url,
    externalUrl: track.external_urls.spotify,
  };
}

// Tags que indicam versões não-originais de um álbum
const EDITION_PATTERN =
  /\b(deluxe|super\s+deluxe|special\s+edition|bonus\s+track|expanded|anniversary|remaster(?:ed)?|reissue|edition|re-?release)\b/i;

// Sufixos de faixa que devem ser ignorados ao agrupar versões do mesmo song
const TRACK_SUFFIX_PATTERN =
  /\s*[\-–—]\s*(remaster(?:ed)?|radio\s+edit|single\s+version|album\s+version|acoustic|demo|instrumental|live|mono|stereo)[^)]*$/i;
const TRACK_PAREN_PATTERN =
  /\s*\((?:remaster(?:ed)?|radio\s+edit|single\s+version|album\s+version|acoustic|demo|instrumental|live|mono|stereo)[^)]*\)/gi;

function canonicalSongKey(track: SpotifyTrackApi): string {
  const title = track.name
    .replace(TRACK_PAREN_PATTERN, "")
    .replace(TRACK_SUFFIX_PATTERN, "")
    .toLowerCase()
    .trim();
  const artist = (track.artists[0]?.name ?? "").toLowerCase().trim();
  return `${artist}|${title}`;
}

function sortReleaseMs(raw: string | undefined): number {
  if (!raw) return Infinity;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00Z`).getTime();
  if (/^\d{4}-\d{2}$/.test(raw)) return new Date(`${raw}-01T00:00:00Z`).getTime();
  if (/^\d{4}$/.test(raw)) return new Date(`${raw}-01-01T00:00:00Z`).getTime();
  return Infinity;
}

function isCompilationAlbum(track: SpotifyTrackApi): boolean {
  if (track.album.album_type?.toLowerCase() === "compilation") return true;
  return (track.album.artists ?? []).some((a) => /various artists/i.test(a.name));
}

function pickBestVersion(tracks: SpotifyTrackApi[]): SpotifyTrackApi {
  return [...tracks].sort((a, b) => {
    // Coletâneas (album_type compilation / Various Artists) por último: a mesma
    // faixa em álbum/single do próprio artista sempre vence.
    const aComp = isCompilationAlbum(a) ? 1 : 0;
    const bComp = isCompilationAlbum(b) ? 1 : 0;
    if (aComp !== bComp) return aComp - bComp;
    const aEdition = EDITION_PATTERN.test(a.album.name) ? 1 : 0;
    const bEdition = EDITION_PATTERN.test(b.album.name) ? 1 : 0;
    if (aEdition !== bEdition) return aEdition - bEdition;
    return sortReleaseMs(a.album.release_date) - sortReleaseMs(b.album.release_date);
  })[0];
}

export async function searchSpotifyTracks(
  query: string,
  limit = 10,
  market: string = "BR",
  signal?: AbortSignal,
  opts?: { maxAttempts?: number; deadlineAt?: number },
) {
  const q = query.trim();
  const lim = Math.min(50, Math.max(1, limit));
  const cacheKey = `${q}|${lim}|${market}`;

  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.tracks;

  return dedupeInFlight(`search:${cacheKey}`, () => searchSpotifyTracksUncached(q, lim, market, signal, opts));
}

async function searchSpotifyTracksUncached(
  q: string,
  lim: number,
  market: string,
  signal?: AbortSignal,
  opts?: { maxAttempts?: number; deadlineAt?: number },
) {
  const cacheKey = `${q}|${lim}|${market}`;
  const token = await getAccessToken();
  if (!token) return [];

  if (signal?.aborted) return [];

  // Busca mais candidatos para ter opções suficientes após deduplicação. Cap em 10:
  // os apps BACKUP2/BACKUP3 (sem extended quota mode) respondem 400 "Invalid limit"
  // acima disso — limite universal evita depender de qual app atende a chamada.
  const fetchLimit = Math.min(10, lim * 4);
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", String(fetchLimit));
  url.searchParams.set("market", market);

  const res = await spotifyFetch(
    url.toString(),
    {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
      signal,
    },
    opts?.maxAttempts ?? SPOTIFY_RETRY_MAX_ATTEMPTS,
    opts?.deadlineAt,
  );

  if (!res?.ok) return [];

  const json = (await res.json()) as SpotifySearchJson;
  const items = json.tracks?.items ?? [];

  // Agrupa por (título normalizado, artista principal) e escolhe a melhor versão:
  // sem tags de edição primeiro, depois a mais antiga
  const groups = new Map<string, SpotifyTrackApi[]>();
  for (const item of items) {
    if (isInstrumentalTitle(item.name)) continue;
    const key = canonicalSongKey(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const tracks = [...groups.values()]
    .map(pickBestVersion)
    .slice(0, lim)
    .map(mapTrackToResult);

  searchCacheSet(cacheKey, tracks);
  return tracks;
}

export type SpotifyTrackMetadata = {
  spotifyId: string;
  title: string;
  artistDisplay: string;
  artists: { spotifyId: string; name: string; spotifyUrl?: string | null }[];
  primaryArtist: { spotifyId: string; name: string; spotifyUrl?: string | null } | null;
  featuredArtists: { spotifyId: string; name: string; spotifyUrl?: string | null }[];
  album: {
    spotifyId: string | null;
    title: string | null;
    coverUrl: string | null;
    albumType: "SINGLE" | "EP" | "ALBUM" | "COMPILATION" | null;
    releaseDate: Date | null;
    totalTracks: number | null;
    spotifyUrl: string | null;
  };
  previewUrl: string | null;
  spotifyUrl: string | null;
  durationMs: number | null;
  trackNumber: number | null;
  isrc: string | null;
};

function mapAlbumType(input: string | undefined): SpotifyTrackMetadata["album"]["albumType"] {
  if (!input) return null;
  const value = input.toUpperCase();
  if (value === "SINGLE" || value === "EP" || value === "ALBUM" || value === "COMPILATION") return value;
  return null;
}

function parseSpotifyReleaseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00.000Z`);
  if (/^\d{4}-\d{2}$/.test(raw)) return new Date(`${raw}-01T00:00:00.000Z`);
  if (/^\d{4}$/.test(raw)) return new Date(`${raw}-01-01T00:00:00.000Z`);
  return null;
}

type SpotifyAlbumTracksPageJson = {
  items: { id: string; name: string }[];
  next: string | null;
};

/** IDs e títulos das faixas tal como listadas no álbum (evita “canonical” de outro relançamento). */
export async function listSpotifyAlbumTracks(
  albumSpotifyId: string,
  market: string = "MX",
): Promise<{ spotifyId: string; title: string }[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const aid = albumSpotifyId.trim();
  if (!aid) return [];

  const out: { spotifyId: string; title: string }[] = [];
  let url: string | null =
    `${API_BASE}/albums/${encodeURIComponent(aid)}/tracks?limit=50&market=${encodeURIComponent(market)}`;
  while (url) {
    const res = await spotifyFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });
    if (!res?.ok) break;
    const json = (await res.json()) as SpotifyAlbumTracksPageJson;
    for (const it of json.items ?? []) {
      if (it?.id && it?.name && !isInstrumentalTitle(it.name)) out.push({ spotifyId: it.id, title: it.name });
    }
    url = json.next ?? null;
  }
  return out;
}

type SpotifyArtistAlbumsPageJson = {
  items: {
    id: string;
    name: string;
    album_type?: string;
    release_date?: string;
  }[];
  next: string | null;
};

export type SpotifyArtistAlbumRef = {
  spotifyId: string;
  name: string;
  albumType: string | null;
  releaseDate: string | null;
};

/** Álbuns/singles/compilações vinculados ao artista (GET /artists/{id}/albums, todas as páginas). */
export async function listSpotifyArtistAlbums(
  artistSpotifyId: string,
  market: string = "KR",
): Promise<SpotifyArtistAlbumRef[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const id = artistSpotifyId.trim();
  if (!id) return [];

  const includeGroups = ["album", "single", "appears_on", "compilation"].join(",");
  const out: SpotifyArtistAlbumRef[] = [];
  let url: string | null =
    `${API_BASE}/artists/${encodeURIComponent(id)}/albums?include_groups=${encodeURIComponent(includeGroups)}&market=${encodeURIComponent(market)}&limit=50`;

  while (url) {
    const res = await spotifyFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });
    if (!res?.ok) break;
    const json = (await res.json()) as SpotifyArtistAlbumsPageJson;
    for (const it of json.items ?? []) {
      if (it?.id && it?.name) {
        out.push({
          spotifyId: it.id,
          name: it.name,
          albumType: it.album_type ?? null,
          releaseDate: it.release_date ?? null,
        });
      }
    }
    url = json.next ?? null;
  }
  return out;
}

/**
 * Lançamentos recentes do artista (só álbuns e singles, 1ª página — os 50 mais novos).
 * Versão leve de `listSpotifyArtistAlbums` para o Radar de Lançamentos: sem appears_on
 * e sem paginação, já que só interessam datas dentro da janela do radar.
 */
export async function listSpotifyArtistRecentReleases(
  artistSpotifyId: string,
  market: string = "BR",
  opts?: { maxAttempts?: number },
): Promise<SpotifyArtistAlbumRef[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const id = artistSpotifyId.trim();
  if (!id) return [];

  const url =
    `${API_BASE}/artists/${encodeURIComponent(id)}/albums?include_groups=album,single&market=${encodeURIComponent(market)}&limit=50`;
  const res = await spotifyFetch(
    url,
    {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    },
    opts?.maxAttempts ?? SPOTIFY_RETRY_MAX_ATTEMPTS,
  );
  if (!res?.ok) return [];
  const json = (await res.json()) as SpotifyArtistAlbumsPageJson;
  return (json.items ?? [])
    .filter((it) => Boolean(it?.id && it?.name))
    .map((it) => ({
      spotifyId: it.id,
      name: it.name,
      albumType: it.album_type ?? null,
      releaseDate: it.release_date ?? null,
    }));
}

type SpotifyAlbumApi = {
  id: string;
  name: string;
  album_type?: string;
  images: SpotifyImage[];
  release_date?: string;
  total_tracks?: number;
  label?: string;
  external_urls?: { spotify?: string };
  artists?: { id: string; name: string }[];
};

export type SpotifyAlbumDetails = {
  spotifyId: string;
  title: string;
  coverUrl: string | null;
  albumType: string | null;
  releaseDate: string | null;
  totalTracks: number | null;
  spotifyUrl: string | null;
  label: string | null;
  artistSpotifyId: string | null;
  artistName: string | null;
};

/** Metadados do álbum (capa, datas) para alinhar com um `album_id` concreto no catálogo. */
export async function getSpotifyAlbumMetadataById(
  albumSpotifyId: string,
  market: string = "MX",
  opts?: { maxAttempts?: number },
): Promise<SpotifyTrackMetadata["album"] | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const id = albumSpotifyId.trim();
  if (!id) return null;

  const res = await spotifyFetch(
    `${API_BASE}/albums/${encodeURIComponent(id)}?market=${encodeURIComponent(market)}`,
    { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 0 } },
    opts?.maxAttempts ?? SPOTIFY_RETRY_MAX_ATTEMPTS,
  );
  if (!res?.ok) return null;
  const a = (await res.json()) as SpotifyAlbumApi;
  if (!a?.id) return null;
  return {
    spotifyId: a.id,
    title: a.name,
    coverUrl: pickAlbumImageUrl(a.images),
    albumType: mapAlbumType(a.album_type),
    releaseDate: parseSpotifyReleaseDate(a.release_date),
    totalTracks: a.total_tracks ?? null,
    spotifyUrl: a.external_urls?.spotify ?? null,
  };
}

export async function getSpotifyAlbumDetails(
  albumSpotifyId: string,
  market: string = "BR",
  opts?: { maxAttempts?: number },
): Promise<SpotifyAlbumDetails | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const id = albumSpotifyId.trim();
  if (!id) return null;

  const res = await spotifyFetch(
    `${API_BASE}/albums/${encodeURIComponent(id)}?market=${encodeURIComponent(market)}`,
    { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 3600 } },
    opts?.maxAttempts ?? SPOTIFY_RETRY_MAX_ATTEMPTS,
  );
  if (!res?.ok) return null;
  const a = (await res.json()) as SpotifyAlbumApi;
  if (!a?.id) return null;
  const rd = parseSpotifyReleaseDate(a.release_date);
  return {
    spotifyId: a.id,
    title: a.name,
    coverUrl: pickAlbumImageUrl(a.images),
    albumType: mapAlbumType(a.album_type),
    releaseDate: rd ? rd.toISOString().slice(0, 10) : null,
    totalTracks: a.total_tracks ?? null,
    spotifyUrl: a.external_urls?.spotify ?? null,
    label: a.label ?? null,
    artistSpotifyId: a.artists?.[0]?.id ?? null,
    artistName: a.artists?.[0]?.name ?? null,
  };
}

function mapTrackApiToMetadata(track: SpotifyTrackApi): SpotifyTrackMetadata {
  const artists = track.artists
    .filter((a) => Boolean(a.id))
    .map((a) => ({ spotifyId: a.id, name: a.name, spotifyUrl: a.external_urls?.spotify ?? null }));
  const primaryArtist = artists[0] ?? null;
  const featuredArtists = artists.slice(1);

  return {
    spotifyId: track.id,
    title: track.name,
    artistDisplay: track.artists.map((a) => a.name).join(", "),
    artists,
    primaryArtist,
    featuredArtists,
    album: {
      spotifyId: track.album?.id ?? null,
      title: track.album?.name ?? null,
      coverUrl: pickAlbumImageUrl(track.album?.images),
      albumType: mapAlbumType(track.album?.album_type),
      releaseDate: parseSpotifyReleaseDate(track.album?.release_date),
      totalTracks: track.album?.total_tracks ?? null,
      spotifyUrl: track.album?.external_urls?.spotify ?? null,
    },
    previewUrl: track.preview_url ?? null,
    spotifyUrl: track.external_urls?.spotify ?? null,
    durationMs: track.duration_ms ?? null,
    trackNumber: track.track_number ?? null,
    isrc: track.external_ids?.isrc?.trim() || null,
  };
}

// Metadados de faixa mudam quase nunca — cache curto (1h) segura repetições
// (ex.: usuário reenviando a mesma parada) sem atrasar correções no Spotify.
const trackMetadataCache = new Map<string, { meta: SpotifyTrackMetadata | null; expiresAt: number }>();
const TRACK_METADATA_CACHE_MAX = 2000;
const TRACK_METADATA_CACHE_TTL_MS = 60 * 60 * 1000;

function trackMetadataCacheSet(key: string, meta: SpotifyTrackMetadata | null) {
  if (trackMetadataCache.size >= TRACK_METADATA_CACHE_MAX) {
    const first = trackMetadataCache.keys().next().value;
    if (first !== undefined) trackMetadataCache.delete(first);
  }
  trackMetadataCache.set(key, { meta, expiresAt: Date.now() + TRACK_METADATA_CACHE_TTL_MS });
}

export async function getSpotifyTrackMetadataById(
  trackId: string,
  market: string = "BR",
  opts?: { maxAttempts?: number; deadlineAt?: number },
): Promise<SpotifyTrackMetadata | null> {
  const id = trackId.trim();
  if (!id) return null;

  const cacheKey = `${id}|${market}`;
  const cached = trackMetadataCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.meta;

  return dedupeInFlight(`track:${cacheKey}`, () => getSpotifyTrackMetadataByIdUncached(id, market, opts));
}

async function getSpotifyTrackMetadataByIdUncached(
  id: string,
  market: string,
  opts?: { maxAttempts?: number; deadlineAt?: number },
): Promise<SpotifyTrackMetadata | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const res = await spotifyFetch(
    `${API_BASE}/tracks/${encodeURIComponent(id)}?market=${encodeURIComponent(market)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    },
    opts?.maxAttempts ?? SPOTIFY_RETRY_MAX_ATTEMPTS,
    opts?.deadlineAt,
  );
  if (!res?.ok) return null;
  const track = (await res.json()) as SpotifyTrackApi;
  if (!track?.id) return null;
  const meta = mapTrackApiToMetadata(track);
  trackMetadataCacheSet(`${id}|${market}`, meta);
  return meta;
}

export type SpotifyBatchMetadataResult = {
  metadata: Map<string, SpotifyTrackMetadata>;
  invalidIds: string[];
  tokenMissing: boolean;
  batchErrors: number;
};

/** Metadados de várias faixas (lotes de 50) — usado na publicação rápida para salvar capas. */
export async function getSpotifyTracksMetadataByIds(
  trackIds: string[],
  market: string = "BR",
  opts?: { maxAttempts?: number; deadlineAt?: number },
): Promise<SpotifyBatchMetadataResult> {
  const metadata = new Map<string, SpotifyTrackMetadata>();
  const unique = [...new Set(trackIds.map((id) => id.trim()).filter(Boolean))];
  const invalidIds = unique.filter((id) => !isSpotifyTrackId(id));
  const validIds = unique.filter((id) => isSpotifyTrackId(id));
  if (validIds.length === 0) {
    return { metadata, invalidIds, tokenMissing: !spotifyConfigured(), batchErrors: 0 };
  }

  const token = await getAccessToken();
  if (!token) {
    return { metadata, invalidIds, tokenMissing: true, batchErrors: validIds.length };
  }

  let batchErrors = 0;
  for (let i = 0; i < validIds.length; i += 50) {
    const batch = validIds.slice(i, i + 50);
    const res = await spotifyFetch(
      `${API_BASE}/tracks?ids=${batch.join(",")}&market=${encodeURIComponent(market)}`,
      { headers: { Authorization: `Bearer ${token}` } },
      opts?.maxAttempts ?? SPOTIFY_RETRY_MAX_ATTEMPTS,
      opts?.deadlineAt,
    );
    if (!res?.ok) {
      batchErrors += batch.length;
      console.error(`[spotify] batch tracks failed: status=${res?.status ?? "no_response"}`);
      continue;
    }
    const json = (await res.json()) as { tracks?: (SpotifyTrackApi | null)[] };
    for (const track of json.tracks ?? []) {
      if (!track?.id) continue;
      metadata.set(track.id, mapTrackApiToMetadata(track));
    }
  }

  return { metadata, invalidIds, tokenMissing: false, batchErrors };
}

type SpotifyArtistApi = {
  id: string;
  name: string;
  genres?: string[];
  images: SpotifyImage[];
  external_urls?: { spotify?: string };
};

export type SpotifyArtistProfile = {
  spotifyId: string;
  name: string;
  genres: string[];
  imageUrl: string | null;
  spotifyUrl: string | null;
};

function mapArtistApiToProfile(artist: SpotifyArtistApi): SpotifyArtistProfile {
  return {
    spotifyId: artist.id,
    name: artist.name,
    genres: artist.genres ?? [],
    imageUrl: pickAlbumImageUrl(artist.images),
    spotifyUrl: artist.external_urls?.spotify ?? null,
  };
}

// Perfis de artista mudam raramente (nome/foto/gêneros) — cache de 30 dias por processo.
const artistProfileCache = new Map<string, { profile: SpotifyArtistProfile | null; expiresAt: number }>();
const ARTIST_PROFILE_CACHE_MAX = 3000;
const ARTIST_PROFILE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function artistProfileCacheSet(id: string, profile: SpotifyArtistProfile | null) {
  if (artistProfileCache.size >= ARTIST_PROFILE_CACHE_MAX) {
    const first = artistProfileCache.keys().next().value;
    if (first !== undefined) artistProfileCache.delete(first);
  }
  artistProfileCache.set(id, { profile, expiresAt: Date.now() + ARTIST_PROFILE_CACHE_TTL_MS });
}

/** Perfil oficial do artista (GET /artists/{id}), incluindo fotos. Cache de 30 dias + dedup em voo. */
export async function getSpotifyArtistById(
  spotifyId: string,
  opts?: { maxAttempts?: number },
): Promise<SpotifyArtistProfile | null> {
  const id = spotifyId.trim();
  if (!id) return null;

  const cached = artistProfileCache.get(id);
  if (cached && Date.now() < cached.expiresAt) return cached.profile;

  return dedupeInFlight(`artist:${id}`, () => getSpotifyArtistByIdUncached(id, opts));
}

async function getSpotifyArtistByIdUncached(
  id: string,
  opts?: { maxAttempts?: number },
): Promise<SpotifyArtistProfile | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const res = await spotifyFetch(
    `${API_BASE}/artists/${encodeURIComponent(id)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    },
    opts?.maxAttempts ?? SPOTIFY_RETRY_MAX_ATTEMPTS,
  );
  if (!res?.ok) return null;

  const artist = (await res.json()) as SpotifyArtistApi;
  if (!artist?.id) return null;
  const profile = mapArtistApiToProfile(artist);
  artistProfileCacheSet(id, profile);
  return profile;
}

type SpotifyArtistSearchJson = {
  artists?: { items: SpotifyArtistApi[] };
};

export async function searchSpotifyArtist(
  name: string,
  market: string = "BR",
): Promise<SpotifyArtistProfile | null> {
  const many = await searchSpotifyArtists(name, 1, market);
  return many[0] ?? null;
}

/** Vários artistas (para backfill / desambiguação). */
export async function searchSpotifyArtists(
  name: string,
  limit = 5,
  market: string = "US",
  opts?: { maxAttempts?: number; deadlineAt?: number },
): Promise<SpotifyArtistProfile[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const lim = Math.min(10, Math.max(1, limit));
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("q", name.trim());
  url.searchParams.set("type", "artist");
  url.searchParams.set("limit", String(lim));
  url.searchParams.set("market", market);

  const res = await spotifyFetch(
    url.toString(),
    {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    },
    opts?.maxAttempts ?? SPOTIFY_RETRY_MAX_ATTEMPTS,
    opts?.deadlineAt,
  );
  if (!res?.ok) return [];

  const json = (await res.json()) as SpotifyArtistSearchJson;
  const items = json.artists?.items ?? [];
  return items.map(mapArtistApiToProfile);
}

type SpotifyTopTracksJson = { tracks: SpotifyTrackApi[] };

/** Top tracks do artista (útil quando a pesquisa global de faixa não encontra). */
export async function getSpotifyArtistTopTracks(
  artistSpotifyId: string,
  market: string = "US",
): Promise<SpotifyTrackApi[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const id = artistSpotifyId.trim();
  if (!id) return [];

  const res = await spotifyFetch(
    `${API_BASE}/artists/${encodeURIComponent(id)}/top-tracks?market=${encodeURIComponent(market)}`,
    { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 0 } },
  );
  if (!res?.ok) return [];
  const json = (await res.json()) as SpotifyTopTracksJson;
  return json.tracks ?? [];
}

type SpotifyAlbumSearchItem = {
  id: string;
  name: string;
  album_type?: string;
  images: SpotifyImage[];
  release_date?: string;
  total_tracks?: number;
  external_urls?: { spotify?: string };
  artists: { id: string; name: string }[];
};

type SpotifyAlbumSearchJson = {
  albums?: { items: SpotifyAlbumSearchItem[] };
};

export type SpotifyAlbumSearchResult = {
  spotifyId: string;
  title: string;
  artist: string;
  artistSpotifyId: string | null;
  coverUrl: string | null;
  albumType: string | null;
  releaseDate: string | null;
  totalTracks: number | null;
  spotifyUrl: string | null;
};

const ALBUM_EDITION_PAREN_PATTERN =
  /\s*\((?:deluxe|super\s+deluxe|special|bonus(?:\s+track[s]?)?|expanded|anniversary|remaster(?:ed)?|reissue|re-?release|edition|version|explicit)[^)]*\)/gi;

const ALBUM_EDITION_SUFFIX_PATTERN =
  /\s*[\-–—]\s*(?:deluxe|super\s+deluxe|special\s+edition|bonus(?:\s+track[s]?)?|expanded|anniversary|remaster(?:ed)?|reissue|re-?release)[^\-–—]*$/i;

function canonicalAlbumKey(album: SpotifyAlbumSearchItem): string {
  const title = album.name
    .replace(ALBUM_EDITION_PAREN_PATTERN, "")
    .replace(ALBUM_EDITION_SUFFIX_PATTERN, "")
    .toLowerCase()
    .trim();
  const artist = (album.artists[0]?.name ?? "").toLowerCase().trim();
  return `${artist}|${title}`;
}

function pickBestAlbum(albums: SpotifyAlbumSearchItem[]): SpotifyAlbumSearchItem {
  return [...albums].sort((a, b) => {
    const aEdition = EDITION_PATTERN.test(a.name) ? 1 : 0;
    const bEdition = EDITION_PATTERN.test(b.name) ? 1 : 0;
    if (aEdition !== bEdition) return aEdition - bEdition;
    return sortReleaseMs(a.release_date) - sortReleaseMs(b.release_date);
  })[0];
}

export async function searchSpotifyAlbums(
  query: string,
  limit = 8,
  market: string = "BR",
  opts?: { maxAttempts?: number },
): Promise<SpotifyAlbumSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const token = await getAccessToken();
  if (!token) return [];

  const lim = Math.min(20, Math.max(1, limit));
  const fetchLimit = Math.min(50, lim * 4);
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("type", "album");
  url.searchParams.set("limit", String(fetchLimit));
  url.searchParams.set("market", market);

  const res = await spotifyFetch(
    url.toString(),
    {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    },
    opts?.maxAttempts ?? SPOTIFY_RETRY_MAX_ATTEMPTS,
  );
  if (!res?.ok) return [];

  const json = (await res.json()) as SpotifyAlbumSearchJson;
  const items = json.albums?.items ?? [];

  try {
    const groups = new Map<string, SpotifyAlbumSearchItem[]>();
    for (const item of items) {
      const key = canonicalAlbumKey(item);
      const group = groups.get(key);
      if (group) group.push(item);
      else groups.set(key, [item]);
    }

    return [...groups.values()]
      .map(pickBestAlbum)
      .slice(0, lim)
      .map((a) => {
        const rd = parseSpotifyReleaseDate(a.release_date);
        return {
          spotifyId: a.id,
          title: a.name,
          artist: a.artists.map((ar) => ar.name).join(", "),
          artistSpotifyId: a.artists[0]?.id ?? null,
          coverUrl: pickAlbumImageUrl(a.images),
          albumType: mapAlbumType(a.album_type),
          releaseDate: rd ? rd.toISOString().slice(0, 10) : null,
          totalTracks: a.total_tracks ?? null,
          spotifyUrl: a.external_urls?.spotify ?? null,
        };
      });
  } catch (err) {
    console.error("[searchSpotifyAlbums] dedup error, falling back to raw results:", err);
    return items.slice(0, lim).map((a) => {
      const rd = parseSpotifyReleaseDate(a.release_date);
      return {
        spotifyId: a.id,
        title: a.name,
        artist: a.artists.map((ar) => ar.name).join(", "),
        artistSpotifyId: a.artists[0]?.id ?? null,
        coverUrl: pickAlbumImageUrl(a.images),
        albumType: mapAlbumType(a.album_type),
        releaseDate: rd ? rd.toISOString().slice(0, 10) : null,
        totalTracks: a.total_tracks ?? null,
        spotifyUrl: a.external_urls?.spotify ?? null,
      };
    });
  }
}

export async function resolveCoverImageUrl(artist: string, title: string): Promise<string | null> {
  const key = trimKey(artist, title);
  if (coverCache.has(key)) return coverCache.get(key)!;

  const token = await getAccessToken();
  if (!token) {
    cacheSet(key, null);
    return null;
  }

  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("q", `${title} ${artist}`);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", "1");
  url.searchParams.set("market", "BR");

  const res = await spotifyFetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });

  if (!res?.ok) {
    cacheSet(key, null);
    return null;
  }

  const json = (await res.json()) as SpotifySearchJson;
  const track = json.tracks?.items?.[0];
  const img = track ? pickAlbumImageUrl(track.album.images) : null;
  cacheSet(key, img);
  return img;
}

const trackCoverCache = new Map<string, string | null>();
const TRACK_COVER_CACHE_MAX = 300;

function trackCoverCacheSet(id: string, url: string | null) {
  if (trackCoverCache.size >= TRACK_COVER_CACHE_MAX) {
    const first = trackCoverCache.keys().next().value;
    if (first !== undefined) trackCoverCache.delete(first);
  }
  trackCoverCache.set(id, url);
}

/** Busca capas de álbum para uma lista de track IDs do Spotify (lotes de 50). */
export async function fetchSpotifyTrackCovers(trackIds: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (trackIds.length === 0) return result;

  const missing: string[] = [];
  for (const id of trackIds) {
    if (trackCoverCache.has(id)) {
      result.set(id, trackCoverCache.get(id)!);
    } else {
      missing.push(id);
    }
  }
  if (missing.length === 0) return result;

  const token = await getAccessToken();
  if (!token) return result;

  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    const res = await spotifyFetch(
      `${API_BASE}/tracks?ids=${batch.join(",")}&market=BR`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 0 } },
    );
    if (!res?.ok) continue;
    const json = (await res.json()) as { tracks?: SpotifyTrackApi[] };
    for (const track of json.tracks ?? []) {
      if (!track?.id) continue;
      const url = pickAlbumImageUrl(track.album?.images);
      trackCoverCacheSet(track.id, url);
      result.set(track.id, url);
    }
  }

  return result;
}
