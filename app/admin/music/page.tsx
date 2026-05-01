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
          ],
        },
        select: { id: true, title: true, artist: true, spotifyId: true },
        take: 40,
        orderBy: { title: "asc" },
      })
    : [];

  return (
    <Shell title="Admin" subtitle="Editar músicas">
      <div style={{ maxWidth: 980 }}>
        <form method="GET" style={{ marginBottom: 16 }}>
          <input
            name="q"
            defaultValue={query}
            placeholder="Buscar por música ou artista"
            style={{ width: "100%", maxWidth: 520, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)" }}
          />
        </form>
        <div style={{ background: "white", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.03)" }}>
                <th style={thStyle}>Música</th>
                <th style={thStyle}>Artista</th>
                <th style={thStyle}>Spotify ID</th>
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((s) => (
                <tr key={s.id}>
                  <td style={tdStyle}>{s.title}</td>
                  <td style={tdStyle}>{s.artist}</td>
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
