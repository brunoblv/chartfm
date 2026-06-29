import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { countSongsMissingCovers, findSongsMissingCovers } from "@/lib/resolve-publish-songs";
import { isSpotifyTrackId, spotifyConfigured } from "@/lib/spotify-server";
import { AdminSongLinks, AdminSongNameLink } from "@/components/admin/AdminEntityLinks";
import { SongCoversBackfillClient } from "../../albums/no-cover/SongCoversBackfillClient";

const PAGE_SIZE = 40;

export async function NoCoverSection() {
  const [total, songs] = await Promise.all([
    countSongsMissingCovers(prisma),
    findSongsMissingCovers(prisma, PAGE_SIZE),
  ]);
  const invalidCount = songs.filter((s) => s.spotifyId && !isSpotifyTrackId(s.spotifyId)).length;

  return (
    <div>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "#6B6B70" }}>
        Músicas sem capa ({total.toLocaleString("pt-BR")}).
      </p>

      <SongCoversBackfillClient initialTotal={total} spotifyConfigured={spotifyConfigured()} />

      {invalidCount > 0 && (
        <div style={{ marginBottom: 14, fontSize: 13, color: "#6B6B70" }}>
          {invalidCount} na amostra abaixo têm ID Spotify inválido — o backfill tenta corrigir via busca por título/artista.
        </div>
      )}

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
                <td style={tdStyle}>
                  <AdminSongNameLink song={s} />
                </td>
                <td style={tdStyle}>{s.artist}</td>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: "#6B6B70" }}>
                  {s.spotifyId ? (
                    <>
                      {s.spotifyId}
                      {s.spotifyId && !isSpotifyTrackId(s.spotifyId) && (
                        <span style={badgeInvalid}> inválido</span>
                      )}
                    </>
                  ) : (
                    <span style={{ color: "#86868B" }}>—</span>
                  )}
                </td>
                <td style={tdStyle}>
                  <AdminSongLinks song={s} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {songs.length === 0 && <div style={{ padding: 14, color: "#86868B" }}>Todas as músicas têm capa vinculada.</div>}
        {total > PAGE_SIZE && (
          <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: 13, color: "#86868B" }}>
            Mostrando {PAGE_SIZE} de {total.toLocaleString("pt-BR")}. Use o backfill para corrigir o restante.
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#6B6B70", fontWeight: 700 };
const tdStyle: CSSProperties = { padding: "10px 12px", borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: 14, color: "#1D1D1F" };
const badgeInvalid: CSSProperties = { color: "#C41E3A", fontFamily: "inherit", fontSize: 11, fontWeight: 700 };
