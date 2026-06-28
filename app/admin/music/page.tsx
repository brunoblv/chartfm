import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { adminNavChipStyle, adminTdStyle, adminThStyle } from "@/components/admin/admin-styles";
import { AdminSongLinks, AdminSongNameLink } from "@/components/admin/AdminEntityLinks";

export default async function AdminMusicPage({
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
  const songs = query
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

  return (
    <Shell title="Admin" subtitle="Editar músicas">
      <div style={{ maxWidth: 980, width: "100%" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <Link href="/admin/music/versions" style={adminNavChipStyle}>Versões (live, remix, acoustic…)</Link>
          <Link href="/admin/music/no-album" style={adminNavChipStyle}>Sem álbum</Link>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <form method="GET" style={{ flex: "1 1 240px", minWidth: 0 }}>
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
      </div>
    </Shell>
  );
}
