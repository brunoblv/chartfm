import Link from "next/link";
import type { CSSProperties } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminNavChipStyle } from "@/components/admin/admin-styles";
import { AdminAlbumLinks, AdminAlbumNameLink, AdminArtistLinks, AdminArtistNameLink, AdminSongLinks, AdminSongNameLink } from "@/components/admin/AdminEntityLinks";
import { MissingInfoBackfillClient } from "../../missing-info/MissingInfoBackfillClient";

const PAGE_SIZE = 30;

const songMissingWhere: Prisma.SongWhereInput = {
  OR: [
    { spotifyId: null },
    { artistSpotifyId: null },
    { albumSpotifyId: null },
    { album: null },
    { album: "" },
    {
      AND: [
        { albumSpotifyId: { not: null } },
        {
          OR: [
            { albumRef: null },
            { albumRef: { OR: [{ coverUrl: null }, { coverUrl: "" }] } },
          ],
        },
      ],
    },
    { spotifyUrl: null },
    { durationMs: null },
  ],
};

const artistMissingWhere: Prisma.ArtistWhereInput = {
  OR: [{ imageUrl: null }, { spotifyUrl: null }, { genres: { isEmpty: true } }],
};

const albumMissingWhere: Prisma.AlbumWhereInput = {
  OR: [{ coverUrl: null }, { spotifyUrl: null }, { releaseDate: null }, { albumType: null }, { totalTracks: null }],
};

function missingLabels(values: Array<[boolean, string]>) {
  return values.filter(([missing]) => missing).map(([, label]) => label);
}

