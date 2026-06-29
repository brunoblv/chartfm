import Link from "next/link";
import type { CSSProperties } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { adminNavChipStyle, adminTdStyle, adminThStyle } from "@/components/admin/admin-styles";
import {
  AdminAlbumLinks,
  AdminAlbumNameLink,
  AdminArtistLinks,
  AdminArtistNameLink,
  AdminSongLinks,
  AdminSongNameLink,
} from "@/components/admin/AdminEntityLinks";
import { ArtistCreatePanel } from "../artists/ArtistCreatePanel";
import { ArtistRefreshImageButton } from "../artists/ArtistRefreshImageButton";
import { CreateAlbumClient } from "../albums/CreateAlbumClient";
import { NoAlbumSection, parseFiltro } from "./sections/NoAlbumSection";
import { NoCoverSection } from "./sections/NoCoverSection";
import { MissingInfoSection } from "./sections/MissingInfoSection";

type Tab = "music" | "albums" | "artists" | "no-album" | "no-cover" | "missing-info";

const TABS: { id: Tab; label: string }[] = [
  { id: "music", label: "Músicas" },
  { id: "albums", label: "Álbuns" },
  { id: "artists", label: "Artistas" },
  { id: "no-album", label: "Músicas sem álbum" },
  { id: "no-cover", label: "Músicas sem capa" },
  { id: "missing-info", label: "Informações faltando" },
];

const TAB_IDS: Tab[] = TABS.map((t) => t.id);

function tabStyle(active: boolean): CSSProperties {
  return {
    display: "inline-block",
    padding: "8px 16px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
    border: active ? "1px solid #FA243C" : "1px solid var(--divider-strong)",
    color: active ? "#fff" : "var(--text)",
    background: active ? "#FA243C" : "var(--surface)",
  };
}

const searchInputStyle: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
};

