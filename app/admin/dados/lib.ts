import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { MYTRL_OWNER_HANDLE } from "@/lib/mytrl-access";

export const DADOS_PAGE_SIZE = 50;

export type AdminAccess = {
  userId: string;
  /** true só para o @bruno — a aba "Minhas paradas" é exclusiva dele. */
  isOwner: boolean;
};

/** Retorna o admin logado (e se é o dono), ou null se não tiver permissão. */
export async function getAdminAccess(): Promise<AdminAccess | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, handle: true },
  });
  if (!isPrivilegedRole(me?.role)) return null;
  return { userId: session.user.id, isOwner: me?.handle === MYTRL_OWNER_HANDLE };
}

export function parsePage(raw: string | undefined): number {
  const p = parseInt(raw ?? "1", 10);
  return Number.isFinite(p) && p > 0 ? p : 1;
}

// ---------------------------------------------------------------------------
// Auditoria de músicas
// Regra do catálogo: toda música tem um álbum, todo álbum tem uma capa.
// ---------------------------------------------------------------------------

export type SongFiltro =
  | "todas"
  | "problemas"
  | "sem-album"
  | "album-sem-capa"
  | "sem-mbid"
  | "sem-single"
  | "sem-clipe"
  | "data-01-01"
  | "datas-nao-encontradas";

export const SONG_FILTROS: { key: SongFiltro; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "problemas", label: "Com pendência" },
  { key: "sem-album", label: "Sem álbum" },
  { key: "album-sem-capa", label: "Álbum sem capa" },
  { key: "sem-mbid", label: "Sem MBID" },
  { key: "sem-single", label: "Sem data do single" },
  { key: "sem-clipe", label: "Sem data do clipe" },
  { key: "data-01-01", label: "Data 01/01 (suspeita)" },
  { key: "datas-nao-encontradas", label: "Datas não encontradas" },
];

export const SONG_FILTRO_DESCRICAO: Record<SongFiltro, string> = {
  todas: "Todas as músicas do escopo, com o status de cada campo.",
  problemas: "Músicas com pelo menos uma pendência (álbum, capa, MBID ou datas).",
  "sem-album": "Músicas sem álbum vinculado no catálogo (regra: toda música tem um álbum).",
  "album-sem-capa": "Músicas cujo álbum vinculado está sem capa (regra: todo álbum tem uma capa).",
  "sem-mbid": "Músicas sem MBID (MusicBrainz Recording ID).",
  "sem-single": "Músicas sem data de lançamento do single.",
  "sem-clipe": "Músicas sem data de lançamento do clipe (nem YouTube).",
  "data-01-01": "Datas em 01/01 — pode indicar que o MusicBrainz só tinha o ano, sem dia/mês.",
  "datas-nao-encontradas":
    "Backfill automático já tentou Wikipedia e MusicBrainz sem resultado — corrija manualmente ou edite título/artista e use WIKI/MB na linha.",
};

export function parseSongFiltro(raw: string | undefined, fallback: SongFiltro): SongFiltro {
  const v = (raw ?? "").toLowerCase();
  return (SONG_FILTROS.some((f) => f.key === v) ? (v as SongFiltro) : fallback);
}

export const semAlbumWhere: Prisma.SongWhereInput = {
  OR: [{ albumSpotifyId: null }, { albumRef: null }],
};

export const albumSemCapaWhere: Prisma.SongWhereInput = {
  AND: [
    { albumSpotifyId: { not: null } },
    { albumRef: { OR: [{ coverUrl: null }, { coverUrl: "" }] } },
  ],
};

/** Regra completa "música → álbum → capa" (equivale a "música sem capa"). */
export const semCapaWhere: Prisma.SongWhereInput = {
  OR: [semAlbumWhere, albumSemCapaWhere],
};

export const semMbidWhere: Prisma.SongWhereInput = {
  OR: [{ recordingMbid: null }, { recordingMbid: "" }],
};

export const semSingleWhere: Prisma.SongWhereInput = { singleReleaseDate: null };

