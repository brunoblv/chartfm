/**
 * YouTube Data API v3 — OAuth do canal @chartFM e playlists do Push.
 * Usar apenas em Route Handlers / Server.
 */

import { prisma } from "@/lib/prisma";
import { MYTRL_OWNER_HANDLE } from "@/lib/mytrl-access";
import { pushRoundTitle } from "@/lib/push-format";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://www.googleapis.com/youtube/v3";

export const CHARTFM_YOUTUBE_HANDLE = "chartFM";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube",
].join(" ");

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

type YouTubeResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; needsReconnect?: boolean; message: string };

export type PushTrackForYouTube = {
  title: string;
  artist: string;
};

function normalizeOAuthOrigin(origin: string): string {
  return origin.replace(/^http:\/\/localhost(?=:\d+|\/|$)/i, "http://127.0.0.1");
}

function youtubeClientId(): string | undefined {
  return process.env.YOUTUBE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
}

function youtubeClientSecret(): string | undefined {
  return process.env.YOUTUBE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
}

export function youtubeOAuthConfigured(): boolean {
  return Boolean(youtubeClientId() && youtubeClientSecret());
}

export function getYouTubeRedirectUri(requestOrigin?: string): string {
  if (process.env.YOUTUBE_REDIRECT_URI) {
    return process.env.YOUTUBE_REDIRECT_URI.replace(/\/$/, "");
  }
  const base = normalizeOAuthOrigin(requestOrigin ?? process.env.NEXTAUTH_URL ?? "http://127.0.0.1:3000");
  return `${base.replace(/\/$/, "")}/api/youtube/connect/callback`;
}

export function buildYouTubeAuthorizeUrl(state: string, redirectUri: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", youtubeClientId()!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", YOUTUBE_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

async function exchangeTokens(body: URLSearchParams): Promise<TokenResponse | null> {
  const clientId = youtubeClientId();
  const clientSecret = youtubeClientSecret();
  if (!clientId || !clientSecret) return null;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[youtube] token exchange failed", res.status, text.slice(0, 300));
    return null;
  }
  return (await res.json()) as TokenResponse;
}

export async function exchangeYouTubeAuthCode(
  code: string,
  redirectUri: string,
): Promise<TokenResponse | null> {
  return exchangeTokens(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: youtubeClientId()!,
      client_secret: youtubeClientSecret()!,
    }),
  );
}

export async function refreshYouTubeToken(refreshToken: string): Promise<TokenResponse | null> {
  return exchangeTokens(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: youtubeClientId()!,
      client_secret: youtubeClientSecret()!,
    }),
  );
}

async function persistYouTubeTokens(
  userId: string,
  tokens: TokenResponse,
  existingRefresh?: string | null,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      youtubeAccessToken: tokens.access_token,
      youtubeRefreshToken: tokens.refresh_token ?? existingRefresh ?? undefined,
      youtubeTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000 - 60_000),
    },
  });
}

export async function getPushYouTubeOwnerUser() {
  return prisma.user.findUnique({
    where: { handle: MYTRL_OWNER_HANDLE },
    select: {
      id: true,
      handle: true,
      youtubeAccessToken: true,
      youtubeRefreshToken: true,
      youtubeTokenExpiresAt: true,
      youtubeChannelId: true,
      youtubeChannelHandle: true,
    },
  });
}

export async function getYouTubeAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      youtubeAccessToken: true,
      youtubeRefreshToken: true,
      youtubeTokenExpiresAt: true,
    },
  });

  if (!user?.youtubeRefreshToken && !user?.youtubeAccessToken) return null;

  const stillValid =
    user.youtubeAccessToken &&
    user.youtubeTokenExpiresAt &&
    user.youtubeTokenExpiresAt.getTime() > Date.now() + 30_000;

  if (stillValid) return user.youtubeAccessToken;

  if (!user.youtubeRefreshToken) return user.youtubeAccessToken;

  const refreshed = await refreshYouTubeToken(user.youtubeRefreshToken);
  if (!refreshed) return null;

  await persistYouTubeTokens(userId, refreshed, user.youtubeRefreshToken);
  return refreshed.access_token;
}

