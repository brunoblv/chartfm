import Link from "next/link";
import type { CSSProperties } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { buildSongPath } from "@/lib/music-routes";
import { Shell } from "@/components/layout/Shell";

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
      <div style={{ maxWidth: 980 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <Link href="/admin/music/versions" style={navChipStyle}>Versões (live, remix, acoustic…)</Link>
          <Link href="/admin/music/no-album" style={navChipStyle}>Sem álbum</Link>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <form method="GET" style={{ flex: "1 1 240px", minWidth: 200 }}>
            <input
              name="q"
              defaultValue={query}
              placeholder="Buscar por música ou artista"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)" }}
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
            }}
          >
            + Adicionar música
          </Link>
        </div>
        <div style={{ background: "white", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.03)" }}>
                <th style={thStyle}>Música</th>
                <th style={thStyle}>Artista</th>
                <th style={thStyle}>Álbum</th>
                <th style={thStyle}>Spotify ID</th>
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((s) => (
                <tr key={s.id}>
                  <td style={tdStyle}>{s.title}</td>
                  <td style={tdStyle}>{s.artist}</td>
                  <td style={tdStyle}>{s.album?.trim() ? s.album : "—"}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{s.spotifyId ?? "—"}</td>
                  <td style={tdStyle}>
                    <Link
                      href={`${buildSongPath({ id: s.id, title: s.title, artist: s.artist, spotifyId: s.spotifyId })}/edit`}
                      style={{ color: "#FA243C", textDecoration: "none", fontWeight: 700 }}
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {query && songs.length === 0 && <div style={{ padding: 14, color: "#86868B" }}>Nenhuma música encontrada.</div>}
          {!query && <div style={{ padding: 14, color: "#86868B" }}>Digite no campo acima para buscar músicas.</div>}
        </div>
      </div>
    </Shell>
  );
}

const thStyle: CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#6B6B70", fontWeight: 700 };
const tdStyle: CSSProperties = { padding: "10px 12px", borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: 14, color: "#1D1D1F" };
const navChipStyle: CSSProperties = {
  display: "inline-block",
  padding: "7px 12px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.12)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  color: "#1D1D1F",
  background: "white",
};