/** Alvo do backfill de datas: sem data do single OU sem data do clipe própria. */
export const semDatasWhere: Prisma.SongWhereInput = {
  OR: [{ singleReleaseDate: null }, { musicVideoReleaseDate: null }],
};

/** Igual a semDatasWhere, mas exclui músicas já marcadas como não encontradas no backfill. */
export const semDatasBackfillWhere: Prisma.SongWhereInput = {
  AND: [semDatasWhere, { releaseDatesNotFoundAt: null }],
};

/** Músicas marcadas pelo backfill como sem resultado em nenhuma fonte (correção manual). */
export const datasNaoEncontradasWhere: Prisma.SongWhereInput = {
  AND: [semDatasWhere, { releaseDatesNotFoundAt: { not: null } }],
};

/** Limpa a marcação ao corrigir metadados ou datas manualmente. */
export function withReleaseDatesNotFoundCleared<T extends Record<string, unknown>>(data: T) {
  return { ...data, releaseDatesNotFoundAt: null };
}

/** Só limpa a marcação quando uma data de single/clipe foi aplicada. */
export function songDataWithOptionalDatesNotFoundClear(data: Record<string, unknown>) {
  if ("singleReleaseDate" in data || "musicVideoReleaseDate" in data) {
    return withReleaseDatesNotFoundCleared(data);
  }
  return data;
}

export const semClipeWhere: Prisma.SongWhereInput = {
  AND: [{ musicVideoReleaseDate: null }, { youtubeReleaseDate: null }],
};

export const songProblemasWhere: Prisma.SongWhereInput = {
  OR: [semAlbumWhere, albumSemCapaWhere, semMbidWhere, semSingleWhere, semClipeWhere],
};

/** Músicas que aparecem em alguma parada própria do usuário (exclui paradas de comunidade e excluídas). */
export function minhasParadasWhere(userId: string): Prisma.SongWhereInput {
  return {
    entries: {
      some: {
        chart: {
          parada: { userId, deletedAt: null, isCommunityOfficial: false },
        },
      },
    },
  };
}

function songFiltroWhere(filtro: SongFiltro): Prisma.SongWhereInput | null {
  switch (filtro) {
    case "todas":
    case "data-01-01":
      return null;
    case "problemas":
      return songProblemasWhere;
    case "sem-album":
      return semAlbumWhere;
    case "album-sem-capa":
      return albumSemCapaWhere;
    case "sem-mbid":
      return semMbidWhere;
    case "sem-single":
      return semSingleWhere;
    case "sem-clipe":
      return semClipeWhere;
    case "datas-nao-encontradas":
      return datasNaoEncontradasWhere;
  }
}

