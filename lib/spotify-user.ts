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
  "user-read-private",
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

function getRedirectUri(): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/spotify/callback`;
}

export function spotifyUserOAuthConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

export function buildSpotifyAuthorizeUrl(state: string): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("scope", SPOTIFY_USER_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("show_dialog", "true");
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

  if (!res.ok) return null;
  return (await res.json()) as TokenResponse;
}

export async function exchangeSpotifyAuthCode(code: string): Promise<TokenResponse | null> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
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

export async function fetchSpotifyCurrentUser(accessToken: string): Promise<{ id: string } | null> {
  const res = await spotifyUserFetch(accessToken, "/me");
  if (!res) return null;
  const json = (await res.json()) as { id?: string };
  return json.id ? { id: json.id } : null;
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
