import { ARTIST_FILTROS, fetchArtistPendencias, getAdminAccess, parseArtistFiltro, parsePage, type ArtistFiltro } from "../lib";
import { AccessDenied, ArtistAuditTable, DadosShell, FilterChips, Pagination, ResultInfo } from "../ui";

export const dynamic = "force-dynamic";

const DESCRICAO: Record<ArtistFiltro, string> = {
  pendencias: "Artistas sem imagem, sem link do Spotify ou sem gêneros.",
  "sem-bio": "Artistas sem texto de bio.",
  "bio-nao-encontrada": "Backfill automático (Wikipedia) já tentou e não achou bio — corrija manualmente ou edite o nome do artista e busque de novo.",
  "metadados-nao-encontrados": "Backfill automático (Spotify/MusicBrainz) já tentou e não achou imagem, link ou gêneros.",
  todas: "Todos os artistas do catálogo.",
};

export default async function ArtistasPendenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; page?: string }>;
}) {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;

  const params = await searchParams;
  const filtro = parseArtistFiltro(params.filtro);
  const page = parsePage(params.page);
  const result = await fetchArtistPendencias({ filtro, page });
  const hrefFor = (f: ArtistFiltro, p: number) => `/admin/dados/artistas-pendencias?filtro=${f}&page=${p}`;

  return (
    <DadosShell active="artistas-pendencias" subtitle="Artistas · pendências" showMinhasParadas={access.isOwner}>
      <FilterChips
        items={ARTIST_FILTROS.map((f) => ({
          key: f.key,
          label: f.label,
          href: hrefFor(f.key, 1),
          active: f.key === filtro,
        }))}
      />
      <ResultInfo
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        descricao={DESCRICAO[filtro]}
      />
      <ArtistAuditTable rows={result.rows} emptyLabel="Nenhum artista com pendência. 🎉" />
      <Pagination page={result.page} totalPages={result.totalPages} hrefFor={(p) => hrefFor(filtro, p)} />
    </DadosShell>
  );
}
