import Link from "next/link";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { canonicalArtistName, canonicalSongTitle } from "@/lib/duplicate-utils";
import { buildSongPath } from "@/lib/music-routes";
import { isPrivilegedRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";

type SongRow = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  spotifyId: string | null;
  artistSpotifyId: string | null;
  albumSpotifyId: string | null;
  artistRef: { id: number; name: string; spotifyId: string } | null;
  _count: { entries: number };
};

type DuplicateGroup = {
  key: string;
  title: string;
  artist: string;
  rows: SongRow[];
  main: SongRow;
  entries: number;
};

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  return isPrivilegedRole(me?.role);
}

function mergeRedirect(q: string, params: string) {
  const base = `/admin/duplicates/songs-by-artist${q ? `?q=${encodeURIComponent(q)}&` : "?"}`;
  redirect(`${base}${params}`);
}

async function mergeArtistSongsAction(formData: FormData) {
  "use server";
  const allowed = await ensurePrivilegedUser();
  const q = String(formData.get("q") ?? "").trim();
  if (!allowed) mergeRedirect(q, "error=forbidden");

  const keepId = String(formData.get("keepId") ?? "").trim();
  const dropId = String(formData.get("dropId") ?? "").trim();
  if (!keepId || !dropId || keepId === dropId) {
    mergeRedirect(q, "error=invalid");
  }

  let mergeError: string | null = null;

  await prisma.$transaction(async (tx) => {
    const [keep, drop] = await Promise.all([
      tx.song.findUnique({
        where: { id: keepId },
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          spotifyId: true,
          albumSpotifyId: true,
          artistSpotifyId: true,
          artistRef: { select: { name: true } },
        },
      }),
      tx.song.findUnique({
        where: { id: dropId },
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          spotifyId: true,
          albumSpotifyId: true,
          artistSpotifyId: true,
          artistRef: { select: { name: true } },
        },
      }),
    ]);

    if (!keep || !drop) {
      mergeError = "missing";
      return;
    }

    const keepTitleKey = canonicalSongTitle(keep.title);
    const dropTitleKey = canonicalSongTitle(drop.title);
    const keepArtistKey = canonicalArtistName(keep.artistRef?.name ?? keep.artist);
    const dropArtistKey = canonicalArtistName(drop.artistRef?.name ?? drop.artist);
    if (keepTitleKey !== dropTitleKey || keepArtistKey !== dropArtistKey) {
      mergeError = "mismatch";
      return;
    }

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
        const feats = await tx.songFeat.findMany({
          where: { songSpotifyId: drop.spotifyId },
          select: { artistSpotifyId: true },
        });
        for (const feat of feats) {
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

  if (mergeError) mergeRedirect(q, `error=${mergeError}`);
  mergeRedirect(q, "ok=1");
}

function displayArtist(song: SongRow): string {
  return song.artistRef?.name ?? song.artist;
}

function chooseMainSong(rows: SongRow[]): SongRow {
  return [...rows].sort((a, b) => {
    const aScore = (a.spotifyId ? 1000 : 0) + (a.artistSpotifyId ? 200 : 0) + a._count.entries;
    const bScore = (b.spotifyId ? 1000 : 0) + (b.artistSpotifyId ? 200 : 0) + b._count.entries;
    return bScore - aScore;
  })[0];
}

function buildGroups(songs: SongRow[]): DuplicateGroup[] {
  const groups = new Map<string, SongRow[]>();
  for (const song of songs) {
    const key = `${canonicalArtistName(displayArtist(song))}|||${canonicalSongTitle(song.title)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(song);
  }

  return [...groups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => {
      const main = chooseMainSong(rows);
      return {
        key,
        title: main.title,
        artist: displayArtist(main),
        rows,
        main,
        entries: rows.reduce((total, song) => total + song._count.entries, 0),
      };
    })
    .sort((a, b) => b.entries - a.entries || a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title))
    .slice(0, 120);
}

export default async function AdminDuplicateSongsByArtistPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const allowed = await ensurePrivilegedUser();
  if (!allowed) return <Shell title="Admin" subtitle="Duplicados"><div>Acesso negado.</div></Shell>;

  const { q, ok, error } = await searchParams;
  const query = (q ?? "").trim();
  const songs = query
    ? await prisma.song.findMany({
        where: {
          OR: [
            { artist: { contains: query, mode: "insensitive" } },
            { artistRef: { is: { name: { contains: query, mode: "insensitive" } } } },
          ],
        },
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          spotifyId: true,
          artistSpotifyId: true,
          albumSpotifyId: true,
          artistRef: { select: { id: true, name: true, spotifyId: true } },
          _count: { select: { entries: true } },
        },
        orderBy: [{ artist: "asc" }, { title: "asc" }],
      })
    : [];

  const duplicateGroups = buildGroups(songs);

  return (
    <Shell title="Admin" subtitle="Músicas homônimas por artista">
      <div>
        <div style={{ marginBottom: 12 }}>
          <Link href="/admin/duplicates" style={backStyle}>Voltar</Link>
        </div>

        <form method="GET" style={searchStyle}>
          <input
            name="q"
            defaultValue={query}
            placeholder="Buscar artista"
            style={inputStyle}
          />
          <button type="submit" style={searchButtonStyle}>Buscar</button>
        </form>

        {ok ? <div style={okStyle}>Merge concluído. As entradas de parada da duplicata agora apontam para a música mantida.</div> : null}
        {error ? <div style={errStyle}>Não foi possível concluir o merge ({error}).</div> : null}

        <p style={{ marginTop: 0, color: "#6B6B70", fontSize: 14 }}>
          Busque um artista para ver músicas com o mesmo nome no catálogo. Ao manter uma delas, a outra é removida e todas as paradas em que ela entrou passam a usar a música escolhida.
        </p>

        {!query ? <div style={emptyStyle}>Digite o nome de um artista para procurar possíveis duplicatas.</div> : null}
        {query && duplicateGroups.length === 0 ? (
          <div style={emptyStyle}>Nenhuma música homônima encontrada para esse artista.</div>
        ) : null}

        <div style={{ display: "grid", gap: 14 }}>
          {duplicateGroups.map((group) => (
            <section key={group.key} style={cardStyle}>
              <div style={groupHeaderStyle}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{group.title}</div>
                  <div style={{ fontSize: 13, color: "#6B6B70" }}>{group.artist}</div>
                </div>
                <div style={groupMetaStyle}>
                  {group.rows.length} versões · {group.entries} entradas
                </div>
              </div>

              {group.rows.map((song) => {
                const isMain = song.id === group.main.id;
                const songPath = buildSongPath({
                  id: song.id,
                  title: song.title,
                  artist: displayArtist(song),
                  artistId: song.artistRef?.id,
                  spotifyId: song.spotifyId,
                });

                return (
                  <div key={song.id} style={rowStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Link href={songPath} style={songLinkStyle}>{song.title}</Link>
                        {isMain ? <span style={badgeStyle}>Principal sugerido</span> : null}
                      </div>
                      <div style={detailStyle}>
                        {displayArtist(song)} · {song.album || "sem álbum"} · entradas: {song._count.entries} · spotify: {song.spotifyId ?? "sem id"}
                      </div>
                      <div style={idStyle}>{song.id}</div>
                    </div>

                    {!isMain ? (
                      <div style={actionsStyle}>
                        <form action={mergeArtistSongsAction}>
                          <input type="hidden" name="q" value={query} />
                          <input type="hidden" name="keepId" value={group.main.id} />
                          <input type="hidden" name="dropId" value={song.id} />
                          <button style={btnStyle} type="submit">Manter principal</button>
                        </form>
                        <form action={mergeArtistSongsAction}>
                          <input type="hidden" name="q" value={query} />
                          <input type="hidden" name="keepId" value={song.id} />
                          <input type="hidden" name="dropId" value={group.main.id} />
                          <button style={btnAltStyle} type="submit">Manter esta</button>
                        </form>
                      </div>
                    ) : null}
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

const backStyle: CSSProperties = {
  color: "#86868B",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 600,
};
const searchStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  marginBottom: 14,
};
const inputStyle: CSSProperties = {
  width: "100%",
  maxWidth: 460,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.15)",
  fontSize: 14,
};
const searchButtonStyle: CSSProperties = {
  border: "none",
  background: "#1D1D1F",
  color: "white",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};
const cardStyle: CSSProperties = {
  background: "white",
  borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.08)",
  padding: 14,
};
const groupHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  marginBottom: 8,
};
const groupMetaStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#6B6B70",
  background: "#F5F5F7",
  borderRadius: 8,
  padding: "6px 8px",
  whiteSpace: "nowrap",
};
const rowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 0",
  borderTop: "1px solid rgba(0,0,0,0.06)",
};
const songLinkStyle: CSSProperties = {
  color: "#1D1D1F",
  fontWeight: 800,
  textDecoration: "none",
};
const detailStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#6B6B70",
};
const idStyle: CSSProperties = {
  marginTop: 3,
  fontSize: 11,
  color: "#86868B",
  fontFamily: "monospace",
};
const actionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
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
  borderRadius: 8,
  padding: "5px 7px",
};
const emptyStyle: CSSProperties = {
  background: "white",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 8,
  padding: 14,
  color: "#6B6B70",
  fontSize: 14,
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
