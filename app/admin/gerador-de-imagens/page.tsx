import { AlbumClubPhase } from "@prisma/client";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateRankingWeekSnapshot } from "@/lib/global-snapshot";
import { GeradorClient } from "./GeradorClient";
import type { GeradorData } from "./GeradorClient";

export const dynamic = "force-dynamic";

export default async function GeradorDeImagensPage() {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return (
      <div style={{ padding: 40, color: "var(--text-muted)", fontFamily: "system-ui" }}>
        Acesso negado. Apenas ADMIN e DEV.
      </div>
    );
  }

  const data = await fetchGeradorData();
  return <GeradorClient data={data} />;
}

function fmtDeadline(d: Date): string {
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${d.getDate()} ${months[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
}

async function fetchGeradorData(): Promise<GeradorData> {
  const [activeRound, reviewGroups, recentReviews, weekSnapshot] = await Promise.all([
    prisma.albumClubRound.findFirst({
      where: { phase: { not: AlbumClubPhase.COMPLETED } },
      orderBy: { number: "desc" },
      include: {
        nominations: {
          include: {
            album: {
              select: {
                title: true,
                exhibitionName: true,
                coverUrl: true,
                releaseDate: true,
                artist: { select: { name: true, exhibitionName: true } },
              },
            },
          },
        },
        winners: {
          include: {
            nomination: {
              include: {
                album: {
                  select: {
                    title: true,
                    exhibitionName: true,
                    coverUrl: true,
                    releaseDate: true,
                    artist: { select: { name: true, exhibitionName: true } },
                  },
                },
              },
            },
          },
          orderBy: { rank: "asc" },
        },
      },
    }),

    prisma.albumReview.groupBy({
      by: ["albumId"],
      _avg: { rating: true },
      _count: { id: true },
      orderBy: [{ _avg: { rating: "desc" } }],
      take: 30,
    }),

    prisma.albumReview.findMany({
      orderBy: [{ helpful: "desc" }, { createdAt: "desc" }],
      take: 30,
      select: {
        rating: true,
        body: true,
        user: { select: { handle: true } },
        album: {
          select: {
            id: true,
            title: true,
            exhibitionName: true,
            coverUrl: true,
            artist: { select: { name: true, exhibitionName: true } },
          },
        },
      },
    }),

    getOrCreateRankingWeekSnapshot(),
  ]);

  // Build ratable albums (>= 2 reviews)
  const ratableGroups = reviewGroups.filter((g) => g._count.id >= 2);
  const albumIds = ratableGroups.map((g) => g.albumId);
  const albums =
    albumIds.length > 0
      ? await prisma.album.findMany({
          where: { id: { in: albumIds } },
          select: {
            id: true,
            title: true,
            exhibitionName: true,
            coverUrl: true,
            releaseDate: true,
            artist: { select: { name: true, exhibitionName: true } },
          },
        })
      : [];

  const albumMap = new Map(albums.map((a) => [a.id, a]));
  const ratable: GeradorData["ratable"] = ratableGroups
    .map((g) => {
      const a = albumMap.get(g.albumId);
      if (!a) return null;
      return {
        id: a.id,
        title: a.exhibitionName || a.title,
        artist: a.artist.exhibitionName || a.artist.name,
        year: a.releaseDate ? String(a.releaseDate.getFullYear()) : "—",
        score: Math.round(g._avg.rating ?? 0),
        reviewCount: g._count.id,
        coverUrl: a.coverUrl ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Build posts from top recent reviews (one per album)
  const seenAlbums = new Set<number>();
  const posts: GeradorData["posts"] = [];
  for (const r of recentReviews) {
    if (seenAlbums.has(r.album.id) || posts.length >= 4) break;
    seenAlbums.add(r.album.id);
    const scoreInfo = ratable.find((ra) => ra.id === r.album.id);
    posts.push({
      album: r.album.exhibitionName || r.album.title,
      artist: r.album.artist.exhibitionName || r.album.artist.name,
      score: scoreInfo?.score ?? Math.round(r.rating),
      reviewer: "@" + r.user.handle,
      excerpt: (r.body ?? "").slice(0, 120),
      coverUrl: r.album.coverUrl ?? null,
    });
  }

  // Build top 5 global from weekly snapshot
  const top5: GeradorData["top5"] = weekSnapshot.payload.weeklySongs.slice(0, 5).map((e) => {
    const move =
      e.status === "up" ? "up"
      : e.status === "down" ? "down"
      : e.status === "new" || e.status === "return" ? "new"
      : "same";
    const pts = e.points ?? 0;
    const plays = pts >= 1000 ? `${(pts / 1000).toFixed(1)}k` : String(pts);
    return {
      rank: e.position,
      title: e.song.title,
      artist: e.song.artist,
      plays,
      move: move as "up" | "down" | "new" | "same",
      coverUrl: e.cover?.imageUrl ?? null,
    };
  });

  return {
    theme: activeRound?.theme ?? "Tema da semana",
    round: activeRound?.number ?? 1,
    nominationsDeadline: activeRound ? fmtDeadline(activeRound.nominationsCloseAt) : "—",
    pollDeadline: activeRound ? fmtDeadline(activeRound.pollCloseAt) : "—",
    nominations: (activeRound?.nominations ?? []).map((n) => ({
      title: n.album.exhibitionName || n.album.title,
      artist: n.album.artist.exhibitionName || n.album.artist.name,
      coverUrl: n.album.coverUrl ?? null,
    })),
    winners: (activeRound?.winners ?? []).map((w) => ({
      title: w.nomination.album.exhibitionName || w.nomination.album.title,
      artist: w.nomination.album.artist.exhibitionName || w.nomination.album.artist.name,
      year: w.nomination.album.releaseDate
        ? String(w.nomination.album.releaseDate.getFullYear())
        : "—",
      votes: w.voteCount,
      coverUrl: w.nomination.album.coverUrl ?? null,
    })),
    ratable,
    top5,
    posts,
  };
}
