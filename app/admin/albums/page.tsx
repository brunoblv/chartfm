import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { adminTdStyle, adminThStyle } from "@/components/admin/admin-styles";
import { AdminAlbumLinks, AdminAlbumNameLink, AdminArtistNameLink, AdminSongNameLink } from "@/components/admin/AdminEntityLinks";
import { CreateAlbumClient } from "./CreateAlbumClient";

export default async function AdminAlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <Shell title="Admin" subtitle="Acesso"><div>Faça login para acessar.</div></Shell>;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return <Shell title="Admin" subtitle="Acesso"><div>Acesso negado.</div></Shell>;

  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const albums = query
    ? await prisma.album.findMany({
        where: { OR: [{ title: { contains: query, mode: "insensitive" } }, { artist: { name: { contains: query, mode: "insensitive" } } }] },
        select: { id: true, title: true, artist: { select: { id: true, name: true, spotifyId: true } }, songs: { select: { id: true, title: true, artist: true }, orderBy: { title: "asc" } } },
        take: 40,
        orderBy: { title: "asc" },
      })
    : [];

  return (
    <Shell title="Admin" subtitle="Editar álbuns">
      <div style={{ maxWidth: 980, width: "100%" }}>
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
          <input
            name="q"
            defaultValue={query}
            placeholder="Buscar álbum"
            style={{ width: "100%", maxWidth: 520, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--divider-strong)", background: "var(--surface)", color: "var(--text)" }}
          />
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
      </div>
    </Shell>
  );
}
