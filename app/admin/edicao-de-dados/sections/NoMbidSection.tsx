import Link from "next/link";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { AdminSongLinks, AdminSongNameLink } from "@/components/admin/AdminEntityLinks";

const PAGE_SIZE = 120;

export async function NoMbidSection({ page }: { page: number }) {
  const where = { recordingMbid: null };
  const skip = (page - 1) * PAGE_SIZE;

  const [total, songs] = await Promise.all([
    prisma.song.count({ where }),
    prisma.song.findMany({
      where,
      select: {
        id: true,
        title: true,
        artist: true,
        album: true,
        spotifyId: true,
        artistSpotifyId: true,
      },
      orderBy: [{ artist: "asc" }, { title: "asc" }],
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qBase = (p: number) => `/admin/edicao-de-dados?tab=no-mbid&page=${p}`;

  return (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: 14, color: "#6B6B70", lineHeight: 1.45 }}>
        Músicas sem MBID (MusicBrainz Recording ID) — mostrando até {PAGE_SIZE} por página ({total.toLocaleString("pt-BR")} no total).
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: "#86868B" }}>
          Página {page} / {totalPages}
        </span>
      </div>

      <div style={{ background: "white", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.03)" }}>
              <th style={thStyle}>Música</th>
              <th style={thStyle}>Artista</th>
              <th style={thStyle}>Álbum</th>
              <th style={thStyle}>Spotify</th>
              <th style={thStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((s) => (
              <tr key={s.id}>
                <td style={tdStyle}>
                  <AdminSongNameLink song={s} />{" "}
                  <span style={{ color: "#86868B", fontSize: 11 }}>({s.id})</span>
                </td>
                <td style={tdStyle}>{s.artist}</td>
                <td style={tdStyle}>
                  {s.album?.trim() ? s.album : <span style={{ color: "#86868B" }}>—</span>}
                </td>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{s.spotifyId ?? "—"}</td>
                <td style={tdStyle}>
                  <AdminSongLinks song={s} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {songs.length === 0 && <div style={{ padding: 16, color: "#86868B" }}>Todas as músicas têm MBID.</div>}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
          {page > 1 && (
            <Link href={qBase(page - 1)} style={pageLinkStyle}>
              ← Anterior
            </Link>
          )}
          {page < totalPages && (
            <Link href={qBase(page + 1)} style={pageLinkStyle}>
              Próxima →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  color: "#6B6B70",
  fontWeight: 700,
};
const tdStyle: CSSProperties = {
  padding: "10px 12px",
  borderTop: "1px solid rgba(0,0,0,0.06)",
  fontSize: 14,
  color: "#1D1D1F",
};
const pageLinkStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "white",
  color: "#1D1D1F",
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 14,
};
