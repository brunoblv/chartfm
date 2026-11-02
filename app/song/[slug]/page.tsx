import type { Metadata } from "next";
import { entityMetadata, getSongGlobalStats, getSongMaturity } from "@/lib/entity-maturity";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth-options";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { isPrivilegedRole } from "@/lib/permissions";
import { parseSongSlug, buildAlbumPath, buildArtistPath } from "@/lib/music-routes";
import { resolveSongIdFromParsed } from "@/lib/resolve-song-id";
import { SongAppearancesTabs } from "@/components/song/SongAppearancesTabs";
import { Ad } from "@/components/ui/Ad";
import { isSongMature } from "@/lib/content-quality";
import { lookupSongGlobal100Stats } from "@/lib/global-snapshot";
import { resolvedChartEntryPoints } from "@/lib/chart-entry-points";
import { buildSongParadaAppearanceGroups } from "@/lib/song-parada-appearances";
import { isPrimaryParadaChartEntry } from "@/lib/paradas";
import { songEntityKey } from "@/lib/entity-page-snapshot/keys";
import { getLatestEntityPageSnapshot } from "@/lib/entity-page-snapshot/store";
import type { SongPageSnapshotPayload } from "@/lib/entity-page-snapshot/types";
import { buildSongContext } from "@/lib/entity-context-text";
import { formatWeekLabel } from "@/lib/i18n/format";
import { SongFlagButton } from "@/components/song/SongFlagButton";
import { SongMergeButton } from "@/components/song/SongMergeButton";
import { EntityBackfillButtons } from "@/components/admin/EntityBackfillButtons";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { t, locale } = await getServerTranslations();
  return entityMetadata(await getSongMaturity(slug, locale), t("song.notFoundTitle"));
}

