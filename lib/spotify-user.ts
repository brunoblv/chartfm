/**
 * Spotify OAuth (Authorization Code) para acesso às playlists privadas do usuário.
 * Usar apenas em Route Handlers / Server — nunca no bundle do cliente.
 */

import { prisma } from "@/lib/prisma";
import { MYTRL_OWNER_HANDLE } from "@/lib/mytrl-access";
import { pickAlbumImageUrl } from "@/lib/spotify-server";

const AUTH_URL = "https://accounts.spotify.com/api/token";
const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const API_BASE = "https://api.spotify.com/v1";

export const SPOTIFY_USER_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-private",
  "user-read-recently-played",
].join(" ");

export const NEW_HITS_PLAYLIST_NAME = "new hits";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

type SpotifyPlaylistItem = {
  id: string;
  name: string;
};

type SpotifyPlaylistsPage = {
  items: SpotifyPlaylistItem[];
  next: string | null;
};

type SpotifyPlaylistTrackItem = {
  track: {
    id: string;
    name: string;
    artists: { id: string; name: string }[];
    album: { name: string; images: { url: string; height: number | null }[] };
  } | null;
};

type SpotifyPlaylistTracksPage = {
  items: SpotifyPlaylistTrackItem[];
  next: string | null;
};

export type NewHitsTrack = {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  imageUrl: string | null;
};

/** Spotify rejeita `localhost` no redirect — normaliza para 127.0.0.1. */
function normalizeSpotifyOAuthOrigin(origin: string): string {
  return origin.replace(/^http:\/\/localhost(?=:\d+|\/|$)/i, "http://127.0.0.1");
}

/** URI de callback OAuth para o admin — deve coincidir exatamente com o Spotify Developer Dashboard. */
export function getSpotifyRedirectUri(requestOrigin?: string): string {
  if (process.env.SPOTIFY_REDIRECT_URI) {
    return process.env.SPOTIFY_REDIRECT_URI.replace(/\/$/, "");
  }
  const base = normalizeSpotifyOAuthOrigin(requestOrigin ?? process.env.NEXTAUTH_URL ?? "http://127.0.0.1:3000");
  return `${base.replace(/\/$/, "")}/api/spotify/callback`;
}

/** URI de callback OAuth para usuários comuns — registrar também no Spotify Developer Dashboard. */
export function getSpotifyUserConnectRedirectUri(requestOrigin?: string): string {
  if (process.env.SPOTIFY_USER_REDIRECT_URI) {
    return process.env.SPOTIFY_USER_REDIRECT_URI.replace(/\/$/, "");
  }
  const base = normalizeSpotifyOAuthOrigin(requestOrigin ?? process.env.NEXTAUTH_URL ?? "http://127.0.0.1:3000");
  return `${base.replace(/\/$/, "")}/api/spotify/connect/callback`;
}

export function spotifyUserOAuthConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

export function buildSpotifyAuthorizeUrl(state: string, redirectUri: string): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SPOTIFY_USER_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("show_dialog", "true");
  url.searchParams.set("access_type", "offline");
  return url.toString();
}

async function exchangeTokens(body: URLSearchParams): Promise<TokenResponse | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[spotify] token exchange failed", res.status, body.slice(0, 300));
    return null;
  }
  return (await res.json()) as TokenResponse;
}

export async function exchangeSpotifyAuthCode(
  code: string,
  redirectUri: string,
): Promise<TokenResponse | null> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  return exchangeTokens(body);
}

export async function refreshSpotifyUserToken(refreshToken: string): Promise<TokenResponse | null> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return exchangeTokens(body);
}

async function persistTokens(
  userId: string,
  tokens: TokenResponse,
  existingRefresh?: string | null,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      spotifyAccessToken: tokens.access_token,
      spotifyRefreshToken: tokens.refresh_token ?? existingRefresh ?? undefined,
      spotifyTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000 - 60_000),
    },
  });
}

export async function getMyTrlOwnerUser() {
  return prisma.user.findUnique({
    where: { handle: MYTRL_OWNER_HANDLE },
    select: {
      id: true,
      handle: true,
      lastfmUser: true,
      spotifyAccessToken: true,
      spotifyRefreshToken: true,
      spotifyTokenExpiresAt: true,
      spotifyUserId: true,
      spotifyNewHitsPlaylistId: true,
    },
  });
}

export async function getSpotifyUserAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      spotifyAccessToken: true,
      spotifyRefreshToken: true,
      spotifyTokenExpiresAt: true,
    },
  });

  if (!user?.spotifyRefreshToken && !user?.spotifyAccessToken) return null;

  const stillValid =
    user.spotifyAccessToken &&
    user.spotifyTokenExpiresAt &&
    user.spotifyTokenExpiresAt.getTime() > Date.now() + 30_000;

  if (stillValid) return user.spotifyAccessToken;

  if (!user.spotifyRefreshToken) return user.spotifyAccessToken;

  const refreshed = await refreshSpotifyUserToken(user.spotifyRefreshToken);
  if (!refreshed) return null;

  await persistTokens(userId, refreshed, user.spotifyRefreshToken);
  return refreshed.access_token;
}