export async function fetchYouTubeChannel(accessToken: string): Promise<{
  id: string;
  handle: string | null;
  title: string;
} | null> {
  const res = await fetch(`${API_BASE}/channels?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    items?: { id: string; snippet?: { title?: string; customUrl?: string } }[];
  };
  const item = json.items?.[0];
  if (!item?.id) return null;

  const customUrl = item.snippet?.customUrl?.replace(/^@/, "") ?? null;
  return {
    id: item.id,
    handle: customUrl,
    title: item.snippet?.title ?? "YouTube",
  };
}

export function isChartFmChannel(handle: string | null | undefined): boolean {
  if (!handle) return false;
  const expected = (process.env.CHARTFM_YOUTUBE_HANDLE ?? CHARTFM_YOUTUBE_HANDLE).toLowerCase();
  return handle.replace(/^@/, "").toLowerCase() === expected;
}

export async function saveYouTubeConnection(
  userId: string,
  tokens: TokenResponse,
): Promise<{ channelId: string | null; channelHandle: string | null; isChartFm: boolean }> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { youtubeRefreshToken: true },
  });

  const channel = await fetchYouTubeChannel(tokens.access_token);

  await prisma.user.update({
    where: { id: userId },
    data: {
      youtubeAccessToken: tokens.access_token,
      youtubeRefreshToken: tokens.refresh_token ?? existing?.youtubeRefreshToken ?? undefined,
      youtubeTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000 - 60_000),
      youtubeChannelId: channel?.id ?? undefined,
      youtubeChannelHandle: channel?.handle ?? undefined,
    },
  });

  return {
    channelId: channel?.id ?? null,
    channelHandle: channel?.handle ?? null,
    isChartFm: isChartFmChannel(channel?.handle),
  };
}

export function youtubePlaylistUrl(playlistId: string): string {
  return `https://www.youtube.com/playlist?list=${playlistId}`;
}

/** Busca vídeo no YouTube a partir de título/artista (usa YOUTUBE_API_KEY). */
export async function searchYouTubeVideoId(title: string, artist: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) return null;

  const queries = [
    `${artist} ${title} topic`,
    `${artist} - ${title}`,
    `${artist} ${title} official audio`,
  ];

  for (const q of queries) {
    const url = new URL(`${API_BASE}/search`);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("videoCategoryId", "10");
    url.searchParams.set("maxResults", "3");
    url.searchParams.set("q", q);
    url.searchParams.set("key", apiKey);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) continue;

    const json = (await res.json()) as {
      items?: { id?: { videoId?: string } }[];
    };
    const videoId = json.items?.[0]?.id?.videoId;
    if (videoId) return videoId;
  }

  return null;
}

export async function resolveYouTubeVideoIds(
  tracks: PushTrackForYouTube[],
): Promise<{ videoIds: string[]; missing: PushTrackForYouTube[] }> {
  const videoIds: string[] = [];
  const missing: PushTrackForYouTube[] = [];
  const seen = new Set<string>();

  for (const track of tracks) {
    const id = await searchYouTubeVideoId(track.title, track.artist);
    if (id && !seen.has(id)) {
      seen.add(id);
      videoIds.push(id);
    } else {
      missing.push(track);
    }
  }

  return { videoIds, missing };
}

async function youtubeApiFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<YouTubeResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
    return {
      ok: false,
      status: res.status,
      needsReconnect: true,
      message: body?.error?.message?.includes("Insufficient")
        ? "Falta permissão no YouTube. Reconecte a conta @chartFM em Configurações."
        : "Sem permissão no YouTube. Reconecte a conta @chartFM em Configurações.",
    };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[youtube] API error", path, res.status, body.slice(0, 300));
    return { ok: false, status: res.status, message: "Erro na API do YouTube." };
  }

  if (res.status === 204) return { ok: true, data: undefined as T };
  return { ok: true, data: (await res.json()) as T };
}

export async function createYouTubePlaylist(
  accessToken: string,
  title: string,
  description: string,
): Promise<YouTubeResult<{ id: string; url: string }>> {
  const result = await youtubeApiFetch<{ id: string }>(
    accessToken,
    "/playlists?part=snippet,status",
    {
      method: "POST",
      body: JSON.stringify({
        snippet: { title: title.slice(0, 150), description: description.slice(0, 5000) },
        status: { privacyStatus: "public" },
      }),
    },
  );

  if (!result.ok) return result;
  if (!result.data.id) {
    return { ok: false, status: 500, message: "Resposta inválida ao criar playlist." };
  }

  return { ok: true, data: { id: result.data.id, url: youtubePlaylistUrl(result.data.id) } };
}

