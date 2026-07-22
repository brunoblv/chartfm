import Link from "next/link";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { adminCompactTdStyle, adminCompactThStyle } from "@/components/admin/admin-styles";
import { AdminArtistNameLink, AdminSongNameLink } from "@/components/admin/AdminEntityLinks";
import {
  findGenreTags,
  fetchArtistsByTag,
  fetchSongsByTag,
  getAdminAccess,
  type TagArtistRow,
  type TagSongRow,
} from "../lib";
import { AccessDenied, CoverThumb, DadosShell, SearchBox } from "../ui";

export const dynamic = "force-dynamic";

export default async function TagsSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const tag = (params.tag ?? "").trim();

  const [matches, songs, artists] = await Promise.all([
    q ? findGenreTags(q) : Promise.resolve([]),
    tag ? fetchSongsByTag(tag) : Promise.resolve([] as TagSongRow[]),
    tag ? fetchArtistsByTag(tag) : Promise.resolve([] as TagArtistRow[]),
  ]);

  return (
    <DadosShell active="tags" subtitle="Busque uma tag/gênero e veja tudo que está marcado com ela.">
      <AdminPanel maxWidth={900} scroll={false}>
        <SearchBox
          action="/admin/dados/tags"
          q={q}
          placeholder="Buscar tag (ex.: k-pop, indie rock…)"
        />
      </AdminPanel>

      {q && (
        <AdminPanel maxWidth={900} scroll={false} style={{ marginTop: 12 }}>
          {matches.length === 0 ? (
            <div style={{ padding: 4, color: "var(--text-muted)", fontSize: 13.5 }}>
              Nenhuma tag encontrada com “{q}”.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {matches.map((m) => {
                const active = m.tag.toLowerCase() === tag.toLowerCase();
                return (
                  <Link
                    key={m.tag}
                    href={`/admin/dados/tags?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(m.tag)}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 12px",
                      borderRadius: 999,
                      fontSize: 12.5,
                      fontWeight: 700,
                      textDecoration: "none",
                      background: active ? "rgba(250,36,60,0.1)" : "var(--surface)",
                      color: active ? "#FA243C" : "var(--text)",
                      border: active ? "1px solid rgba(250,36,60,0.4)" : "1px solid var(--divider-strong)",
                    }}
                  >
                    {m.tag}
                    <span style={{ opacity: 0.7, fontWeight: 600 }}>
                      {m.songCount} música{m.songCount === 1 ? "" : "s"} · {m.artistCount} artista
                      {m.artistCount === 1 ? "" : "s"}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </AdminPanel>
      )}

      {tag && (
        <>
          <TagArtistsTable tag={tag} rows={artists} />
          <TagSongsTable tag={tag} rows={songs} />
        </>
      )}
    </DadosShell>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "20px 0 10px",
        fontSize: 15,
        fontWeight: 750,
        color: "var(--text)",
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </h2>
  );
}

function TagArtistsTable({ tag, rows }: { tag: string; rows: TagArtistRow[] }) {
  return (
    <>
      <SectionTitle>
        Artistas com “{tag}” ({rows.length})
      </SectionTitle>
      <AdminPanel maxWidth={900}>
        {rows.length === 0 ? (
          <div style={{ padding: 14, color: "var(--text-muted)", fontSize: 13.5 }}>Nenhum artista com essa tag.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--fill-inset)" }}>
                <th style={adminCompactThStyle}>Artista</th>
                <th style={adminCompactThStyle}>Gêneros</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td style={adminCompactTdStyle}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CoverThumb url={a.imageUrl} size={26} round />
                      <AdminArtistNameLink artist={a} />
                    </span>
                  </td>
                  <td style={{ ...adminCompactTdStyle, color: "var(--text-muted)", fontSize: 12 }}>
                    {a.genres.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminPanel>
    </>
  );
}

function TagSongsTable({ tag, rows }: { tag: string; rows: TagSongRow[] }) {
  return (
    <>
      <SectionTitle>
        Músicas com “{tag}” ({rows.length})
      </SectionTitle>
      <AdminPanel maxWidth={900}>
        {rows.length === 0 ? (
          <div style={{ padding: 14, color: "var(--text-muted)", fontSize: 13.5 }}>Nenhuma música com essa tag.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--fill-inset)" }}>
                <th style={adminCompactThStyle}>Música</th>
                <th style={adminCompactThStyle}>Artista</th>
                <th style={adminCompactThStyle}>Gêneros</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td style={adminCompactTdStyle}>
                    <AdminSongNameLink song={s} />
                  </td>
                  <td style={{ ...adminCompactTdStyle, color: "var(--text-muted)" }}>{s.artist}</td>
                  <td style={{ ...adminCompactTdStyle, color: "var(--text-muted)", fontSize: 12 }}>
                    {s.genres.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminPanel>
    </>
  );
}
