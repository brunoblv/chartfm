import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { adminTdStyle, adminThStyle } from "@/components/admin/admin-styles";
import { ArtistCreatePanel } from "./ArtistCreatePanel";
import { ArtistRefreshImageButton } from "./ArtistRefreshImageButton";

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
      <div style={{ maxWidth: 980, width: "100%" }}>
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
              border: "1px solid var(--divider-strong)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 14,
            }}
          />
        </form>

        <AdminPanel>
          <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--fill-inset)" }}>
                <th style={adminThStyle}>ID</th>
                <th style={adminThStyle}>Nome</th>
                <th style={adminThStyle}>Romanização</th>
                <th style={adminThStyle}>Spotify ID</th>
                <th style={adminThStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {artists.map((a) => (
                <tr key={a.id}>
                  <td style={{ ...adminTdStyle, color: "var(--text-muted)", fontSize: 12 }}>{a.id}</td>
                  <td style={adminTdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {a.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.imageUrl}
                          alt=""
                          width={28}
                          height={28}
                          style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: "1.5px dashed var(--text-disabled)",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      {a.name}
                    </div>
                  </td>
                  <td style={{ ...adminTdStyle, color: "var(--text-subtle)" }}>{a.exhibitionName ?? "—"}</td>
                  <td style={{ ...adminTdStyle, fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
                    {a.spotifyId}
                  </td>
                  <td style={adminTdStyle}>
                    <Link
                      href={`/artist/${a.id}/edit`}
                      style={{ color: "#FA243C", textDecoration: "none", fontWeight: 700, fontSize: 13 }}
                    >
                      Editar
                    </Link>
                    <ArtistRefreshImageButton artistId={a.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {query && artists.length === 0 && (
            <div style={{ padding: 14, color: "var(--text-muted)", fontSize: 14 }}>
              Nenhum artista encontrado para &ldquo;{query}&rdquo;.
            </div>
          )}
          {!query && (
            <div style={{ padding: 14, color: "var(--text-muted)", fontSize: 14 }}>
              Digite no campo acima para buscar artistas.
            </div>
          )}
        </AdminPanel>
      </div>
    </Shell>
  );
}
