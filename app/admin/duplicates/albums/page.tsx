import Link from "next/link";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { canonicalAlbumTitle, canonicalArtistName } from "@/lib/duplicate-utils";

type AlbumRow = {
  id: number;
  title: string;
  spotifyId: string;
  artistSpotifyId: string;
  coverUrl: string | null;
  releaseDate: Date | null;
  totalTracks: number | null;
  artist: { name: string };
  _count: { songs: number; chartEntries: number; reviews: number };
};

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  return isPrivilegedRole(me?.role);
}

async function mergeAlbumsAction(formData: FormData) {
  "use server";
  const allowed = await ensurePrivilegedUser();
  if (!allowed) redirect("/admin/duplicates/albums?error=forbidden");

  const keepId = Number(formData.get("keepId"));
  const dropId = Number(formData.get("dropId"));
  if (
    !Number.isInteger(keepId) || !Number.isInteger(dropId) ||
    keepId <= 0 || dropId <= 0 || keepId === dropId
  ) {
    redirect("/admin/duplicates/albums?error=invalid");
  }

  await prisma.$transaction(async (tx) => {
    const [keep, drop] = await Promise.all([
      tx.album.findUnique({ where: { id: keepId }, select: { id: true, title: true, spotifyId: true } }),
      tx.album.findUnique({ where: { id: dropId }, select: { id: true, title: true, spotifyId: true } }),
    ]);
    if (!keep || !drop) return;

    // Migrate songs and chart entries
    await tx.song.updateMany({
      where: { albumSpotifyId: drop.spotifyId },
      data: { albumSpotifyId: keep.spotifyId, album: keep.title },
    });
    await tx.chartEntry.updateMany({
      where: { albumSpotifyId: drop.spotifyId },
      data: { albumSpotifyId: keep.spotifyId },
    });

    // Migrate reviews: only those where the user hasn't already reviewed the keep album
    const [dropReviews, keepReviewerIds] = await Promise.all([
      tx.albumReview.findMany({ where: { albumId: drop.id }, select: { id: true, userId: true } }),
      tx.albumReview.findMany({ where: { albumId: keep.id }, select: { userId: true } }),
    ]);
    const keepUserSet = new Set(keepReviewerIds.map((r) => r.userId));
    const reviewIdsToMigrate = dropReviews
      .filter((r) => !keepUserSet.has(r.userId))
      .map((r) => r.id);
    if (reviewIdsToMigrate.length > 0) {
      await tx.albumReview.updateMany({
        where: { id: { in: reviewIdsToMigrate } },
        data: { albumId: keep.id },
      });
    }

    // Delete drop album — cascades any remaining conflicting reviews
    await tx.album.delete({ where: { id: drop.id } });
  });

  redirect("/admin/duplicates/albums?ok=1");
}

function chooseMainAlbum(rows: AlbumRow[]): AlbumRow {
  return [...rows].sort((a, b) => {
    const aEdition =
      /\b(deluxe|bonus|expanded|extended|remaster(?:ed)?|anniversary|edition|version)\b/i.test(a.title) ? 1 : 0;
    const bEdition =
      /\b(deluxe|bonus|expanded|extended|remaster(?:ed)?|anniversary|edition|version)\b/i.test(b.title) ? 1 : 0;
    if (aEdition !== bEdition) return aEdition - bEdition;
    const aDate = a.releaseDate ? a.releaseDate.getTime() : Infinity;
    const bDate = b.releaseDate ? b.releaseDate.getTime() : Infinity;
    if (aDate !== bDate) return aDate - bDate;
    const aScore = a._count.songs * 2 + a._count.chartEntries;
    const bScore = b._count.songs * 2 + b._count.chartEntries;
    return bScore - aScore;
  })[0];
}