export async function MissingInfoSection() {
  const [songTotal, artistTotal, albumTotal, songs, artists, albums] = await Promise.all([
    prisma.song.count({ where: songMissingWhere }),
    prisma.artist.count({ where: artistMissingWhere }),
    prisma.album.count({ where: albumMissingWhere }),
    prisma.song.findMany({
      where: songMissingWhere,
      select: {
        id: true,
        title: true,
        artist: true,
        album: true,
        spotifyId: true,
        artistSpotifyId: true,
        albumSpotifyId: true,
        spotifyUrl: true,
        durationMs: true,
        albumRef: { select: { coverUrl: true } },
      },
      orderBy: [{ artist: "asc" }, { title: "asc" }],
      take: PAGE_SIZE,
    }),
    prisma.artist.findMany({
      where: artistMissingWhere,
      select: { id: true, name: true, spotifyId: true, imageUrl: true, spotifyUrl: true, genres: true },
      orderBy: { name: "asc" },
      take: PAGE_SIZE,
    }),
    prisma.album.findMany({
      where: albumMissingWhere,
      select: {
        id: true,
        title: true,
        spotifyId: true,
        coverUrl: true,
        spotifyUrl: true,
        releaseDate: true,
        albumType: true,
        totalTracks: true,
        artist: { select: { id: true, name: true } },
      },
      orderBy: { title: "asc" },
      take: PAGE_SIZE,
    }),
  ]);

  const total = songTotal + artistTotal + albumTotal;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <Link href="/admin/song-genres" style={adminNavChipStyle}>
          Tags de gênero (músicas)
        </Link>
      </div>

      <MissingInfoBackfillClient initialTotal={total} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 18 }}>
        <StatCard label="Músicas" value={songTotal} />
        <StatCard label="Artistas" value={artistTotal} />
        <StatCard label="Álbuns" value={albumTotal} />
      </div>

      <Section title="Músicas" total={songTotal}>
        <table style={tableStyle}>
          <thead>
            <tr style={headRowStyle}>
              <th style={thStyle}>Música</th>
              <th style={thStyle}>Artista</th>
              <th style={thStyle}>Falta</th>
              <th style={thStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((s) => (
              <tr key={s.id}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 650 }}>
                    <AdminSongNameLink song={s} />
                  </div>
                  <div style={mutedStyle}>{s.album?.trim() || "Sem álbum"}</div>
                </td>
                <td style={tdStyle}>{s.artist}</td>
                <td style={tdStyle}>
                  <Pills
                    items={missingLabels([
                      [!s.spotifyId, "Spotify ID"],
                      [!s.artistSpotifyId, "artista"],
                      [!s.albumSpotifyId, "álbum"],
                      [!s.album?.trim(), "nome do álbum"],
                      [Boolean(s.albumSpotifyId) && !s.albumRef?.coverUrl?.trim(), "capa"],
                      [!s.spotifyUrl, "link"],
                      [!s.durationMs, "duração"],
                    ])}
                  />
                </td>
                <td style={tdStyle}>
                  <AdminSongLinks song={s} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {songs.length === 0 && <EmptyState label="Nenhuma música com informação importante faltando." />}
      </Section>

      <Section title="Artistas" total={artistTotal}>
        <table style={tableStyle}>
          <thead>
            <tr style={headRowStyle}>
              <th style={thStyle}>Artista</th>
              <th style={thStyle}>Spotify ID</th>
              <th style={thStyle}>Falta</th>
              <th style={thStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {artists.map((a) => (
              <tr key={a.id}>
                <td style={tdStyle}>
                  <AdminArtistNameLink artist={a} />
                </td>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{a.spotifyId}</td>
                <td style={tdStyle}>
                  <Pills items={missingLabels([[!a.imageUrl, "imagem"], [!a.spotifyUrl, "link"], [a.genres.length === 0, "gêneros"]])} />
                </td>
                <td style={tdStyle}>
                  <AdminArtistLinks artist={a} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {artists.length === 0 && <EmptyState label="Nenhum artista com informação importante faltando." />}
      </Section>

      <Section title="Álbuns" total={albumTotal}>
        <table style={tableStyle}>
          <thead>
            <tr style={headRowStyle}>
              <th style={thStyle}>Álbum</th>
              <th style={thStyle}>Artista</th>
              <th style={thStyle}>Falta</th>
              <th style={thStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {albums.map((a) => (
              <tr key={a.id}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 650 }}>
                    <AdminAlbumNameLink album={a} />
                  </div>
                  <div style={mutedStyle}>{a.spotifyId}</div>
                </td>
                <td style={tdStyle}>
                  <AdminArtistNameLink artist={a.artist} />
                </td>
                <td style={tdStyle}>
                  <Pills
                    items={missingLabels([
                      [!a.coverUrl, "capa"],
                      [!a.spotifyUrl, "link"],
                      [!a.releaseDate, "data"],
                      [!a.albumType, "tipo"],
                      [!a.totalTracks, "faixas"],
                    ])}
                  />
                </td>
                <td style={tdStyle}>
                  <AdminAlbumLinks album={a} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {albums.length === 0 && <EmptyState label="Nenhum álbum com informação importante faltando." />}
      </Section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 12, color: "#86868B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 28, fontWeight: 750, color: "#1D1D1F", letterSpacing: "-0.03em" }}>{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}

function Section({ title, total, children }: { title: string; total: number; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 750, color: "#1D1D1F", letterSpacing: "-0.02em" }}>{title}</h2>
        <span style={{ fontSize: 13, color: "#86868B" }}>mostrando até {PAGE_SIZE} de {total.toLocaleString("pt-BR")}</span>
      </div>
      <div style={{ background: "white", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
        {children}
      </div>
    </section>
  );
}

function Pills({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((item) => (
        <span key={item} style={pillStyle}>{item}</span>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div style={{ padding: 14, color: "#86868B", fontSize: 14 }}>{label}</div>;
}

const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const headRowStyle: CSSProperties = { background: "rgba(0,0,0,0.03)" };
const thStyle: CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#6B6B70", fontWeight: 700 };
const tdStyle: CSSProperties = { padding: "10px 12px", borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: 14, color: "#1D1D1F", verticalAlign: "top" };
const mutedStyle: CSSProperties = { marginTop: 3, fontSize: 12, color: "#86868B" };
const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 22,
  padding: "0 8px",
  borderRadius: 999,
  background: "rgba(250,36,60,0.08)",
  color: "#C41E3A",
  fontSize: 12,
  fontWeight: 700,
};