export const SONG_AUDIT_SELECT = {
  id: true,
  title: true,
  artist: true,
  album: true,
  spotifyId: true,
  albumSpotifyId: true,
  recordingMbid: true,
  singleReleaseDate: true,
  musicVideoReleaseDate: true,
  youtubeReleaseDate: true,
  releaseDatesNotFoundAt: true,
  albumRef: {
    select: {
      id: true,
      title: true,
      coverUrl: true,
      releaseDate: true,
      artist: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.SongSelect;

export type SongAuditRow = Prisma.SongGetPayload<{ select: typeof SONG_AUDIT_SELECT }>;

/** IDs de músicas com data de single/clipe em 01/01 (indício de data incompleta no MusicBrainz). */
async function songIdsComData0101(userId?: string): Promise<string[]> {
  const scopeSql = userId
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "ChartEntry" ce
        JOIN "Chart" c ON c.id = ce."chartId"
        JOIN "paradas" p ON p.id = c."parada_id"
        WHERE ce."songId" = s.id
          AND p."user_id" = ${userId}
          AND p."deleted_at" IS NULL
          AND p."is_community_official" = false
      )`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT s.id FROM "Song" s
    WHERE (
      (s.single_release_date IS NOT NULL
        AND EXTRACT(MONTH FROM s.single_release_date) = 1
        AND EXTRACT(DAY FROM s.single_release_date) = 1)
      OR (s.music_video_release_date IS NOT NULL
        AND EXTRACT(MONTH FROM s.music_video_release_date) = 1
        AND EXTRACT(DAY FROM s.music_video_release_date) = 1)
    )
    ${scopeSql}
    ORDER BY s.artist ASC, s.title ASC
  `);
  return rows.map((r) => r.id);
}

export async function countSongsComData0101(userId?: string): Promise<number> {
  return (await songIdsComData0101(userId)).length;
}

/** Quantas músicas ainda estão sem data de single ou de clipe (alvo do backfill). */
export async function countSongsSemDatas(userId?: string): Promise<number> {
  const scope = userId ? minhasParadasWhere(userId) : null;
  const where = scope ? { AND: [scope, semDatasBackfillWhere] } : semDatasBackfillWhere;
  return prisma.song.count({ where });
}

export async function countSongsDatasNaoEncontradas(userId?: string): Promise<number> {
  const scope = userId ? minhasParadasWhere(userId) : null;
  const where = scope ? { AND: [scope, datasNaoEncontradasWhere] } : datasNaoEncontradasWhere;
  return prisma.song.count({ where });
}

export type SongAuditPage = {
  total: number;
  totalPages: number;
  page: number;
  rows: SongAuditRow[];
};

/** Busca paginada da auditoria de músicas (escopo global ou "minhas paradas"). */
export async function fetchSongAudit(opts: {
  userId?: string;
  filtro: SongFiltro;
  page: number;
}): Promise<SongAuditPage> {
  const { userId, filtro } = opts;
  const scope = userId ? minhasParadasWhere(userId) : null;

  if (filtro === "data-01-01") {
    const allIds = await songIdsComData0101(userId);
    const total = allIds.length;
    const totalPages = Math.max(1, Math.ceil(total / DADOS_PAGE_SIZE));
    const page = Math.min(opts.page, totalPages);
    const ids = allIds.slice((page - 1) * DADOS_PAGE_SIZE, page * DADOS_PAGE_SIZE);
    const unordered = await prisma.song.findMany({
      where: { id: { in: ids } },
      select: SONG_AUDIT_SELECT,
    });
    const byId = new Map(unordered.map((s) => [s.id, s]));
    const rows = ids.map((id) => byId.get(id)).filter((s): s is SongAuditRow => Boolean(s));
    return { total, totalPages, page, rows };
  }

  const filtroWhere = songFiltroWhere(filtro);
  const and = [scope, filtroWhere].filter((w): w is Prisma.SongWhereInput => Boolean(w));
  const where: Prisma.SongWhereInput = and.length > 0 ? { AND: and } : {};

  const total = await prisma.song.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / DADOS_PAGE_SIZE));
  const page = Math.min(opts.page, totalPages);
  const rows = await prisma.song.findMany({
    where,
    select: SONG_AUDIT_SELECT,
    orderBy: [{ artist: "asc" }, { title: "asc" }],
    skip: (page - 1) * DADOS_PAGE_SIZE,
    take: DADOS_PAGE_SIZE,
  });
  return { total, totalPages, page, rows };
}

// ---------------------------------------------------------------------------
// Pendências de álbuns
// ---------------------------------------------------------------------------

export type AlbumFiltro = "pendencias" | "sem-capa" | "sem-data" | "data-01-01" | "todas";

export const ALBUM_FILTROS: { key: AlbumFiltro; label: string }[] = [
  { key: "pendencias", label: "Com pendência" },
  { key: "sem-capa", label: "Sem capa" },
  { key: "sem-data", label: "Sem data" },
  { key: "data-01-01", label: "Data 01/01 (suspeita)" },
  { key: "todas", label: "Todos" },
];

export function parseAlbumFiltro(raw: string | undefined): AlbumFiltro {
  const v = (raw ?? "").toLowerCase();
  return ALBUM_FILTROS.some((f) => f.key === v) ? (v as AlbumFiltro) : "pendencias";
}