async function spotifyUserFetch(accessToken: string, path: string): Promise<Response | null> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res;
}

export async function fetchSpotifyMeStatus(
  accessToken: string,
): Promise<{ ok: boolean; status: number; id?: string }> {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status };
  const json = (await res.json()) as { id?: string };
  return { ok: true, status: res.status, id: json.id };
}

export async function fetchSpotifyCurrentUser(accessToken: string): Promise<{ id: string } | null> {
  const me = await fetchSpotifyMeStatus(accessToken);
  return me.ok && me.id ? { id: me.id } : null;
}

export async function findNewHitsPlaylistId(accessToken: string): Promise<string | null> {
  let url: string | null = "/me/playlists?limit=50";
  const target = NEW_HITS_PLAYLIST_NAME.toLowerCase();

  while (url) {
    const res = await spotifyUserFetch(accessToken, url.replace(API_BASE, ""));
    if (!res) break;
    const json = (await res.json()) as SpotifyPlaylistsPage;
    for (const pl of json.items ?? []) {
      if (pl.name.trim().toLowerCase() === target) return pl.id;
    }
    url = json.next;
  }

  return null;
}

export async function fetchNewHitsTracks(accessToken: string, playlistId: string): Promise<NewHitsTrack[]> {
  const out: NewHitsTrack[] = [];
  let url: string | null = `/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100&market=BR`;

  while (url) {
    const res = await spotifyUserFetch(accessToken, url.replace(API_BASE, ""));
    if (!res) break;
    const json = (await res.json()) as SpotifyPlaylistTracksPage;
    for (const item of json.items ?? []) {
      const track = item.track;
      if (!track?.id) continue;
      out.push({
        spotifyId: track.id,
        title: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        album: track.album.name,
        imageUrl: pickAlbumImageUrl(track.album.images as { url: string; height: number | null; width: number | null }[]),
      });
    }
    url = json.next ? json.next.replace(API_BASE, "") : null;
  }

  return out;
}

export async function saveUserSpotifyTokens(userId: string, tokens: TokenResponse): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { spotifyRefreshToken: true },
  });
  const me = await fetchSpotifyCurrentUser(tokens.access_token);
  await prisma.user.update({
    where: { id: userId },
    data: {
      spotifyAccessToken: tokens.access_token,
      spotifyRefreshToken: tokens.refresh_token ?? existing?.spotifyRefreshToken ?? undefined,
      spotifyTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000 - 60_000),
      spotifyUserId: me?.id ?? undefined,
    },
  });
}

export async function saveSpotifyConnection(
  userId: string,
  tokens: TokenResponse,
): Promise<{ playlistId: string | null; playlistFound: boolean }> {
  const me = await fetchSpotifyCurrentUser(tokens.access_token);
  const playlistId = await findNewHitsPlaylistId(tokens.access_token);

  await prisma.user.update({
    where: { id: userId },
    data: {
      spotifyAccessToken: tokens.access_token,
      spotifyRefreshToken: tokens.refresh_token ?? undefined,
      spotifyTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000 - 60_000),
      spotifyUserId: me?.id ?? undefined,
      spotifyNewHitsPlaylistId: playlistId ?? undefined,
    },
  });

  return { playlistId, playlistFound: Boolean(playlistId) };
}

export async function getNewHitsSpotifyIds(userId: string): Promise<Set<string>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { spotifyNewHitsPlaylistId: true },
  });
  if (!user?.spotifyNewHitsPlaylistId) return new Set();

  const token = await getSpotifyUserAccessToken(userId);
  if (!token) return new Set();

  const tracks = await fetchNewHitsTracks(token, user.spotifyNewHitsPlaylistId);
  return new Set(tracks.map((t) => t.spotifyId));
}

export async function getNewHitsTracksForUser(userId: string): Promise<NewHitsTrack[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { spotifyNewHitsPlaylistId: true },
  });
  if (!user?.spotifyNewHitsPlaylistId) return [];

  const token = await getSpotifyUserAccessToken(userId);
  if (!token) return [];

  return fetchNewHitsTracks(token, user.spotifyNewHitsPlaylistId);
}

export function mapNewHitsToLookup(tracks: NewHitsTrack[]): Map<string, NewHitsTrack> {
  return new Map(tracks.map((t) => [t.spotifyId, t]));
}

type SpotifyRecentlyPlayedItem = {
  track: {
    id: string;
    name: string;
    artists: { id: string; name: string }[];
    album: { name: string; images: { url: string; height: number | null }[] };
  };
  played_at: string;
};

type SpotifyRecentlyPlayedPage = {
  items: SpotifyRecentlyPlayedItem[];
  next: string | null;
};

export type RecentTrack = {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  imageUrl: string | null;
  playedAt: string;
};

/** Erro de autorização do Spotify que exige reconectar a conta (token inválido ou sem o escopo necessário). */
export class SpotifyAuthError extends Error {
  readonly needsReconnect = true;
  constructor(message: string) {
    super(message);
    this.name = "SpotifyAuthError";
  }
}

