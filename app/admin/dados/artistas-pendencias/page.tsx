import Link from "next/link";
import { adminNavChipStyle } from "@/components/admin/admin-styles";
import {
  ARTIST_FILTROS,
  countArtistsPendenciasComBio,
  fetchArtistPendencias,
  getAdminAccess,
  parseArtistFiltro,
  parseDadosSort,
  parsePage,
  parseQuery,
  type ArtistFiltro,
  type DadosSort,
} from "../lib";
import {
  AccessDenied,
  ArtistAuditTable,
  DadosShell,
  FilterChips,
  Pagination,
  ResultInfo,
  SearchBox,
  SortChips,
  dadosListQuery,
} from "../ui";
import { BackfillDrawerButton } from "../SourceBatchBackfillClient";

export const dynamic = "force-dynamic";

const DESCRICAO: Record<ArtistFiltro, string> = {
  pendencias: "Artistas sem imagem, sem link do Spotify ou sem gêneros.",
  "sem-bio": "Artistas sem texto de bio.",
  "bio-nao-encontrada": "Backfill automático (Wikipedia) já tentou e não achou bio — corrija manualmente ou edite o nome do artista e busque de novo.",
  "metadados-nao-encontrados": "Backfill automático (Spotify/MusicBrainz) já tentou e não achou imagem, link ou gêneros.",
  todas: "Todos os artistas do catálogo.",
};

export default async function ArtistasUnificadosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; page?: string; q?: string; sort?: string; dir?: string }>;
}) {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;

  const params = await searchParams;
  const q = parseQuery(params.q);
  const defaultFiltro: ArtistFiltro = q ? "todas" : "pendencias";
  const filtro = parseArtistFiltro(params.filtro, defaultFiltro);
  const page = parsePage(params.page);
  const sort = parseDadosSort(params.sort, params.dir);
  const [result, problemCount] = await Promise.all([
    fetchArtistPendencias({ filtro, page, q, sort }),
    countArtistsPendenciasComBio(),
  ]);
  const hrefFor = (f: ArtistFiltro, p: number, s: DadosSort = sort) =>
    `/admin/dados/artistas-pendencias${dadosListQuery({ filtro: f, q, sort: s, page: p })}`;

  return (
    <DadosShell active="artistas-pendencias" subtitle="Busque, filtre e corrija artistas.">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Link href="/admin/artists" style={{ ...adminNavChipStyle, background: "#FA243C", color: "#fff", border: "none" }}>
          + Novo artista
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <SearchBox
          action="/admin/dados/artistas-pendencias"
          q={q}
          filtro={filtro}
          sort={sort}
          placeholder="Buscar artista"
          hideSubmit
        />
        <BackfillDrawerButton
          kind="artists"
          initialTotal={problemCount}
          description="Roda todas as APIs juntas ou uma de cada vez para todos os artistas com pendência (imagem, gêneros, link e bio). Fontes já marcadas como «sem resultado» são puladas."
        />
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginLeft: "auto", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {result.total.toLocaleString("pt-BR")} resultado{result.total === 1 ? "" : "s"}
          </span>
          <SortChips sort={sort} hrefFor={(next) => hrefFor(filtro, 1, next)} />
        </div>
      </div>

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
      <ArtistAuditTable
        rows={result.rows}
        emptyLabel={q || filtro !== "todas" ? "Nenhum resultado para esses filtros." : "Nenhum artista neste filtro. 🎉"}
      />
      <Pagination page={result.page} totalPages={result.totalPages} hrefFor={(p) => hrefFor(filtro, p)} />
    </DadosShell>
  );
}