async function listPlaylistItemIds(accessToken: string, playlistId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${API_BASE}/playlistItems`);
    url.searchParams.set("part", "id");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) break;

    const json = (await res.json()) as {
      items?: { id?: string }[];
      nextPageToken?: string;
    };
    for (const item of json.items ?? []) {
      if (item.id) ids.push(item.id);
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  return ids;
}

export async function replaceYouTubePlaylistVideos(
  accessToken: string,
  playlistId: string,
  videoIds: string[],
): Promise<YouTubeResult<{ added: number }>> {
  const existing = await listPlaylistItemIds(accessToken, playlistId);
  for (const itemId of existing) {
    const del = await youtubeApiFetch<void>(
      accessToken,
      `/playlistItems?id=${encodeURIComponent(itemId)}`,
      { method: "DELETE" },
    );
    if (!del.ok) return del;
  }

  let added = 0;
  for (const videoId of videoIds) {
    const ins = await youtubeApiFetch<void>(
      accessToken,
      "/playlistItems?part=snippet",
      {
        method: "POST",
        body: JSON.stringify({
          snippet: {
            playlistId,
            resourceId: { kind: "youtube#video", videoId },
          },
        }),
      },
    );
    if (!ins.ok) return ins;
    added++;
  }

  return { ok: true, data: { added } };
}

export async function addVideosToYouTubePlaylist(
  accessToken: string,
  playlistId: string,
  videoIds: string[],
): Promise<YouTubeResult<{ added: number }>> {
  let added = 0;
  for (const videoId of videoIds) {
    const ins = await youtubeApiFetch<void>(
      accessToken,
      "/playlistItems?part=snippet",
      {
        method: "POST",
        body: JSON.stringify({
          snippet: {
            playlistId,
            resourceId: { kind: "youtube#video", videoId },
          },
        }),
      },
    );
    if (!ins.ok) return ins;
    added++;
  }
  return { ok: true, data: { added } };
}

export type SyncPushYouTubeResult =
  | { ok: true; playlistId: string; playlistUrl: string; videoCount: number; missing: PushTrackForYouTube[] }
  | { ok: false; message: string; needsReconnect?: boolean };

/** Cria uma nova playlist do Push no canal @chartFM (sempre nova, para histórico). */
export async function syncPushYouTubePlaylist(opts: {
  roundId: string;
  roundNumber: number;
  season: number;
  tracks: PushTrackForYouTube[];
}): Promise<SyncPushYouTubeResult> {
  const owner = await getPushYouTubeOwnerUser();
  const token = owner?.id ? await getYouTubeAccessToken(owner.id) : null;
  if (!token) {
    return {
      ok: false,
      needsReconnect: true,
      message: "Conta YouTube (@chartFM) não conectada. Reconecte em Configurações.",
    };
  }

  if (opts.tracks.length === 0) {
    return { ok: false, message: "Nenhuma música inscrita ainda." };
  }

  const existing = await prisma.pushRound.findUnique({
    where: { id: opts.roundId },
    select: { youtubePlaylistId: true },
  });
  if (existing?.youtubePlaylistId) {
    return {
      ok: true,
      playlistId: existing.youtubePlaylistId,
      playlistUrl: youtubePlaylistUrl(existing.youtubePlaylistId),
      videoCount: 0,
      missing: [],
    };
  }

  const { videoIds, missing } = await resolveYouTubeVideoIds(opts.tracks);
  if (videoIds.length === 0) {
    return { ok: false, message: "Não foi possível encontrar vídeos no YouTube para as músicas inscritas." };
  }

  const playlistName = pushRoundTitle(opts.season, opts.roundNumber);
  const description = `Playlist do jogo Push no ChartFM · youtube.com/@chartFM`;

  const created = await createYouTubePlaylist(token, playlistName, description);
  if (!created.ok) {
    return { ok: false, message: created.message, needsReconnect: created.needsReconnect };
  }

  const added = await addVideosToYouTubePlaylist(token, created.data.id, videoIds);
  if (!added.ok) {
    return { ok: false, message: added.message, needsReconnect: added.needsReconnect };
  }

  await prisma.pushRound.update({
    where: { id: opts.roundId },
    data: { youtubePlaylistId: created.data.id },
  });

  return {
    ok: true,
    playlistId: created.data.id,
    playlistUrl: created.data.url,
    videoCount: videoIds.length,
    missing,
  };
}