export default async function AdminDuplicateAlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const allowed = await ensurePrivilegedUser();
  if (!allowed) return <Shell title="Admin" subtitle="Duplicados"><div>Acesso negado.</div></Shell>;

  const albums = await prisma.album.findMany({
    select: {
      id: true,
      title: true,
      spotifyId: true,
      artistSpotifyId: true,
      coverUrl: true,
      releaseDate: true,
      totalTracks: true,
      artist: { select: { name: true } },
      _count: { select: { songs: true, chartEntries: true, reviews: true } },
    },
    orderBy: [{ artist: { name: "asc" } }, { title: "asc" }],
  });

  const groups = new Map<string, AlbumRow[]>();
  for (const album of albums) {
    const key = `${canonicalAlbumTitle(album.title)}|||${canonicalArtistName(album.artist.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(album as AlbumRow);
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, rows, main: chooseMainAlbum(rows) }))
    .sort((a, b) => b.rows.length - a.rows.length)
    .slice(0, 200);

  const { ok, error } = await searchParams;
  const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.rows.length - 1, 0);

  return (
    <Shell title="Admin" subtitle="Álbuns duplicados">
      <div style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/admin/duplicates" style={{ color: "#86868B", textDecoration: "none", fontSize: 14 }}>
            ← Voltar
          </Link>
          {duplicateGroups.length > 0 && (
            <span style={{ fontSize: 13, color: "#6B6B70" }}>
              {duplicateGroups.length} grupos · {totalDuplicates} álbuns para remover
            </span>
          )}
        </div>

        {ok && (
          <div style={okStyle}>Merge concluído com sucesso.</div>
        )}
        {error && (
          <div style={errStyle}>Erro ao concluir merge: {error}</div>
        )}

        <p style={{ marginTop: 0, marginBottom: 20, color: "#6B6B70", fontSize: 13 }}>
          Agrupa álbuns pelo título normalizado (ignora Deluxe, Bonus, Remaster, etc.) e pelo artista.
          O <strong>álbum principal sugerido</strong> é o mais antigo sem sufixo de edição. Ao fazer merge,
          todas as músicas e entradas de chart são migradas; reviews sem conflito também são migradas.
        </p>

        {duplicateGroups.length === 0 && (
          <div style={{ background: "white", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", padding: 32, textAlign: "center", color: "#86868B" }}>
            Nenhuma duplicata encontrada.
          </div>
        )}

        <div style={{ display: "grid", gap: 16 }}>
          {duplicateGroups.map((group) => (
            <section key={group.key} style={cardStyle}>
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {group.rows[0]?.artist.name}
                </span>
                <span style={{ fontSize: 12, color: "#AEAEB2" }}>·</span>
                <code style={{ fontSize: 11, color: "#86868B", background: "rgba(0,0,0,0.04)", padding: "2px 6px", borderRadius: 4 }}>
                  {group.key.split("|||")[0]}
                </code>
                <span style={{ fontSize: 12, color: "#AEAEB2", marginLeft: "auto" }}>
                  {group.rows.length} versões
                </span>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {group.rows.map((album) => {
                  const isMain = album.id === group.main.id;
                  const year = album.releaseDate
                    ? new Date(album.releaseDate).getUTCFullYear()
                    : null;

                  return (
                    <div key={album.id} style={{ ...rowStyle, background: isMain ? "rgba(27,135,63,0.04)" : "rgba(0,0,0,0.015)", borderColor: isMain ? "rgba(27,135,63,0.15)" : "rgba(0,0,0,0.06)" }}>
                      {album.coverUrl ? (
                        <img
                          src={album.coverUrl}
                          alt={album.title}
                          style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 6, background: "#E5E5EA", flexShrink: 0, display: "grid", placeItems: "center", color: "#86868B", fontSize: 16, fontWeight: 700 }}>
                          {album.title[0]?.toUpperCase()}
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {album.title}
                        </div>
                        <div style={{ fontSize: 12, color: "#86868B", marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {year && <span>{year}</span>}
                          {album.totalTracks && <span>{album.totalTracks} faixas</span>}
                          <span>{album._count.songs} músicas vinculadas</span>
                          {album._count.chartEntries > 0 && <span>{album._count.chartEntries} chart entries</span>}
                          {album._count.reviews > 0 && <span>{album._count.reviews} reviews</span>}
                        </div>
                      </div>

                      {isMain ? (
                        <span style={mainBadgeStyle}>Principal</span>
                      ) : (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <form action={mergeAlbumsAction}>
                            <input type="hidden" name="keepId" value={group.main.id} />
                            <input type="hidden" name="dropId" value={album.id} />
                            <button style={btnMergeStyle} type="submit" title={`Manter "${group.main.title}" e remover este`}>
                              Manter principal
                            </button>
                          </form>
                          <form action={mergeAlbumsAction}>
                            <input type="hidden" name="keepId" value={album.id} />
                            <input type="hidden" name="dropId" value={group.main.id} />
                            <button style={btnAltStyle} type="submit" title={`Manter este e remover "${group.main.title}"`}>
                              Manter este
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Shell>
  );
}

const cardStyle: CSSProperties = {
  background: "white",
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,0.08)",
  padding: "14px 16px",
};

const rowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid transparent",
};

const mainBadgeStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#1B873F",
  background: "#E8F8EE",
  borderRadius: 999,
  padding: "5px 10px",
  flexShrink: 0,
  whiteSpace: "nowrap",
};

const btnMergeStyle: CSSProperties = {
  border: "none",
  background: "#1D1D1F",
  color: "white",
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const btnAltStyle: CSSProperties = {
  border: "1px solid rgba(0,0,0,0.15)",
  background: "white",
  color: "#1D1D1F",
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const okStyle: CSSProperties = {
  marginBottom: 14,
  background: "#E8F8EE",
  border: "1px solid #BCE9CC",
  color: "#1B873F",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 600,
};

const errStyle: CSSProperties = {
  marginBottom: 14,
  background: "#FEECEC",
  border: "1px solid #F8B4B4",
  color: "#B42318",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 600,
};
