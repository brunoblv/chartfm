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

export function parseQuery(raw: string | undefined): string {
  return (raw ?? "").trim();
}

/** Ordenação da tabela unificada — Nome (alfa) ou Cadastro (createdAt). */
export type DadosSortBy = "alpha" | "data";
export type DadosSortDir = "asc" | "desc";
export type DadosSort = { by: DadosSortBy; dir: DadosSortDir };

export function parseDadosSort(byRaw?: string, dirRaw?: string): DadosSort {
  const by: DadosSortBy = byRaw === "alpha" ? "alpha" : "data";
  const dir: DadosSortDir = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : by === "alpha" ? "asc" : "desc";
  return { by, dir };
}

/** Alterna a direção se clicar no mesmo critério; senão entra no padrão do critério. */
export function nextDadosSort(current: DadosSort, by: DadosSortBy): DadosSort {
  if (current.by === by) {
    return { by, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { by, dir: by === "alpha" ? "asc" : "desc" };
}

export function dadosSortQuery(sort: DadosSort): string {
  return `sort=${sort.by}&dir=${sort.dir}`;
}

function songOrderBy(sort: DadosSort): Prisma.SongOrderByWithRelationInput[] {
  if (sort.by === "alpha") {
    return [{ title: sort.dir }, { artist: sort.dir }, { id: sort.dir }];
  }
  return [{ createdAt: sort.dir }, { id: sort.dir }];
}

function albumOrderBy(sort: DadosSort): Prisma.AlbumOrderByWithRelationInput[] {
  if (sort.by === "alpha") {
    return [{ title: sort.dir }, { id: sort.dir }];
  }
  return [{ createdAt: sort.dir }, { id: sort.dir }];
}

function artistOrderBy(sort: DadosSort): Prisma.ArtistOrderByWithRelationInput[] {
  if (sort.by === "alpha") {
    return [{ name: sort.dir }, { id: sort.dir }];
  }
  return [{ createdAt: sort.dir }, { id: sort.dir }];
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
  | "album-outro-dono"
  | "sem-mbid"
  | "sem-single"
  | "sem-clipe"
  | "data-01-01"
  | "datas-nao-encontradas"
  | "criadas-manualmente";

export const SONG_FILTROS: { key: SongFiltro; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "problemas", label: "Com pendência" },
  { key: "sem-album", label: "Sem álbum" },
  { key: "album-sem-capa", label: "Sem capa" },
  { key: "album-outro-dono", label: "Álbum de outro artista" },
  { key: "sem-mbid", label: "Sem MBID" },
  { key: "sem-single", label: "Sem single" },
  { key: "sem-clipe", label: "Sem clipe" },
  { key: "data-01-01", label: "Data 01/01" },
  { key: "datas-nao-encontradas", label: "Datas não encontradas" },
  { key: "criadas-manualmente", label: "Criadas manualmente" },
];

export const SONG_FILTRO_DESCRICAO: Record<SongFiltro, string> = {
  todas: "Todas as músicas do escopo, com o status de cada campo.",
  problemas: "Músicas com pelo menos uma pendência (álbum, capa, MBID ou datas).",
  "sem-album": "Músicas sem álbum vinculado no catálogo (regra: toda música tem um álbum).",
  "album-sem-capa": "Músicas cujo álbum vinculado está sem capa (regra: todo álbum tem uma capa).",
  "album-outro-dono":
    "Músicas cujo álbum vinculado pertence a um artista diferente do artista da música — provável álbum errado.",
  "sem-mbid": "Músicas sem MBID (MusicBrainz Recording ID).",
  "sem-single": "Músicas sem data de lançamento do single.",
  "sem-clipe": "Músicas sem data de lançamento do clipe (nem YouTube).",
  "data-01-01": "Datas em 01/01 — pode indicar que o MusicBrainz só tinha o ano, sem dia/mês.",
  "datas-nao-encontradas":
    "Backfill automático já tentou Wikipedia e MusicBrainz sem resultado — corrija manualmente ou edite título/artista e use WIKI/MB na linha.",
  "criadas-manualmente":
    "Cadastradas à mão na tela de criar parada (Spotify indisponível) — ainda sem busca no Spotify. Use o botão de forçar busca na linha.",
};

export const criadasManualmenteWhere: Prisma.SongWhereInput = { createdManually: true };

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

/** Busca por texto: título, artista ou álbum (contains, case-insensitive). */
function songSearchWhere(q: string): Prisma.SongWhereInput | null {
  const term = q.trim();
  if (!term) return null;
  return {
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { artist: { contains: term, mode: "insensitive" } },
      { album: { contains: term, mode: "insensitive" } },
    ],
  };
}

function songFiltroWhere(filtro: SongFiltro): Prisma.SongWhereInput | null {
  switch (filtro) {
    case "todas":
    case "data-01-01":
    case "album-outro-dono":
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
    case "criadas-manualmente":
      return criadasManualmenteWhere;
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
  sourcesNotFound: true,
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

/** IDs de músicas cujo álbum vinculado pertence a um artista diferente do artista da música. */
async function songIdsAlbumOutroDono(userId?: string): Promise<string[]> {
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
    JOIN "albums" a ON a.spotify_id = s.album_spotify_id
    WHERE s.artist_spotify_id IS NOT NULL
      AND a.artist_spotify_id IS NOT NULL
      AND a.artist_spotify_id <> s.artist_spotify_id
    ${scopeSql}
    ORDER BY s.artist ASC, s.title ASC
  `);
  return rows.map((r) => r.id);
}

export async function countSongsAlbumOutroDono(userId?: string): Promise<number> {
  return (await songIdsAlbumOutroDono(userId)).length;
}

const ID_LIST_FILTROS: Record<string, (userId?: string) => Promise<string[]>> = {
  "data-01-01": songIdsComData0101,
  "album-outro-dono": songIdsAlbumOutroDono,
};

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
  q?: string;
  sort?: DadosSort;
}): Promise<SongAuditPage> {
  const { userId, filtro } = opts;
  const sort = opts.sort ?? parseDadosSort();
  const scope = userId ? minhasParadasWhere(userId) : null;
  const searchWhere = songSearchWhere(opts.q ?? "");
  const orderBy = songOrderBy(sort);

  const idListFetcher = ID_LIST_FILTROS[filtro];
  if (idListFetcher) {
    const allIds = await idListFetcher(userId);
    const filteredIds = searchWhere
      ? (
          await prisma.song.findMany({
            where: { AND: [{ id: { in: allIds } }, searchWhere] },
            select: { id: true },
          })
        ).map((s) => s.id)
      : allIds;
    const total = filteredIds.length;
    const totalPages = Math.max(1, Math.ceil(total / DADOS_PAGE_SIZE));
    const page = Math.min(opts.page, totalPages);
    if (total === 0) return { total: 0, totalPages: 1, page: 1, rows: [] };
    const rows = await prisma.song.findMany({
      where: { id: { in: filteredIds } },
      select: SONG_AUDIT_SELECT,
      orderBy,
      skip: (page - 1) * DADOS_PAGE_SIZE,
      take: DADOS_PAGE_SIZE,
    });
    return { total, totalPages, page, rows };
  }

  const filtroWhere = songFiltroWhere(filtro);
  const and = [scope, filtroWhere, searchWhere].filter((w): w is Prisma.SongWhereInput => Boolean(w));
  const where: Prisma.SongWhereInput = and.length > 0 ? { AND: and } : {};

  const total = await prisma.song.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / DADOS_PAGE_SIZE));
  const page = Math.min(opts.page, totalPages);
  const rows = await prisma.song.findMany({
    where,
    select: SONG_AUDIT_SELECT,
    orderBy,
    skip: (page - 1) * DADOS_PAGE_SIZE,
    take: DADOS_PAGE_SIZE,
  });
  return { total, totalPages, page, rows };
}

// ---------------------------------------------------------------------------
// Pendências de álbuns
// ---------------------------------------------------------------------------

export type AlbumFiltro = "pendencias" | "sem-capa" | "sem-data" | "data-01-01" | "metadados-nao-encontrados" | "todas";

export const ALBUM_FILTROS: { key: AlbumFiltro; label: string }[] = [
  { key: "todas", label: "Todos" },
  { key: "pendencias", label: "Com pendência" },
  { key: "sem-capa", label: "Sem capa" },
  { key: "sem-data", label: "Sem data" },
  { key: "data-01-01", label: "Data 01/01 (suspeita)" },
  { key: "metadados-nao-encontrados", label: "Metadados não encontrados" },
];

export function parseAlbumFiltro(raw: string | undefined, fallback: AlbumFiltro = "pendencias"): AlbumFiltro {
  const v = (raw ?? "").toLowerCase();
  return ALBUM_FILTROS.some((f) => f.key === v) ? (v as AlbumFiltro) : fallback;
}

function albumSearchWhere(q: string): Prisma.AlbumWhereInput | null {
  const term = q.trim();
  if (!term) return null;
  return {
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { artist: { name: { contains: term, mode: "insensitive" } } },
    ],
  };
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

/** Backfill (Spotify) já tentou e não achou capa/data/tipo/faixas — não reentra na fila automática. */
export const albumMetadataNaoEncontradoWhere: Prisma.AlbumWhereInput = { metadataNotFoundAt: { not: null } };

export const ALBUM_AUDIT_SELECT = {
  id: true,
  title: true,
  spotifyId: true,
  coverUrl: true,
  releaseDate: true,
  albumType: true,
  totalTracks: true,
  sourcesNotFound: true,
  metadataNotFoundAt: true,
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
  q?: string;
  sort?: DadosSort;
}): Promise<AlbumAuditPage> {
  const searchWhere = albumSearchWhere(opts.q ?? "");
  const sort = opts.sort ?? parseDadosSort();
  const orderBy = albumOrderBy(sort);

  if (opts.filtro === "data-01-01") {
    const allIds = await albumIdsComData0101();
    const filteredIds = searchWhere
      ? (
          await prisma.album.findMany({
            where: { AND: [{ id: { in: allIds } }, searchWhere] },
            select: { id: true },
          })
        ).map((a) => a.id)
      : allIds;
    const total = filteredIds.length;
    const totalPages = Math.max(1, Math.ceil(total / DADOS_PAGE_SIZE));
    const page = Math.min(opts.page, totalPages);
    if (total === 0) return { total: 0, totalPages: 1, page: 1, rows: [] };
    const rows = await prisma.album.findMany({
      where: { id: { in: filteredIds } },
      select: ALBUM_AUDIT_SELECT,
      orderBy,
      skip: (page - 1) * DADOS_PAGE_SIZE,
      take: DADOS_PAGE_SIZE,
    });
    return { total, totalPages, page, rows };
  }

  const filtroWhere: Prisma.AlbumWhereInput | null =
    opts.filtro === "todas"
      ? null
      : opts.filtro === "sem-capa"
        ? albumSemCapaAlbumWhere
        : opts.filtro === "sem-data"
          ? { releaseDate: null }
          : opts.filtro === "metadados-nao-encontrados"
            ? albumMetadataNaoEncontradoWhere
            : albumPendenciasWhere;

  const and = [filtroWhere, searchWhere].filter((w): w is Prisma.AlbumWhereInput => Boolean(w));
  const where: Prisma.AlbumWhereInput = and.length > 0 ? { AND: and } : {};

  const total = await prisma.album.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / DADOS_PAGE_SIZE));
  const page = Math.min(opts.page, totalPages);
  const rows = await prisma.album.findMany({
    where,
    select: ALBUM_AUDIT_SELECT,
    orderBy,
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

export type ArtistFiltro = "pendencias" | "sem-bio" | "bio-nao-encontrada" | "metadados-nao-encontrados" | "todas";

export const ARTIST_FILTROS: { key: ArtistFiltro; label: string }[] = [
  { key: "todas", label: "Todos" },
  { key: "pendencias", label: "Com pendência" },
  { key: "sem-bio", label: "Sem bio" },
  { key: "bio-nao-encontrada", label: "Bio não encontrada" },
  { key: "metadados-nao-encontrados", label: "Metadados não encontrados" },
];

export function parseArtistFiltro(raw: string | undefined, fallback: ArtistFiltro = "pendencias"): ArtistFiltro {
  const v = (raw ?? "").toLowerCase();
  return ARTIST_FILTROS.some((f) => f.key === v) ? (v as ArtistFiltro) : fallback;
}

function artistSearchWhere(q: string): Prisma.ArtistWhereInput | null {
  const term = q.trim();
  if (!term) return null;
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { exhibitionName: { contains: term, mode: "insensitive" } },
    ],
  };
}

/** Backfill (Wikipedia) já tentou e não achou bio — não reentra na fila automática até correção manual. */
export const artistBioNaoEncontradaWhere: Prisma.ArtistWhereInput = { bioNotFoundAt: { not: null } };

/** Backfill (Spotify/MusicBrainz) já tentou e não achou imagem/link/gêneros. */
export const artistMetadataNaoEncontradoWhere: Prisma.ArtistWhereInput = { metadataNotFoundAt: { not: null } };

function artistFiltroWhere(filtro: ArtistFiltro): Prisma.ArtistWhereInput {
  switch (filtro) {
    case "todas":
      return {};
    case "sem-bio":
      return artistSemBioWhere;
    case "bio-nao-encontrada":
      return artistBioNaoEncontradaWhere;
    case "metadados-nao-encontrados":
      return artistMetadataNaoEncontradoWhere;
    case "pendencias":
      return artistPendenciasWhere;
  }
}

export const ARTIST_AUDIT_SELECT = {
  id: true,
  name: true,
  spotifyId: true,
  imageUrl: true,
  spotifyUrl: true,
  genres: true,
  bio: true,
  bioNotFoundAt: true,
  metadataNotFoundAt: true,
  sourcesNotFound: true,
} satisfies Prisma.ArtistSelect;

export type ArtistAuditRow = Prisma.ArtistGetPayload<{ select: typeof ARTIST_AUDIT_SELECT }>;

export async function fetchArtistPendencias(opts: {
  filtro: ArtistFiltro;
  page: number;
  q?: string;
  sort?: DadosSort;
}) {
  const filtroWhere = artistFiltroWhere(opts.filtro);
  const searchWhere = artistSearchWhere(opts.q ?? "");
  const sort = opts.sort ?? parseDadosSort();
  const and = [
    Object.keys(filtroWhere).length > 0 ? filtroWhere : null,
    searchWhere,
  ].filter((w): w is Prisma.ArtistWhereInput => Boolean(w));
  const where: Prisma.ArtistWhereInput = and.length > 0 ? { AND: and } : {};
  const total = await prisma.artist.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / DADOS_PAGE_SIZE));
  const clamped = Math.min(opts.page, totalPages);
  const rows = await prisma.artist.findMany({
    where,
    select: ARTIST_AUDIT_SELECT,
    orderBy: artistOrderBy(sort),
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
