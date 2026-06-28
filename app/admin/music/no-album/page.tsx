import Link from "next/link";
import type { CSSProperties } from "react";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { AdminSongLinks, AdminSongNameLink } from "@/components/admin/AdminEntityLinks";

const PAGE_SIZE = 120;

type FiltroKey = "texto" | "catalogo" | "ambos";

function parseFiltro(raw: string | undefined): FiltroKey {
  const v = (raw ?? "texto").toLowerCase();
  if (v === "catalogo" || v === "catalog") return "catalogo";
  if (v === "ambos" || v === "both") return "ambos";
  return "texto";
}

function songWhere(filtro: FiltroKey): Prisma.SongWhereInput {
  if (filtro === "catalogo") {
    return { albumSpotifyId: null };
  }
  if (filtro === "ambos") {
    return {
      albumSpotifyId: null,
      OR: [{ album: null }, { album: "" }],
    };
  }
  return {
    OR: [{ album: null }, { album: "" }],
  };
}

function filtroLabel(f: FiltroKey): string {
  if (f === "catalogo") return "Sem álbum no catálogo (sem albumSpotifyId)";
  if (f === "ambos") return "Sem nome e sem álbum no catálogo";
  return "Sem nome de álbum (campo vazio)";
}

export default async function AdminSongsNoAlbumPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <Shell title="Admin" subtitle="Acesso"><div>Faça login para acessar.</div></Shell>;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return <Shell title="Admin" subtitle="Acesso"><div>Acesso negado.</div></Shell>;

  const sp = await searchParams;
  const filtro = parseFiltro(sp.filtro);
  const pageRaw = parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const where = songWhere(filtro);
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
        albumSpotifyId: true,
        artistSpotifyId: true,
      },
      orderBy: [{ artist: "asc" }, { title: "asc" }],
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qBase = (p: number, f: FiltroKey) => `/admin/music/no-album?filtro=${f}&page=${p}`;

  return (
    <Shell title="Admin" subtitle="Músicas sem álbum">
      <div style={{ maxWidth: 980 }}>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#6B6B70", lineHeight: 1.45 }}>
          {filtroLabel(filtro)} — mostrando até {PAGE_SIZE} por página ({total.toLocaleString("pt-BR")} no total).
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {(
            [
              ["texto", "Sem nome"],
              ["catalogo", "Sem catálogo"],
              ["ambos", "Ambos"],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={qBase(1, key)}
              style={{
                ...chipStyle,
                background: filtro === key ? "rgba(250,36,60,0.12)" : "white",
                color: filtro === key ? "#FA243C" : "#1D1D1F",
                borderColor: filtro === key ? "rgba(250,36,60,0.35)" : "rgba(0,0,0,0.12)",
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <Link href="/admin/music" style={{ color: "#86868B", textDecoration: "none", fontSize: 14 }}>
            ← Voltar a editar músicas
          </Link>
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
                <th style={thStyle}>Nome álbum (texto)</th>
                <th style={thStyle}>Catálogo</th>
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
                    {s.album?.trim() ? s.album : <span style={{ color: "#C41E3A", fontWeight: 600 }}>—</span>}
                  </td>
                  <td style={tdStyle}>
                    {s.albumSpotifyId ? (
                      <span style={{ color: "#2D7A32", fontWeight: 600, fontSize: 13 }}>OK</span>
                    ) : (
                      <span style={{ color: "#C41E3A", fontWeight: 600, fontSize: 13 }}>Falta</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{s.spotifyId ?? "—"}</td>
                  <td style={tdStyle}>
                    <AdminSongLinks song={s} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {songs.length === 0 && <div style={{ padding: 16, color: "#86868B" }}>Nenhuma música neste filtro.</div>}
        </div>

        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {page > 1 && (
              <Link href={qBase(page - 1, filtro)} style={pageLinkStyle}>
                ← Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link href={qBase(page + 1, filtro)} style={pageLinkStyle}>
                Próxima →
              </Link>
            )}
          </div>
        )}
      </div>
    </Shell>
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
const chipStyle: CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.12)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
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
