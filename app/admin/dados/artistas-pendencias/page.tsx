import { AdminPanel } from "@/components/admin/AdminPanel";
import { adminTdStyle, adminThStyle } from "@/components/admin/admin-styles";
import { AdminArtistLinks, AdminArtistNameLink } from "@/components/admin/AdminEntityLinks";
import { ArtistRefreshImageButton } from "../../artists/ArtistRefreshImageButton";
import { fetchArtistPendencias, getAdminAccess, parsePage } from "../lib";
import { AccessDenied, CoverThumb, DadosShell, OkFlag, Pagination, ResultInfo } from "../ui";
import { SourceFetchButtons } from "../SourceFetchButtons";

export const dynamic = "force-dynamic";

export default async function ArtistasPendenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;

  const params = await searchParams;
  const result = await fetchArtistPendencias(parsePage(params.page));
  const hrefFor = (p: number) => `/admin/dados/artistas-pendencias?page=${p}`;

  return (
    <DadosShell active="artistas-pendencias" subtitle="Artistas · pendências" showMinhasParadas={access.isOwner}>
      <ResultInfo
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        descricao="Artistas sem imagem, sem link do Spotify ou sem gêneros."
      />
      <AdminPanel maxWidth={1100}>
        <table style={{ width: "100%", minWidth: 860, tableLayout: "fixed", borderCollapse: "collapse" }}>
          <colgroup>
            <col style={{ width: 260 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 190 }} />
            <col style={{ width: 160 }} />
          </colgroup>
          <thead>
            <tr style={{ background: "var(--fill-inset)" }}>
              <th style={adminThStyle}>Artista</th>
              <th style={adminThStyle}>Imagem</th>
              <th style={adminThStyle}>Link</th>
              <th style={adminThStyle}>Gêneros</th>
              <th style={adminThStyle}>Spotify ID</th>
              <th style={adminThStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((a) => (
              <tr key={a.id}>
                <td style={{ ...adminTdStyle, verticalAlign: "middle", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.name}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, maxWidth: "100%" }}>
                    <CoverThumb url={a.imageUrl} size={28} />
                    <AdminArtistNameLink artist={a} />
                  </span>
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <OkFlag ok={Boolean(a.imageUrl)} />
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <OkFlag ok={Boolean(a.spotifyUrl)} />
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <OkFlag ok={a.genres.length > 0} okLabel={String(a.genres.length)} />
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle", fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.spotifyId}
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <AdminArtistLinks artist={a} />
                  <ArtistRefreshImageButton artistId={a.id} />
                  <SourceFetchButtons kind="artists" id={a.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.rows.length === 0 && (
          <div style={{ padding: 16, color: "var(--text-muted)" }}>Nenhum artista com pendência. 🎉</div>
        )}
      </AdminPanel>
      <Pagination page={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />
    </DadosShell>
  );
}