export async function fetchSpotifyRecentlyPlayed(
  accessToken: string,
  limit: number = 50,
): Promise<RecentTrack[]> {
  const clampedLimit = Math.min(50, Math.max(1, limit));
  // Não usamos `spotifyUserFetch` aqui porque ele engole o status de erro:
  // precisamos distinguir 401/403 (reconectar) de uma indisponibilidade temporária.
  const res = await fetch(`${API_BASE}/me/player/recently-played?limit=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new SpotifyAuthError(
        "Sua conexão com o Spotify está sem a permissão necessária (músicas recentes). Reconecte sua conta para continuar.",
      );
    }
    throw new Error(`Falha ao buscar músicas recentes no Spotify (HTTP ${res.status}).`);
  }

  const json = (await res.json()) as SpotifyRecentlyPlayedPage;
  const seen = new Set<string>();
  const out: RecentTrack[] = [];

  for (const item of json.items ?? []) {
    const track = item.track;
    if (!track?.id || seen.has(track.id)) continue;
    seen.add(track.id);
    out.push({
      spotifyId: track.id,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album.name,
      imageUrl: pickAlbumImageUrl(
        track.album.images as { url: string; height: number | null; width: number | null }[],
      ),
      playedAt: item.played_at,
    });
    if (out.length >= clampedLimit) break;
  }

  return out;
}

export type SpotifyPlaylistCreateResult =
  | { ok: true; id: string; url: string }
  | { ok: false; status: number; needsReconnect?: boolean; message: string };

export type SpotifyPlaylistAddTracksResult =
  | { ok: true }
  | { ok: false; status: number; needsReconnect?: boolean; message: string };

/** Cria playlist na conta do usuário autenticado. */
export async function createSpotifyPlaylist(
  accessToken: string,
  name: string,
  description: string,
  isPublic = false,
): Promise<SpotifyPlaylistCreateResult> {
  const res = await fetch(`${API_BASE}/me/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: name.slice(0, 100),
      description: description.slice(0, 300),
      public: isPublic,
    }),
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
    const insufficientScope = body?.error?.message === "Insufficient client scope";
    return {
      ok: false,
      status: res.status,
      needsReconnect: true,
      message: insufficientScope
        ? "Falta permissão para criar playlists. Reconecte o Spotify em Configurações para autorizar acesso de escrita."
        : "Sem permissão para criar playlists. Reconecte sua conta Spotify nas configurações.",
    };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[spotify] create playlist failed", res.status, body.slice(0, 300));
    return { ok: false, status: res.status, message: "Não foi possível criar a playlist no Spotify." };
  }

  const json = (await res.json()) as { id?: string; external_urls?: { spotify?: string } };
  if (!json.id) {
    return { ok: false, status: res.status, message: "Resposta inválida ao criar playlist." };
  }

  return {
    ok: true,
    id: json.id,
    url: json.external_urls?.spotify ?? `https://open.spotify.com/playlist/${json.id}`,
  };
}

/** Substitui todas as faixas de uma playlist (PUT para as primeiras 100, POST para o restante). */
export async function replaceTracksInSpotifyPlaylist(
  accessToken: string,
  playlistId: string,
  trackUris: string[],
): Promise<SpotifyPlaylistAddTracksResult> {
  const firstBatch = trackUris.slice(0, 100);
  const res = await fetch(`${API_BASE}/playlists/${encodeURIComponent(playlistId)}/tracks`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: firstBatch }),
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
    const insufficientScope = body?.error?.message === "Insufficient client scope";
    return {
      ok: false,
      status: res.status,
      needsReconnect: true,
      message: insufficientScope
        ? "Falta permissão para editar playlists. Reconecte o Spotify em Configurações."
        : "Sem permissão para editar playlists. Reconecte sua conta Spotify.",
    };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[spotify] replace playlist tracks failed", res.status, body.slice(0, 300));
    return { ok: false, status: res.status, message: "Não foi possível atualizar a playlist." };
  }

  if (trackUris.length > 100) {
    return addTracksToSpotifyPlaylist(accessToken, playlistId, trackUris.slice(100));
  }

  return { ok: true };
}

/** Adiciona faixas a uma playlist (lotes de até 100 URIs). */
export async function addTracksToSpotifyPlaylist(
  accessToken: string,
  playlistId: string,
  trackUris: string[],
): Promise<SpotifyPlaylistAddTracksResult> {
  for (let i = 0; i < trackUris.length; i += 100) {
    const batch = trackUris.slice(i, i + 100);
    const res = await fetch(`${API_BASE}/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: batch }),
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) {
      const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
      const insufficientScope = body?.error?.message === "Insufficient client scope";
      return {
        ok: false,
        status: res.status,
        needsReconnect: true,
        message: insufficientScope
          ? "Falta permissão para editar playlists. Reconecte o Spotify em Configurações."
          : "Sem permissão para editar playlists. Reconecte sua conta Spotify nas configurações.",
      };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[spotify] add tracks failed", res.status, body.slice(0, 300));
      return { ok: false, status: res.status, message: "Não foi possível adicionar músicas à playlist." };
    }
  }

  return { ok: true };
}
