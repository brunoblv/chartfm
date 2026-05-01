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
  artist: { name: string };
  _count: { songs: number; chartEntries: number };
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
  if (!Number.isInteger(keepId) || !Number.isInteger(dropId) || keepId <= 0 || dropId <= 0 || keepId === dropId) {
    redirect("/admin/duplicates/albums?error=invalid");
  }

  await prisma.$transaction(async (tx) => {
    const [keep, drop] = await Promise.all([
      tx.album.findUnique({ where: { id: keepId }, select: { id: true, title: true, spotifyId: true } }),
      tx.album.findUnique({ where: { id: dropId }, select: { id: true, title: true, spotifyId: true } }),
    ]);
    if (!keep || !drop) return;

    await tx.song.updateMany({
      where: { albumSpotifyId: drop.spotifyId },
      data: { albumSpotifyId: keep.spotifyId, album: keep.title },
    });
    await tx.chartEntry.updateMany({
      where: { albumSpotifyId: drop.spotifyId },
      data: { albumSpotifyId: keep.spotifyId },
    });

    await tx.album.delete({ where: { id: drop.id } });
  });

  redirect("/admin/duplicates/albums?ok=1");
}

function chooseMainAlbum(rows: AlbumRow[]): AlbumRow {
  return [...rows].sort((a, b) => {
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
      artist: { select: { name: true } },
      _count: { select: { songs: true, chartEntries: true } },
    },
    orderBy: [{ artist: { name: "asc" } }, { title: "asc" }],
  });

  const groups = new Map<string, AlbumRow[]>();
  for (const album of albums) {
    const key = `${canonicalAlbumTitle(album.title)}|||${canonicalArtistName(album.artist.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(album);
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, rows, main: chooseMainAlbum(rows) }))
    .sort((a, b) => b.rows.length - a.rows.length)
    .slice(0, 200);

  const { ok, error } = await searchParams;

  return (
    <Shell title="Admin" subtitle="Álbuns duplicados (fuzzy)">
      <div style={{ maxWidth: 1100 }}>
        <div style={{ marginBottom: 12 }}>
          <Link href="/admin/duplicates" style={{ color: "#86868B", textDecoration: "none", fontSize: 14 }}>← Voltar</Link>
        </div>
        {ok ? <div style={okStyle}>Merge concluído.</div> : null}
        {error ? <div style={errStyle}>Não foi possível concluir o merge ({error}).</div> : null}
        <p style={{ marginTop: 0, color: "#6B6B70", fontSize: 14 }}>
          A comparação ignora variações comuns como deluxe, remaster, expanded e track by track.
        </p>
        {duplicateGroups.length === 0 ? <div>Nenhuma duplicata encontrada.</div> : null}
        <div style={{ display: "grid", gap: 14 }}>
          {duplicateGroups.map((group) => (
            <section key={group.key} style={cardStyle}>
              <div style={{ fontSize: 12, color: "#6B6B70", marginBottom: 10 }}>
                Chave: <code>{group.key}</code> ({group.rows.length} itens)
              </div>
              {group.rows.map((album) => {
                const isMain = album.id === group.main.id;
                return (
                  <div key={album.id} style={rowStyle}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{album.title}</div>
                      <div style={{ fontSize: 13, color: "#6B6B70" }}>
                        {album.artist.name} • songs: {album._count.songs} • chartEntries: {album._count.chartEntries}
                      </div>
                    </div>
                    {!isMain ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <form action={mergeAlbumsAction}>
                          <input type="hidden" name="keepId" value={group.main.id} />
                          <input type="hidden" name="dropId" value={album.id} />
                          <button style={btnStyle} type="submit">Manter principal</button>
                        </form>
                        <form action={mergeAlbumsAction}>
                          <input type="hidden" name="keepId" value={album.id} />
                          <input type="hidden" name="dropId" value={group.main.id} />
                          <button style={btnAltStyle} type="submit">Manter este</button>
                        </form>
                      </div>
                    ) : (
                      <span style={badgeStyle}>Principal sugerido</span>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </Shell>
  );
}

const cardStyle: CSSProperties = {
  background: "white",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.08)",
  padding: 12,
};
const rowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 0",
  borderTop: "1px solid rgba(0,0,0,0.06)",
};
const btnStyle: CSSProperties = {
  border: "none",
  background: "#FA243C",
  color: "white",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
const btnAltStyle: CSSProperties = {
  border: "1px solid rgba(0,0,0,0.2)",
  background: "white",
  color: "#1D1D1F",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
const badgeStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#1B873F",
  background: "#E8F8EE",
  borderRadius: 999,
  padding: "6px 9px",
};
const okStyle: CSSProperties = {
  marginBottom: 12,
  background: "#E8F8EE",
  border: "1px solid #BCE9CC",
  color: "#1B873F",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
};
const errStyle: CSSProperties = {
  marginBottom: 12,
  background: "#FEECEC",
  border: "1px solid #F8B4B4",
  color: "#B42318",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
};
