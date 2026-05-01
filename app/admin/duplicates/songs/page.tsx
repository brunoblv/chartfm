import Link from "next/link";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { canonicalArtistName, canonicalSongTitle } from "@/lib/duplicate-utils";

type SongRow = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  spotifyId: string | null;
  _count: { entries: number };
};

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  return isPrivilegedRole(me?.role);
}

async function mergeSongsAction(formData: FormData) {
  "use server";
  const allowed = await ensurePrivilegedUser();
  if (!allowed) redirect("/admin/duplicates/songs?error=forbidden");

  const keepId = String(formData.get("keepId") ?? "").trim();
  const dropId = String(formData.get("dropId") ?? "").trim();
  if (!keepId || !dropId || keepId === dropId) {
    redirect("/admin/duplicates/songs?error=invalid");
  }

  await prisma.$transaction(async (tx) => {
    const [keep, drop] = await Promise.all([
      tx.song.findUnique({
        where: { id: keepId },
        select: { id: true, title: true, artist: true, album: true, spotifyId: true, albumSpotifyId: true, artistSpotifyId: true },
      }),
      tx.song.findUnique({
        where: { id: dropId },
        select: { id: true, title: true, artist: true, album: true, spotifyId: true, albumSpotifyId: true, artistSpotifyId: true },
      }),
    ]);
    if (!keep || !drop) return;

    let targetSpotifyId = keep.spotifyId;
    if (!targetSpotifyId && drop.spotifyId) {
      targetSpotifyId = drop.spotifyId;
      await tx.song.update({
        where: { id: keep.id },
        data: {
          spotifyId: drop.spotifyId,
          album: keep.album ?? drop.album,
          albumSpotifyId: keep.albumSpotifyId ?? drop.albumSpotifyId,
          artistSpotifyId: keep.artistSpotifyId ?? drop.artistSpotifyId,
        },
      });
    }

    await tx.chartEntry.updateMany({
      where: { songId: drop.id },
      data: {
        songId: keep.id,
        ...(targetSpotifyId ? { songSpotifyId: targetSpotifyId } : {}),
      },
    });

    if (drop.spotifyId) {
      await tx.chartEntry.updateMany({
        where: { songSpotifyId: drop.spotifyId },
        data: { songSpotifyId: targetSpotifyId ?? null },
      });

      if (targetSpotifyId && targetSpotifyId !== drop.spotifyId) {
        const oldFeats = await tx.songFeat.findMany({
          where: { songSpotifyId: drop.spotifyId },
          select: { artistSpotifyId: true },
        });
        for (const feat of oldFeats) {
          await tx.songFeat.upsert({
            where: {
              songSpotifyId_artistSpotifyId: {
                songSpotifyId: targetSpotifyId,
                artistSpotifyId: feat.artistSpotifyId,
              },
            },
            update: {},
            create: { songSpotifyId: targetSpotifyId, artistSpotifyId: feat.artistSpotifyId },
          });
        }
        await tx.songFeat.deleteMany({ where: { songSpotifyId: drop.spotifyId } });
      }
    }

    await tx.song.delete({ where: { id: drop.id } });
  });

  redirect("/admin/duplicates/songs?ok=1");
}

function chooseMainSong(rows: SongRow[]): SongRow {
  return [...rows].sort((a, b) => {
    const aScore = (a.spotifyId ? 1000 : 0) + a._count.entries;
    const bScore = (b.spotifyId ? 1000 : 0) + b._count.entries;
    return bScore - aScore;
  })[0];
}

export default async function AdminDuplicateSongsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const allowed = await ensurePrivilegedUser();
  if (!allowed) return <Shell title="Admin" subtitle="Duplicados"><div>Acesso negado.</div></Shell>;

  const songs = await prisma.song.findMany({
    select: { id: true, title: true, artist: true, album: true, spotifyId: true, _count: { select: { entries: true } } },
    orderBy: [{ artist: "asc" }, { title: "asc" }],
  });

  const groups = new Map<string, SongRow[]>();
  for (const song of songs) {
    const key = `${canonicalSongTitle(song.title)}|||${canonicalArtistName(song.artist)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(song);
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, rows, main: chooseMainSong(rows) }))
    .sort((a, b) => b.rows.length - a.rows.length)
    .slice(0, 150);

  const { ok, error } = await searchParams;

  return (
    <Shell title="Admin" subtitle="Músicas duplicadas">
      <div style={{ maxWidth: 1100 }}>
        <div style={{ marginBottom: 12 }}>
          <Link href="/admin/duplicates" style={{ color: "#86868B", textDecoration: "none", fontSize: 14 }}>← Voltar</Link>
        </div>
        {ok ? <div style={okStyle}>Merge concluído.</div> : null}
        {error ? <div style={errStyle}>Não foi possível concluir o merge ({error}).</div> : null}
        <p style={{ marginTop: 0, color: "#6B6B70", fontSize: 14 }}>
          Escolha uma música para manter e outra para apagar. O sistema move referências de chart para a música mantida.
        </p>
        {duplicateGroups.length === 0 ? <div>Nenhuma duplicata encontrada.</div> : null}
        <div style={{ display: "grid", gap: 14 }}>
          {duplicateGroups.map((group) => (
            <section key={group.key} style={cardStyle}>
              <div style={{ fontSize: 12, color: "#6B6B70", marginBottom: 10 }}>
                Chave: <code>{group.key}</code> ({group.rows.length} itens)
              </div>
              {group.rows.map((song) => {
                const isMain = song.id === group.main.id;
                return (
                  <div key={song.id} style={rowStyle}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{song.title}</div>
                      <div style={{ fontSize: 13, color: "#6B6B70" }}>
                        {song.artist} • {song.album || "sem álbum"} • entries: {song._count.entries} • spotify: {song.spotifyId ?? "—"}
                      </div>
                    </div>
                    {!isMain ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <form action={mergeSongsAction}>
                          <input type="hidden" name="keepId" value={group.main.id} />
                          <input type="hidden" name="dropId" value={song.id} />
                          <button style={btnStyle} type="submit">Manter principal</button>
                        </form>
                        <form action={mergeSongsAction}>
                          <input type="hidden" name="keepId" value={song.id} />
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