export const albumSemCapaAlbumWhere: Prisma.AlbumWhereInput = {
  OR: [{ coverUrl: null }, { coverUrl: "" }],
};

export const albumPendenciasWhere: Prisma.AlbumWhereInput = {
  OR: [
    { coverUrl: null },
    { coverUrl: "" },
    { releaseDate: null },
    { albumType: null },
    { totalTracks: null },
  ],
};

export const ALBUM_AUDIT_SELECT = {
  id: true,
  title: true,
  spotifyId: true,
  coverUrl: true,
  releaseDate: true,
  albumType: true,
  totalTracks: true,
  artist: { select: { id: true, name: true } },
  _count: { select: { songs: true } },
} satisfies Prisma.AlbumSelect;

export type AlbumAuditRow = Prisma.AlbumGetPayload<{ select: typeof ALBUM_AUDIT_SELECT }>;

async function albumIdsComData0101(): Promise<number[]> {
  const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    SELECT a.id FROM "albums" a
    WHERE a.release_date IS NOT NULL
      AND EXTRACT(MONTH FROM a.release_date) = 1
      AND EXTRACT(DAY FROM a.release_date) = 1
    ORDER BY a.title ASC
  `);
  return rows.map((r) => r.id);
}

export async function countAlbunsComData0101(): Promise<number> {
  return (await albumIdsComData0101()).length;
}

export type AlbumAuditPage = {
  total: number;
  totalPages: number;
  page: number;
  rows: AlbumAuditRow[];
};

export async function fetchAlbumAudit(opts: {
  filtro: AlbumFiltro;
  page: number;
}): Promise<AlbumAuditPage> {
  if (opts.filtro === "data-01-01") {
    const allIds = await albumIdsComData0101();
    const total = allIds.length;
    const totalPages = Math.max(1, Math.ceil(total / DADOS_PAGE_SIZE));
    const page = Math.min(opts.page, totalPages);
    const ids = allIds.slice((page - 1) * DADOS_PAGE_SIZE, page * DADOS_PAGE_SIZE);
    const unordered = await prisma.album.findMany({
      where: { id: { in: ids } },
      select: ALBUM_AUDIT_SELECT,
    });
    const byId = new Map(unordered.map((a) => [a.id, a]));
    const rows = ids.map((id) => byId.get(id)).filter((a): a is AlbumAuditRow => Boolean(a));
    return { total, totalPages, page, rows };
  }

  const where: Prisma.AlbumWhereInput =
    opts.filtro === "todas"
      ? {}
      : opts.filtro === "sem-capa"
        ? albumSemCapaAlbumWhere
        : opts.filtro === "sem-data"
          ? { releaseDate: null }
          : albumPendenciasWhere;

  const total = await prisma.album.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / DADOS_PAGE_SIZE));
  const page = Math.min(opts.page, totalPages);
  const rows = await prisma.album.findMany({
    where,
    select: ALBUM_AUDIT_SELECT,
    orderBy: [{ title: "asc" }],
    skip: (page - 1) * DADOS_PAGE_SIZE,
    take: DADOS_PAGE_SIZE,
  });
  return { total, totalPages, page, rows };
}

// ---------------------------------------------------------------------------
// Pendências de artistas
// ---------------------------------------------------------------------------

export const artistPendenciasWhere: Prisma.ArtistWhereInput = {
  OR: [{ imageUrl: null }, { spotifyUrl: null }, { genres: { isEmpty: true } }],
};

export const artistSemBioWhere: Prisma.ArtistWhereInput = {
  OR: [{ bio: null }, { bio: "" }],
};

/** Pendências de artista incluindo bio — usado pelo backfill combinado (todas as APIs). */
export const artistPendenciasComBioWhere: Prisma.ArtistWhereInput = {
  OR: [...(artistPendenciasWhere.OR as Prisma.ArtistWhereInput[]), ...(artistSemBioWhere.OR as Prisma.ArtistWhereInput[])],
};

export async function countArtistsSemBio(): Promise<number> {
  return prisma.artist.count({ where: artistSemBioWhere });
}

export async function countArtistsPendenciasComBio(): Promise<number> {
  return prisma.artist.count({ where: artistPendenciasComBioWhere });
}

export async function countSongsProblemas(): Promise<number> {
  return prisma.song.count({ where: songProblemasWhere });
}

export async function countAlbunsPendencias(): Promise<number> {
  return prisma.album.count({ where: albumPendenciasWhere });
}

export const ARTIST_AUDIT_SELECT = {
  id: true,
  name: true,
  spotifyId: true,
  imageUrl: true,
  spotifyUrl: true,
  genres: true,
} satisfies Prisma.ArtistSelect;

export type ArtistAuditRow = Prisma.ArtistGetPayload<{ select: typeof ARTIST_AUDIT_SELECT }>;

export async function fetchArtistPendencias(page: number) {
  const total = await prisma.artist.count({ where: artistPendenciasWhere });
  const totalPages = Math.max(1, Math.ceil(total / DADOS_PAGE_SIZE));
  const clamped = Math.min(page, totalPages);
  const rows = await prisma.artist.findMany({
    where: artistPendenciasWhere,
    select: ARTIST_AUDIT_SELECT,
    orderBy: { name: "asc" },
    skip: (clamped - 1) * DADOS_PAGE_SIZE,
    take: DADOS_PAGE_SIZE,
  });
  return { total, totalPages, page: clamped, rows };
}

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

export type EscopoContadores = {
  total: number;
  semAlbum: number;
  albumSemCapa: number;
  semMbid: number;
  semSingle: number;
  semClipe: number;
  data0101: number;
  datasNaoEncontradas: number;
};

async function contadoresDeEscopo(userId?: string): Promise<EscopoContadores> {
  const scope = userId ? minhasParadasWhere(userId) : null;
  const withScope = (w: Prisma.SongWhereInput): Prisma.SongWhereInput =>
    scope ? { AND: [scope, w] } : w;
  const [total, semAlbum, albumSemCapa, semMbid, semSingle, semClipe, data0101, datasNaoEncontradas] =
    await Promise.all([
      prisma.song.count({ where: scope ?? {} }),
      prisma.song.count({ where: withScope(semAlbumWhere) }),
      prisma.song.count({ where: withScope(albumSemCapaWhere) }),
      prisma.song.count({ where: withScope(semMbidWhere) }),
      prisma.song.count({ where: withScope(semSingleWhere) }),
      prisma.song.count({ where: withScope(semClipeWhere) }),
      countSongsComData0101(userId),
      countSongsDatasNaoEncontradas(userId),
    ]);
  return { total, semAlbum, albumSemCapa, semMbid, semSingle, semClipe, data0101, datasNaoEncontradas };
}

export type DadosOverview = {
  /** null quando o admin logado não é o dono (a seção "Minhas paradas" não aparece). */
  minhas: EscopoContadores | null;
  catalogo: EscopoContadores;
  albuns: { total: number; semCapa: number; semData: number; data0101: number };
  artistas: { total: number; pendencias: number };
};

export async function fetchDadosOverview(ownerUserId: string | null): Promise<DadosOverview> {
  const [minhas, catalogo, albumTotal, albumSemCapa, albumSemData, albumData0101, artistTotal, artistPend] =
    await Promise.all([
      ownerUserId ? contadoresDeEscopo(ownerUserId) : Promise.resolve(null),
      contadoresDeEscopo(),
      prisma.album.count(),
      prisma.album.count({ where: albumSemCapaAlbumWhere }),
      prisma.album.count({ where: { releaseDate: null } }),
      countAlbunsComData0101(),
      prisma.artist.count(),
      prisma.artist.count({ where: artistPendenciasWhere }),
    ]);
  return {
    minhas,
    catalogo,
    albuns: { total: albumTotal, semCapa: albumSemCapa, semData: albumSemData, data0101: albumData0101 },
    artistas: { total: artistTotal, pendencias: artistPend },
  };
}
