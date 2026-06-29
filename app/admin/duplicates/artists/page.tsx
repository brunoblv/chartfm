import Link from "next/link";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { normalizeLoose } from "@/lib/duplicate-utils";
import { AdminArtistLinks, AdminArtistNameLink } from "@/components/admin/AdminEntityLinks";

type ArtistRow = {
  id: number;
  name: string;
  spotifyId: string;
  _count: { songs: number; albums: number; feats: number };
};

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  return isPrivilegedRole(me?.role);
}

async function mergeArtistsAction(formData: FormData) {
  "use server";
  const allowed = await ensurePrivilegedUser();
  if (!allowed) redirect("/admin/duplicates/artists?error=forbidden");

  const keepId = Number(formData.get("keepId"));
  const dropId = Number(formData.get("dropId"));
  if (!Number.isInteger(keepId) || !Number.isInteger(dropId) || keepId <= 0 || dropId <= 0 || keepId === dropId) {
    redirect("/admin/duplicates/artists?error=invalid");
  }

  await prisma.$transaction(async (tx) => {
    const [keep, drop] = await Promise.all([
      tx.artist.findUnique({ where: { id: keepId }, select: { id: true, name: true, spotifyId: true, imageUrl: true } }),
      tx.artist.findUnique({ where: { id: dropId }, select: { id: true, name: true, spotifyId: true, imageUrl: true } }),
    ]);
    if (!keep || !drop) return;

    await tx.album.updateMany({
      where: { artistSpotifyId: drop.spotifyId },
      data: { artistSpotifyId: keep.spotifyId },
    });

    await tx.song.updateMany({
      where: { artistSpotifyId: drop.spotifyId },
      data: { artistSpotifyId: keep.spotifyId, artist: keep.name },
    });

    const movingFeats = await tx.songFeat.findMany({
      where: { artistSpotifyId: drop.spotifyId },
      select: { songSpotifyId: true },
    });
    for (const feat of movingFeats) {
      await tx.songFeat.upsert({
        where: {
          songSpotifyId_artistSpotifyId: {
            songSpotifyId: feat.songSpotifyId,
            artistSpotifyId: keep.spotifyId,
          },
        },
        update: {},
        create: { songSpotifyId: feat.songSpotifyId, artistSpotifyId: keep.spotifyId },
      });
    }
    await tx.songFeat.deleteMany({ where: { artistSpotifyId: drop.spotifyId } });

    await tx.artist.update({
      where: { id: keep.id },
      data: { imageUrl: keep.imageUrl ?? drop.imageUrl ?? null },
    });
    await tx.artist.delete({ where: { id: drop.id } });
  });

  redirect("/admin/duplicates/artists?ok=1");
}

function chooseMainArtist(rows: ArtistRow[]): ArtistRow {
  return [...rows].sort((a, b) => {
    const aScore = a._count.songs * 3 + a._count.albums * 2 + a._count.feats;
    const bScore = b._count.songs * 3 + b._count.albums * 2 + b._count.feats;
    return bScore - aScore;
  })[0];
}

export default async function AdminDuplicateArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const allowed = await ensurePrivilegedUser();
  if (!allowed) return <Shell title="Admin" subtitle="Duplicados"><div>Acesso negado.</div></Shell>;

  const artists = await prisma.artist.findMany({
    select: { id: true, name: true, spotifyId: true, _count: { select: { songs: true, albums: true, feats: true } } },
    orderBy: { name: "asc" },
  });

  const groups = new Map<string, ArtistRow[]>();
  for (const artist of artists) {
    const key = normalizeLoose(artist.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(artist);
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, rows, main: chooseMainArtist(rows) }))
    .sort((a, b) => b.rows.length - a.rows.length)
    .slice(0, 150);

  const { ok, error } = await searchParams;

  return (
    <Shell title="Admin" subtitle="Artistas duplicados">
      <div>
        <div style={{ marginBottom: 12 }}>
          <Link href="/admin/duplicates" style={{ color: "#86868B", textDecoration: "none", fontSize: 14 }}>← Voltar</Link>
        </div>
        {ok ? <div style={okStyle}>Merge concluído.</div> : null}
        {error ? <div style={errStyle}>Não foi possível concluir o merge ({error}).</div> : null}
        <p style={{ marginTop: 0, color: "#6B6B70", fontSize: 14 }}>
          Ao fazer merge, o artista apagado tem seus vínculos de músicas, álbuns e feats movidos para o artista mantido.
        </p>
        {duplicateGroups.length === 0 ? <div>Nenhuma duplicata encontrada.</div> : null}
        <div style={{ display: "grid", gap: 14 }}>
          {duplicateGroups.map((group) => (
            <section key={group.key} style={cardStyle}>
              <div style={{ fontSize: 12, color: "#6B6B70", marginBottom: 10 }}>
                Chave: <code>{group.key}</code> ({group.rows.length} itens)
              </div>
              {group.rows.map((artist) => {
                const isMain = artist.id === group.main.id;
                return (
                  <div key={artist.id} style={rowStyle}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>
                        <AdminArtistNameLink artist={artist} />
                      </div>
                      <div style={{ fontSize: 13, color: "#6B6B70" }}>
                        songs: {artist._count.songs} • albums: {artist._count.albums} • feats: {artist._count.feats} • spotify: {artist.spotifyId}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <AdminArtistLinks artist={artist} />
                      </div>
                    </div>
                    {!isMain ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <form action={mergeArtistsAction}>
                          <input type="hidden" name="keepId" value={group.main.id} />
                          <input type="hidden" name="dropId" value={artist.id} />
                          <button style={btnStyle} type="submit">Manter principal</button>
                        </form>
                        <form action={mergeArtistsAction}>
                          <input type="hidden" name="keepId" value={artist.id} />
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
