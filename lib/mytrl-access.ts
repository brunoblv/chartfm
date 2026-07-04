export const MYTRL_OWNER_HANDLE = "bruno";

/**
 * Playlist-fonte fixa do top 10 diário MyTRL (ID Spotify). Tem prioridade sobre a
 * detecção por nome (`findNewHitsPlaylistId`), então sobrevive a reconexões do Spotify
 * e a renomeações da playlist. Sobrescrevível por env `MYTRL_PLAYLIST_ID` sem deploy.
 * Atual: "Voting List: UMS Video Countdown".
 */
export const MYTRL_SOURCE_PLAYLIST_ID =
  process.env.MYTRL_PLAYLIST_ID?.trim() || "5UQFdjqm65yDgjg0imMrjb";

/** Parada diária @bruno — top 10 new hits (MyTRL → UMS Request Live). */
export const UMS_REQUEST_LIVE_PARADA_ID = "cmc06e6c262cf93ad97616c3c";

/** Parada semanal @bruno alimentada pelo MyTRL (sexta 8:05 BRT, após as 5 diárias). */
export const MYTRL_WEEKLY_PARADA_ID = "cmpn5qqi20001mly9beqx3xkt";

/** Alias: Top 20 semanal Under My Skin Video (@bruno). */
export const UMS_VIDEO_WEEKLY_PARADA_ID = MYTRL_WEEKLY_PARADA_ID;

/** Parada semanal Hot 100 (@bruno). */
export const UMS_HOT_100_PARADA_ID = "cmqyiop8m00012b83w8d56h7e";

/** Paradas visíveis só para @bruno (não aparecem no perfil público, feed nem API). */
export const OWNER_ONLY_PARADA_IDS = new Set<string>([UMS_REQUEST_LIVE_PARADA_ID]);

export function isOwnerOnlyParada(paradaId: string): boolean {
  return OWNER_ONLY_PARADA_IDS.has(paradaId);
}

/** @bruno pode ver paradas owner-only; demais usuários não. */
export function canViewOwnerOnlyParada(viewerHandle: string | null | undefined): boolean {
  return isMyTrlOwner(viewerHandle);
}

export function isParadaVisibleToViewer(
  paradaId: string,
  viewerHandle: string | null | undefined,
): boolean {
  if (!isOwnerOnlyParada(paradaId)) return true;
  return canViewOwnerOnlyParada(viewerHandle);
}

export function filterParadasForViewer<T extends { id: string }>(
  paradas: T[],
  viewerHandle: string | null | undefined,
): T[] {
  if (canViewOwnerOnlyParada(viewerHandle)) return paradas;
  return paradas.filter((p) => !isOwnerOnlyParada(p.id));
}

/** @bruno pode ter até 3 paradas; demais usuários seguem o limite padrão. */
export const MYTRL_OWNER_MAX_PARADAS = 3;

export function maxParadasForUser(handle: string | null | undefined): number {
  return isMyTrlOwner(handle) ? MYTRL_OWNER_MAX_PARADAS : 2;
}

/** Publicação diária às 8h BRT (= 11:00 UTC). */
export const MYTRL_DAILY_PUBLISH_UTC_HOUR = 11;

/** Publicação semanal às 8:05 BRT (= 11:05 UTC), após a diária de sexta. */
export const MYTRL_WEEKLY_PUBLISH_UTC_HOUR = 11;
export const MYTRL_WEEKLY_PUBLISH_UTC_MINUTE = 5;

export function isMyTrlOwner(handle: string | null | undefined): boolean {
  return handle === MYTRL_OWNER_HANDLE;
}

/** Import Last.fm ponderado (30d) + filtro por playlist Spotify. */
export const BRINGTHELEO_HANDLE = "bringtheleo";

/**
 * Playlist-fonte fixa do import Last.fm @bringtheleo (ID Spotify).
 * Atual: "New Rock" (blvbruno). Sobrescrevível por env sem deploy.
 */
export const BRINGTHELEO_LASTFM_SOURCE_PLAYLIST_ID =
  process.env.BRINGTHELEO_LASTFM_PLAYLIST_ID?.trim() || "5LCCEDB7B2fvu6UCYg7C7f";

export type WeightedLastfmImportConfig = {
  /** null = buscar playlist "new hits" por nome na conta Spotify do usuário. */
  sourcePlaylistId: string | null;
  requiresSpotifyConnection: boolean;
  playlistLabel: string;
  /** Usar histórico Last.fm do @bruno em vez da conta do usuário logado. */
  useMyTrlOwnerLastfm: boolean;
  /** Peso dos scrobbles dos últimos 7 dias (incl. hoje). */
  recentPlayWeight: number;
  /** Peso dos scrobbles dos dias 8–30. */
  olderPlayWeight: number;
};

export function formatWeightedLastfmWeightsLabel(config: WeightedLastfmImportConfig): string {
  return `7d ×${config.recentPlayWeight}, demais ×${config.olderPlayWeight}`;
}

export function getWeightedLastfmImportConfig(
  handle: string | null | undefined,
): WeightedLastfmImportConfig | null {
  const h = handle?.toLowerCase();
  if (h === MYTRL_OWNER_HANDLE) {
    return {
      sourcePlaylistId: null,
      requiresSpotifyConnection: true,
      playlistLabel: "new hits",
      useMyTrlOwnerLastfm: false,
      recentPlayWeight: 20,
      olderPlayWeight: 10,
    };
  }
  if (h === BRINGTHELEO_HANDLE) {
    return {
      sourcePlaylistId: BRINGTHELEO_LASTFM_SOURCE_PLAYLIST_ID,
      requiresSpotifyConnection: false,
      playlistLabel: "New Rock",
      useMyTrlOwnerLastfm: true,
      recentPlayWeight: 16,
      olderPlayWeight: 14,
    };
  }
  return null;
}

export function hasWeightedLastfmImport(handle: string | null | undefined): boolean {
  return getWeightedLastfmImportConfig(handle) !== null;
}

/** Playlists Spotify criadas automaticamente na conta @bruno saem públicas (Copa, Push, cron Last.fm, etc.). */
export const BRUNO_AUTO_SPOTIFY_PLAYLIST_PUBLIC = true;

/** Handles com acesso a conectar Spotify, importar faixas e criar playlists de parada. */
export const SPOTIFY_FEATURE_HANDLES = new Set([
  MYTRL_OWNER_HANDLE,
  "boofrnds",
  "whatthelucas",
  "romulolima22",
  "leoxavier",
]);

export function canUseSpotifyFeatures(handle: string | null | undefined): boolean {
  if (!handle) return false;
  return SPOTIFY_FEATURE_HANDLES.has(handle.toLowerCase());
}

export function authorizeMyTrlCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
