import Link from "next/link";
import type { CSSProperties } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { ArtistCreatePanel } from "./ArtistCreatePanel";

export default async function AdminArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
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

  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const artists = query
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

  return (
    <Shell title="Admin" subtitle="Artistas">
      <div style={{ maxWidth: 980 }}>
        <ArtistCreatePanel />

        <form method="GET" style={{ marginBottom: 12 }}>
          <input
            name="q"
            defaultValue={query}
            placeholder="Buscar artista por nome ou romanização"
            style={{
              width: "100%",
              maxWidth: 520,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              fontSize: 14,
            }}
          />
        </form>

        <div
          style={{
            background: "white",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.03)" }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>Romanização</th>
                <th style={thStyle}>Spotify ID</th>
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {artists.map((a) => (
                <tr key={a.id}>
                  <td style={{ ...tdStyle, color: "#86868B", fontSize: 12 }}>{a.id}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {a.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.imageUrl}
                          alt=""
                          width={28}
                          height={28}
                          style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                        />
                      )}
                      {a.name}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: "#6B6B70" }}>{a.exhibitionName ?? "—"}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "#86868B", fontFamily: "monospace" }}>
                    {a.spotifyId}
                  </td>
                  <td style={tdStyle}>
                    <Link
                      href={`/artist/${a.id}/edit`}
                      style={{ color: "#FA243C", textDecoration: "none", fontWeight: 700, fontSize: 13 }}
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {query && artists.length === 0 && (
            <div style={{ padding: 14, color: "#86868B", fontSize: 14 }}>
              Nenhum artista encontrado para &ldquo;{query}&rdquo;.
            </div>
          )}
          {!query && (
            <div style={{ padding: 14, color: "#86868B", fontSize: 14 }}>
              Digite no campo acima para buscar artistas.
            </div>
          )}
        </div>
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
