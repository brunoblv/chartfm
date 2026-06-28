import Link from "next/link";
import type { CSSProperties } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { adminNavChipStyle } from "@/components/admin/admin-styles";
import { AdminSongLinks, AdminSongNameLink } from "@/components/admin/AdminEntityLinks";
import { songMissingGenresWhere } from "@/lib/resolve-song-genres";
import { SongGenresBackfillClient } from "./SongGenresBackfillClient";

const PAGE_SIZE = 40;

function sourceLabel(source: string | null) {
  if (source === "musicbrainz") return "MusicBrainz";
  if (source === "lastfm") return "Last.fm";
  if (source === "artist") return "Artista";
  return "—";
}

export default async function AdminSongGenresPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="Admin" subtitle="Acesso">
        <div>Faça login para acessar.</div>
      </Shell>
    );
  }
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) {
    return (
      <Shell title="Admin" subtitle="Acesso">
        <div>Acesso negado.</div>
      </Shell>
    );
  }

  const [missing, withTags, totalSongs, songs] = await Promise.all([
    prisma.song.count({ where: songMissingGenresWhere }),
    prisma.song.count({ where: { genres: { isEmpty: false } } }),
    prisma.song.count(),
    prisma.song.findMany({
      where: songMissingGenresWhere,
      select: {
        id: true,
        title: true,
        artist: true,
        spotifyId: true,
        genres: true,
        genreSource: true,
        recordingMbid: true,
        genresFetchedAt: true,
      },
      orderBy: [{ genresFetchedAt: "asc" }, { title: "asc" }],
      take: PAGE_SIZE,
    }),
  ]);

  return (
    <Shell title="Admin" subtitle="Tags de gênero por música">
      <div style={{ maxWidth: 1120 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <Link href="/admin/missing-info" style={adminNavChipStyle}>
            Informações incompletas
          </Link>
          <Link href="/admin/music" style={adminNavChipStyle}>
            Músicas
          </Link>
        </div>

        <SongGenresBackfillClient
          initialMissing={missing}
          initialWithTags={withTags}
          totalSongs={totalSongs}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 18 }}>
          <StatCard label="Pendentes" value={missing} />
          <StatCard label="Com tags" value={withTags} />
          <StatCard label="Total músicas" value={totalSongs} />
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
          Próximas na fila ({Math.min(PAGE_SIZE, missing).toLocaleString("pt-BR")} de {missing.toLocaleString("pt-BR")})
        </h2>

        {songs.length === 0 ? (
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Todas as músicas já têm tags buscadas.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr style={headRowStyle}>
                <th style={thStyle}>Música</th>
                <th style={thStyle}>Artista</th>
                <th style={thStyle}>Spotify</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song) => (
                <tr key={song.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <td style={tdStyle}>
                    <AdminSongNameLink song={song} />
                  </td>
                  <td style={tdStyle}>{song.artist}</td>
                  <td style={tdStyle}>
                    {song.spotifyId ? (
                      <span style={{ fontSize: 12, color: "#2D7A32" }}>Sim</span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#C41E3A" }}>Não</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {song.genres.length > 0
                        ? `${sourceLabel(song.genreSource)}: ${song.genres.slice(0, 3).join(", ")}`
                        : song.genresFetchedAt
                          ? "Buscado, sem tags"
                          : "Nunca buscado"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <AdminSongLinks song={song} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 12, color: "#86868B", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "white",
  borderRadius: 12,
  overflow: "hidden",
  border: "1px solid rgba(0,0,0,0.08)",
};

const headRowStyle: CSSProperties = { background: "#F5F5F7" };
const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 700,
  color: "#6B6B70",
};
const tdStyle: CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  verticalAlign: "top",
};