export default async function AdminDataEditPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; filtro?: string; page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return (
      <Shell title="Admin" subtitle="Acesso">
        <div>Faça login para acessar.</div>
      </Shell>
    );
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role))
    return (
      <Shell title="Admin" subtitle="Acesso">
        <div>Acesso negado.</div>
      </Shell>
    );

  const params = await searchParams;
  const tab: Tab = TAB_IDS.includes(params.tab as Tab) ? (params.tab as Tab) : "music";
  const query = (params.q ?? "").trim();

  const songs =
    tab === "music" && query
      ? await prisma.song.findMany({
          where: {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { artist: { contains: query, mode: "insensitive" } },
              { album: { contains: query, mode: "insensitive" } },
            ],
          },
          select: { id: true, title: true, artist: true, album: true, spotifyId: true },
          take: 40,
          orderBy: { title: "asc" },
        })
      : [];

  const albums =
    tab === "albums" && query
      ? await prisma.album.findMany({
          where: { OR: [{ title: { contains: query, mode: "insensitive" } }, { artist: { name: { contains: query, mode: "insensitive" } } }] },
          select: {
            id: true,
            title: true,
            artist: { select: { id: true, name: true, spotifyId: true } },
            songs: { select: { id: true, title: true, artist: true }, orderBy: { title: "asc" } },
          },
          take: 40,
          orderBy: { title: "asc" },
        })
      : [];

  const artists =
    tab === "artists" && query
      ? await prisma.artist.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { exhibitionName: { contains: query, mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true, exhibitionName: true, spotifyId: true, imageUrl: true },
          take: 40,
          orderBy: { name: "asc" },
        })
      : [];

  const subtitle = TABS.find((t) => t.id === tab)?.label ?? "Editar músicas";

  return (
    <Shell title="Edição de dados" subtitle={subtitle}>
      <div style={{ width: "100%" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {TABS.map((tb) => (
            <Link key={tb.id} href={`/admin/edicao-de-dados?tab=${tb.id}`} style={tabStyle(tab === tb.id)}>
              {tb.label}
            </Link>
          ))}
        </div>

        {tab === "music" && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <Link href="/admin/music/versions" style={adminNavChipStyle}>Versões (live, remix, acoustic…)</Link>
              <Link href="/admin/music/no-album" style={adminNavChipStyle}>Sem álbum</Link>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <form method="GET" style={{ flex: "1 1 240px", minWidth: 0 }}>
                <input type="hidden" name="tab" value="music" />
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Buscar por música ou artista"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--divider-strong)", background: "var(--surface)", color: "var(--text)" }}
                />
              </form>
              <Link
                href="/admin/music/new"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: "#FA243C",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                + Adicionar música
              </Link>
            </div>
            <AdminPanel maxWidth={980}>
              <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--fill-inset)" }}>
                    <th style={adminThStyle}>Música</th>
                    <th style={adminThStyle}>Artista</th>
                    <th style={adminThStyle}>Álbum</th>
                    <th style={adminThStyle}>Spotify ID</th>
                    <th style={adminThStyle}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {songs.map((s) => (
                    <tr key={s.id}>
                      <td style={adminTdStyle}>
                        <AdminSongNameLink song={s} />
                      </td>
                      <td style={adminTdStyle}>{s.artist}</td>
                      <td style={adminTdStyle}>{s.album?.trim() ? s.album : "—"}</td>
                      <td style={{ ...adminTdStyle, fontFamily: "monospace", fontSize: 12 }}>{s.spotifyId ?? "—"}</td>
                      <td style={adminTdStyle}>
                        <AdminSongLinks song={s} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {query && songs.length === 0 && <div style={{ padding: 14, color: "var(--text-muted)" }}>Nenhuma música encontrada.</div>}
              {!query && <div style={{ padding: 14, color: "var(--text-muted)" }}>Digite no campo acima para buscar músicas.</div>}
            </AdminPanel>
          </>
        )}

        {tab === "albums" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Link
                href="/admin/duplicates/albums"
                style={{ fontSize: 13, color: "#FA243C", textDecoration: "none", fontWeight: 600 }}
              >
                → Mergear álbuns duplicados (Deluxe, Bonus Edition, etc.)
              </Link>
            </div>
            <CreateAlbumClient />
            <form method="GET" style={{ marginBottom: 16 }}>
              <input type="hidden" name="tab" value="albums" />
              <input name="q" defaultValue={query} placeholder="Buscar álbum" style={searchInputStyle} />
            </form>
            <AdminPanel>
              <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--fill-inset)" }}>
                    <th style={adminThStyle}>Álbum</th>
                    <th style={adminThStyle}>Artista</th>
                    <th style={adminThStyle}>Músicas</th>
                    <th style={adminThStyle}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {albums.map((a) => (
                    <tr key={a.id}>
                      <td style={adminTdStyle}>
                        <AdminAlbumNameLink album={a} />
                      </td>
                      <td style={adminTdStyle}>
                        <AdminArtistNameLink artist={a.artist} />{" "}
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>({a.artist.id})</span>
                      </td>
                      <td style={{ ...adminTdStyle, maxWidth: 320 }}>
                        {a.songs.length === 0
                          ? <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Nenhuma</span>
                          : <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
                              {a.songs.map((s) => (
                                <li key={s.id} style={{ fontSize: 12, color: "var(--text)" }}>
                                  <AdminSongNameLink song={{ id: s.id, title: s.title, artist: s.artist }} />
                                </li>
                              ))}
                            </ul>
                        }
                      </td>
                      <td style={adminTdStyle}>
                        <AdminAlbumLinks album={a} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {query && albums.length === 0 && <div style={{ padding: 14, color: "var(--text-muted)" }}>Nenhum álbum encontrado.</div>}
              {!query && <div style={{ padding: 14, color: "var(--text-muted)" }}>Digite no campo acima para buscar álbuns.</div>}
            </AdminPanel>
          </>
        )}

        {tab === "artists" && (
          <>
            <ArtistCreatePanel />

            <form method="GET" style={{ marginBottom: 12 }}>
              <input type="hidden" name="tab" value="artists" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Buscar artista por nome ou romanização"
                style={searchInputStyle}
              />
            </form>

            <AdminPanel>
              <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--fill-inset)" }}>
                    <th style={adminThStyle}>ID</th>
                    <th style={adminThStyle}>Nome</th>
                    <th style={adminThStyle}>Romanização</th>
                    <th style={adminThStyle}>Spotify ID</th>
                    <th style={adminThStyle}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {artists.map((a) => (
                    <tr key={a.id}>
                      <td style={{ ...adminTdStyle, color: "var(--text-muted)", fontSize: 12 }}>{a.id}</td>
                      <td style={adminTdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {a.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.imageUrl}
                              alt=""
                              width={28}
                              height={28}
                              style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: "1.5px dashed var(--text-disabled)",
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <AdminArtistNameLink artist={a} />
                        </div>
                      </td>
                      <td style={{ ...adminTdStyle, color: "var(--text-subtle)" }}>{a.exhibitionName ?? "—"}</td>
                      <td style={{ ...adminTdStyle, fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
                        {a.spotifyId}
                      </td>
                      <td style={adminTdStyle}>
                        <AdminArtistLinks artist={a} />
                        <ArtistRefreshImageButton artistId={a.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {query && artists.length === 0 && (
                <div style={{ padding: 14, color: "var(--text-muted)", fontSize: 14 }}>
                  Nenhum artista encontrado para &ldquo;{query}&rdquo;.
                </div>
              )}
              {!query && (
                <div style={{ padding: 14, color: "var(--text-muted)", fontSize: 14 }}>
                  Digite no campo acima para buscar artistas.
                </div>
              )}
            </AdminPanel>
          </>
        )}

        {tab === "no-album" && (
          <NoAlbumSection
            filtro={parseFiltro(params.filtro)}
            page={(() => {
              const p = parseInt(params.page ?? "1", 10);
              return Number.isFinite(p) && p > 0 ? p : 1;
            })()}
          />
        )}

        {tab === "no-cover" && <NoCoverSection />}

        {tab === "missing-info" && <MissingInfoSection />}
      </div>
    </Shell>
  );
}