export default async function SongPage({ params }: { params: Promise<{ slug: string }> }) {
  const { t, locale } = await getServerTranslations();
  const session = await getServerSession(authOptions);
  const me = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    : null;
  const canEditSong = isPrivilegedRole(me?.role);
  const { slug } = await params;
  const parsed = parseSongSlug(slug);
  if (!parsed) {
    return (
      <Shell title={t("song.notFoundTitle")} subtitle={t("song.notFoundSubtitle")}>
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>{t("song.notFoundSong")}</p>
          <Link href="/discover" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            {t("song.backDiscover")}
          </Link>
        </div>
      </Shell>
    );
  }

  const songId = await resolveSongIdFromParsed(parsed);
  if (!songId) {
    return (
      <Shell title={t("song.notFoundTitle")} subtitle={t("song.notFoundSubtitle")}>
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>{t("song.noDataFound")}</p>
          <Link href="/discover" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            {t("song.backDiscover")}
          </Link>
        </div>
      </Shell>
    );
  }

  const cachedSnapshot = await getLatestEntityPageSnapshot<SongPageSnapshotPayload>(
    "SONG",
    songEntityKey(songId),
  );

  const entries = await prisma.chartEntry.findMany({
    where: {
      chart: { isPublished: true },
      songId,
    },
    select: {
      position: true,
      points: true,
      status: true,
      coverPaletteA: true,
      coverPaletteB: true,
      coverSeed: true,
      chart: {
        select: {
          id: true,
          weekIndex: true,
          userId: true,
          weekLabel: true,
          dateRange: true,
          maxItems: true,
          _count: { select: { entries: true } },
          parada: {
            select: {
              id: true,
              name: true,
              isPrimary: true,
              sortOrder: true,
              cadence: true,
            },
          },
        },
      },
      song: {
        select: {
          title: true,
          artist: true,
          album: true,
          genres: true,
          editorialNote: true,
          albumRef: { select: { id: true, coverUrl: true } },
          spotifyId: true,
          artistSpotifyId: true,
          artistRef: { select: { id: true } },
        },
      },
    },
  });

  const songRow =
    entries[0]?.song ??
    (await prisma.song.findUnique({
      where: { id: songId },
      select: {
        title: true,
        artist: true,
        album: true,
        genres: true,
        editorialNote: true,
        albumRef: { select: { id: true, coverUrl: true } },
        spotifyId: true,
        artistSpotifyId: true,
        artistRef: { select: { id: true } },
      },
    }));

  if (!songRow) {
    return (
      <Shell title={t("song.notFoundTitle")} subtitle={t("song.notFoundSubtitle")}>
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>{t("song.noDataFound")}</p>
          <Link href="/discover" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            {t("song.backDiscover")}
          </Link>
        </div>
      </Shell>
    );
  }

  // Linhas [CLIP_REVIEW_NEEDED] são marcação interna de admin (backfill de clipes) — nunca exibir ao público.
  const publicEditorialNote =
    songRow.editorialNote
      ?.split("\n")
      .filter((line) => !line.includes("[CLIP_REVIEW_NEEDED]"))
      .join("\n")
      .trim() || null;

  const first = entries[0];
  let title = songRow.title;
  let artist = songRow.artist;
  let album = songRow.album ?? "";
  let spotifyId = songRow.spotifyId;
  let artistSpotifyId = songRow.artistSpotifyId;
  let artistDbId = songRow.artistRef?.id ?? null;
  let albumDbId = songRow.albumRef?.id ?? null;
  let coverImageUrl = songRow.albumRef?.coverUrl?.trim() || null;
  let paletteA = first?.coverPaletteA ?? "#FA243C";
  let paletteB = first?.coverPaletteB ?? "#FFE66D";
  let coverSeed = first?.coverSeed ?? 0;
  const songGenres = songRow.genres ?? [];
  let hasChartPresence = entries.length > 0;
  let chartEntries = 0;
  let topUsers: SongPageSnapshotPayload["topUsers"] = [];
  let globalStats: SongPageSnapshotPayload["globalStats"];

  const primaryEntries = entries.filter(isPrimaryParadaChartEntry);

  if (cachedSnapshot) {
    const p = cachedSnapshot.payload;
    title = p.title;
    artist = p.artist;
    album = p.album;
    spotifyId = p.spotifyId;
    artistSpotifyId = p.artistSpotifyId;
    artistDbId = p.artistDbId;
    albumDbId = p.albumDbId;
    coverImageUrl = coverImageUrl || p.coverImageUrl;
    paletteA = p.paletteA;
    paletteB = p.paletteB;
    coverSeed = p.coverSeed;
    hasChartPresence = entries.length > 0;
  }

  {
    const totalPoints = primaryEntries.reduce(
      (sum, e) =>
        sum +
        resolvedChartEntryPoints({
          position: e.position,
          points: e.points,
          chart: {
            maxItems: e.chart.maxItems,
            entryCount: e.chart._count.entries,
            parada: e.chart.parada,
          },
        }),
      0,
    );
    const users = new Set(primaryEntries.map((e) => e.chart.userId)).size;
    const topUsersMap = new Map<string, { points: number }>();
    for (const e of primaryEntries) {
      const pts = resolvedChartEntryPoints({
        position: e.position,
        points: e.points,
        chart: {
          maxItems: e.chart.maxItems,
          entryCount: e.chart._count.entries,
          parada: e.chart.parada,
        },
      });
      const current = topUsersMap.get(e.chart.userId) ?? { points: 0 };
      current.points += pts;
      topUsersMap.set(e.chart.userId, current);
    }
    const topUsersIds = [...topUsersMap.keys()];
    const topUsersRows = topUsersIds.length
      ? await prisma.user.findMany({
          where: { id: { in: topUsersIds } },
          select: { id: true, handle: true, name: true, avatarColor: true, image: true },
        })
      : [];
    const topUsersById = new Map(topUsersRows.map((u) => [u.id, u]));
    topUsers = [...topUsersMap.entries()]
      .map(([userId, row]) => {
        const user = topUsersById.get(userId);
        if (!user) return null;
        return { user, points: row.points };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    chartEntries = primaryEntries.length;
    globalStats = {
      totalPoints,
      uniqueUsers: users,
      weeksTop100: 0,
      number1s: 0,
      peak: 0,
    };
  }

  let firstAppearanceRange: string | null = null;
  {
    const withWeek = primaryEntries.filter((e) => typeof e.chart.weekIndex === "number");
    if (withWeek.length > 0) {
      const earliest = withWeek.reduce((min, e) => (e.chart.weekIndex < min.chart.weekIndex ? e : min));
      const weekLabel = earliest.chart.weekLabel?.trim();
      firstAppearanceRange = weekLabel
        ? formatWeekLabel(locale, weekLabel)
        : earliest.chart.dateRange ?? null;
    }
  }

  {
    const globalRank = await getSongGlobalStats();
    const gs = lookupSongGlobal100Stats(
      { spotifyId: spotifyId ?? songRow.spotifyId, title, artist },
      globalRank,
    );
    const base = globalStats ?? { totalPoints: 0, uniqueUsers: 0, weeksTop100: 0, number1s: 0, peak: 0 };
    globalStats = {
      ...base,
      weeksTop100: gs.weeks,
      number1s: gs.numberOnes,
      peak: gs.peak,
    };
  }

  const currentUserId = session?.user?.id ?? null;
  const myEntries = currentUserId ? entries.filter((e) => e.chart.userId === currentUserId) : [];
  const userParadas = currentUserId
    ? await prisma.parada.findMany({
        where: { userId: currentUserId, isCommunityOfficial: false },
        select: { id: true, name: true, isPrimary: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      })
    : [];
  const myParadaSections = buildSongParadaAppearanceGroups(
    myEntries.map((entry) => ({
      ...entry,
      chart: {
        ...entry.chart,
        entryCount: entry.chart._count.entries,
      },
    })),
    userParadas,
    locale,
  );

  const myVideoClip = currentUserId
    ? await prisma.userSongVideoClipChoice.findUnique({
        where: { userId_songId: { userId: currentUserId, songId } },
        select: { clipId: true, clip: { select: { imageUrl: true } } },
      })
    : null;

  const [allClips, myVotes] = await Promise.all([
    prisma.songVideoClip.findMany({
      where: { songId },
      orderBy: { votes: "desc" },
      select: {
        id: true,
        imageUrl: true,
        votes: true,
        uploadedBy: true,
        uploader: { select: { name: true, handle: true } },
      },
    }),
    currentUserId
      ? prisma.songVideoClipVote.findMany({
          where: { userId: currentUserId, clip: { songId } },
          select: { clipId: true },
        })
      : Promise.resolve([]),
  ]);

  const votedIds = new Set(myVotes.map((v) => v.clipId));

  const initialClips = allClips.map((c) => ({
    id: c.id,
    imageUrl: c.imageUrl,
    votes: c.votes,
    uploadedBy: c.uploadedBy,
    uploaderName: c.uploader.name,
    uploaderHandle: c.uploader.handle,
    hasVoted: votedIds.has(c.id),
    isMyChoice: myVideoClip?.clipId === c.id,
    isMyUpload: c.uploadedBy === currentUserId,
  }));

  return (
    <Shell title="" noPadding>
      <div className="song-page-outer">
        <Link href="/discover" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 14, fontWeight: 500, textDecoration: "none", marginBottom: 24 }}>
          <ChevronLeft size={16} />
          {t("song.back")}
        </Link>
        <div className="song-page-hero">
          <Cover
            cover={{
              palette: [paletteA, paletteB],
              seed: coverSeed,
              imageUrl: coverImageUrl,
            }}
            song={{
              title,
              artist,
              album,
              spotifyId: spotifyId ?? undefined,
              imageUrl: coverImageUrl,
            }}
            size={180}
            rounded={14}
          />
          <div className="song-page-meta">
            <div className="song-page-title">{title}</div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <Link href={buildArtistPath(artist, artistSpotifyId, artistDbId)} style={{ display: "block", fontSize: 16, fontWeight: 600, color: "var(--text)", textDecoration: "none", lineHeight: 1.35 }}>
                {artist}
              </Link>
              {album.trim() ? (
                <Link
                  href={buildAlbumPath(album.trim(), artist, { artistId: artistDbId, albumId: albumDbId })}
                  style={{ display: "block", fontSize: 14, color: "var(--text-muted)", textDecoration: "none", lineHeight: 1.35 }}
                >
                  {album}
                </Link>
              ) : null}
            </div>
            {songGenres.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {songGenres.map((g) => (
                  <span
                    key={g}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 100,
                      background: "var(--fill-subtle)",
                      color: "var(--text)",
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
            {canEditSong && (
              <div style={{ marginTop: 10 }}>
                <Link href={`/song/${slug}/edit`} style={{ fontSize: 13, fontWeight: 700, color: "#FA243C", textDecoration: "none" }}>
                  {t("song.editSong")}
                </Link>
                <div style={{ marginTop: 6 }}>
                  <SongMergeButton songId={songId} title={title} artist={artist} />
                </div>
                <div style={{ marginTop: 6 }}>
                  <EntityBackfillButtons kind="music" id={songId} />
                </div>
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <SongFlagButton songId={songId} isLoggedIn={Boolean(currentUserId)} />
            </div>
          </div>
        </div>

        <div
          style={{
            margin: "32px 0",
            padding: "28px 30px",
            background: "var(--surface)",
            border: "1px solid var(--divider)",
            borderRadius: 20,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--accent)",
              marginBottom: 6,
            }}
          >
            {t("song.contextHeading")}
          </div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--text)",
              marginBottom: 16,
            }}
          >
            {t("song.performanceHeading")}
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-subtle)", marginBottom: publicEditorialNote ? 16 : 0 }}>
            {buildSongContext(
              {
                title,
                artist,
                album,
                chartEntries,
                uniqueUsers: globalStats?.uniqueUsers ?? 0,
                totalPoints: globalStats?.totalPoints ?? 0,
                peak: globalStats?.peak ?? 0,
                weeksTop100: globalStats?.weeksTop100 ?? 0,
                firstAppearanceRange,
              },
              locale,
            )}
          </p>
          {publicEditorialNote && (
            <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-subtle)", margin: 0 }}>
              {publicEditorialNote}
            </p>
          )}
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-muted)", marginTop: 16 }}>
            {t("song.explainerPrefix")}{" "}
            <Link href="/guides/como-funciona-o-global-100" style={{ color: "var(--accent)" }}>
              {t("song.explainerLinkText")}
            </Link>
            .
          </p>
        </div>

        <SongAppearancesTabs
          currentUserId={currentUserId}
          songId={songId}
          myParadaSections={myParadaSections}
          globalStats={globalStats}
          topUsers={topUsers}
          initialVideoClipUrl={myVideoClip?.clip?.imageUrl ?? null}
          initialClips={initialClips}
        />

        <Ad
          placement="song"
          eligible={isSongMature({ uniqueUsers: globalStats?.uniqueUsers ?? 0, weeksTop100: globalStats?.weeksTop100 ?? 0 })} format="rectangle" style={{ margin: "28px 0" }} />

        {!hasChartPresence && (
          <div style={{ marginTop: 20, padding: 14, background: "var(--fill-inset)", borderRadius: 12, fontSize: 14, color: "var(--text-muted)" }}>
            {t("song.noChartPresence")}
          </div>
        )}
        <div style={{ marginTop: 24, fontSize: 13, color: "var(--text-muted)" }}>
          {t("song.primaryEntriesCount", { count: chartEntries })}
        </div>
      </div>
    </Shell>
  );
}
