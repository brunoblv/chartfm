import Link from "next/link";
import { ChevronLeft, Star, MessageSquare } from "lucide-react";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { pointsForPosition, songKey } from "@/lib/chart-page-common";
import {
  loadSongGlobalStatsFromSnapshots,
  songSnapshotAggKey,
} from "@/lib/global-snapshot";
import { albumEntityKey } from "@/lib/entity-page-snapshot/keys";
import { getLatestEntityPageSnapshot } from "@/lib/entity-page-snapshot/store";
import type { AlbumPageSnapshotPayload } from "@/lib/entity-page-snapshot/types";
import { Cover } from "@/components/ui/Cover";
import { Avatar } from "@/components/ui/Avatar";
import { COVER_PALETTES } from "@/lib/data";
import { parseAlbumSlug, buildArtistPath, buildSongPath, slugify } from "@/lib/music-routes";
import { authOptions } from "@/lib/auth-options";
import { isPrivilegedRole } from "@/lib/permissions";
import { buildAlbumContext } from "@/lib/entity-context-text";
import { EntityBackfillButtons } from "@/components/admin/EntityBackfillButtons";
import { AlbumDetailClient } from "./AlbumDetailClient";
import { getServerTranslations } from "@/lib/i18n/server-translations";

function albumColor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % COVER_PALETTES.length;
  return COVER_PALETTES[idx];
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { t, locale } = await getServerTranslations();
  const session = await getServerSession(authOptions);
  const me = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    : null;
  const canEditAlbum = isPrivilegedRole(me?.role);
  const { slug } = await params;
  const parsed = parseAlbumSlug(slug);
  const cachedSnapshot = parsed
    ? await getLatestEntityPageSnapshot<AlbumPageSnapshotPayload>("ALBUM", albumEntityKey(parsed))
    : null;

  if (!parsed) {
    return (
      <Shell title={t("albums.albumLabel")} subtitle={t("albums.notFoundPage")}>
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>{t("albums.invalidSlug")}</p>
          <Link href="/discover" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
            {t("albums.backDiscover")}
          </Link>
        </div>
      </Shell>
    );
  }

  const firstArtistWord = parsed.type === "slug"
    ? (parsed.artistSlug.split("-").find((w) => w.length > 0) ?? parsed.artistSlug)
    : null;

  const artistRef = parsed.type === "artistAlbumIds"
    ? await prisma.artist.findUnique({
        where: { id: parsed.artistId },
        select: { id: true, spotifyId: true, name: true, imageUrl: true, spotifyUrl: true },
      })
    : await prisma.artist.findFirst({
        where: { name: { contains: firstArtistWord ?? "", mode: "insensitive" } },
        select: { id: true, spotifyId: true, name: true, imageUrl: true, spotifyUrl: true },
      });

  const allEntries = await prisma.chartEntry.findMany({
    where: parsed.type === "artistAlbumIds"
      ? {
          chart: { isPublished: true },
          song: {
            albumRef: { id: parsed.albumId },
            artistRef: { id: parsed.artistId },
          },
        }
      : {
          chart: { isPublished: true },
          OR: [
            ...(artistRef?.spotifyId ? [{ song: { artistSpotifyId: artistRef.spotifyId } }] : []),
            { song: { artist: { contains: firstArtistWord ?? "", mode: "insensitive" } } },
          ],
        },
    select: {
      position: true,
      points: true,
      coverPaletteA: true,
      coverPaletteB: true,
      coverSeed: true,
      chart: {
        select: {
          weekIndex: true,
          userId: true,
          user: {
            select: { id: true, handle: true, name: true, avatarColor: true, image: true },
          },
        },
      },
      song: {
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          spotifyId: true,
          artistSpotifyId: true,
          albumRef: { select: { id: true, coverUrl: true, exhibitionName: true, releaseDate: true } },
          artistRef: { select: { id: true } },
        },
      },
    },
  });

  const albumEntries = parsed.type === "artistAlbumIds"
    ? allEntries
    : allEntries.filter((e) => slugify(e.song.album ?? "") === parsed.albumSlug);

  if (cachedSnapshot && albumEntries.length === 0) {
    const p = cachedSnapshot.payload;
    const canonicalAlbum = p.canonicalAlbum;
    const canonicalArtist = p.canonicalArtist;
    const coverImageUrl = p.coverImageUrl;
    const releaseDate = p.releaseDate ? new Date(p.releaseDate) : null;
    const palette = p.palette;
    const songs = p.songs;
    const topFans = p.topFans;
    const coverForHero = p.coverForHero;
    const stats = p.stats;
    const artistSpotifyId = p.artistSpotifyId;
    const artistDbId = p.artistDbId;
    const albumDbId = p.albumDbId;
    const firstEntrySpotifyId = songs[0]?.spotifyId ?? null;

    const rankedSongs = songs.filter((s) => s.peak > 0);
    const bestSong = rankedSongs.length > 0
      ? rankedSongs.reduce((best, s) => (s.peak < best.peak ? s : best))
      : null;
    const albumContextText = buildAlbumContext(
      {
        album: canonicalAlbum,
        artist: canonicalArtist,
        releaseYear: releaseDate ? releaseDate.getFullYear().toString() : null,
        trackCount: songs.length,
        rankedTrackCount: rankedSongs.length,
        bestSong: bestSong ? { title: bestSong.title, peak: bestSong.peak } : null,
      },
      locale,
    );

    const statsSection = (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 40 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden", marginBottom: 40 }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--divider)" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em" }}>{t("albums.tracks")}</h2>
          </div>
          <div style={{ padding: "0 8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "40px 56px minmax(0,1fr) 100px 100px 100px 100px", padding: "8px 16px", gap: 0 }}>
              {["#", "", t("albums.colTrack"), t("albums.colPoints"), t("albums.colWeeks"), t("albums.colPeak"), "#1s"].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", padding: "8px 6px" }}>{h}</div>
              ))}
            </div>
            {songs.map((s, i) => (
              <div
                key={s.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 56px minmax(0,1fr) 100px 100px 100px 100px",
                  alignItems: "center",
                  padding: "4px 16px",
                  borderRadius: 8,
                  gap: 0,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{i + 1}</div>
                <div style={{ padding: "6px 6px" }}>
                  <Cover cover={s.cover} song={{ title: s.title, artist: canonicalArtist, album: canonicalAlbum, spotifyId: s.spotifyId ?? undefined }} size={44} rounded={8} />
                </div>
                <div style={{ padding: "0 12px", minWidth: 0 }}>
                  <Link
                    href={buildSongPath({ title: s.title, artist: canonicalArtist, id: s.songId, artistId: artistDbId, slugArtist: s.dbArtist, spotifyId: s.spotifyId })}
                    style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}
                  >
                    {s.title}
                  </Link>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.points}</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.weeks}</div>
                <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", padding: "0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                  {s.peak === 1 && <span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center" }}><Star size={12} color="currentColor" fill="currentColor" /></span>}
                  {s.peak > 0 ? `#${s.peak}` : "-"}
                </div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.number1s}</div>
              </div>
            ))}
          </div>
        </div>
        {topFans.length > 0 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>{t("albums.topFans")}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {topFans.map(({ user, points }) => (
                <Link key={user.id} href={`/profile/${user.handle}`} style={{ textDecoration: "none" }}>
                  <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20, textAlign: "center" }}>
                    <Avatar user={user} imageUrl={user.image} size={56} />
                    <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{user.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>@{user.handle}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>{t("albums.pointsInAlbum")}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: palette[0], fontVariantNumeric: "tabular-nums" }}>{points}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </>
    );

    const tracklistSection = (
      <div style={{ maxWidth: 800 }}>
        <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "50px minmax(0,1fr) 90px 90px 90px", padding: "12px 24px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: "1px solid var(--divider)" }}>
            <div>#</div>
            <div>{t("albums.colTrack")}</div>
            <div style={{ textAlign: "right" }}>{t("albums.colPoints")}</div>
            <div style={{ textAlign: "right" }}>{t("albums.colWeeks")}</div>
            <div style={{ textAlign: "right" }}>{t("albums.colPeak")}</div>
          </div>
          {songs.map((s, i) => (
            <div
              key={s.key}
              style={{
                display: "grid",
                gridTemplateColumns: "50px minmax(0,1fr) 90px 90px 90px",
                alignItems: "center",
                padding: "14px 24px",
                borderBottom: i < songs.length - 1 ? "1px solid var(--divider-soft)" : "none",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Cover cover={s.cover} song={{ title: s.title, artist: canonicalArtist, album: canonicalAlbum }} size={36} rounded={6} />
                <Link
                  href={buildSongPath({ title: s.title, artist: canonicalArtist, id: s.songId, artistId: artistDbId, slugArtist: s.dbArtist, spotifyId: s.spotifyId })}
                  style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", textDecoration: "none", color: "inherit" }}
                >
                  {s.title}
                </Link>
              </div>
              <div style={{ textAlign: "right", fontSize: 13, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{s.points}</div>
              <div style={{ textAlign: "right", fontSize: 13, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{s.weeks}</div>
              <div style={{ textAlign: "right", fontSize: 13, fontVariantNumeric: "tabular-nums", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
                {s.peak === 1 && <span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center" }}><Star size={11} color="currentColor" fill="currentColor" /></span>}
                {s.peak > 0 ? `#${s.peak}` : "-"}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    return (
      <Shell title="" noPadding>
        <div style={{ background: "var(--bg)" }}>
          <div
            style={{
              background: `linear-gradient(180deg, ${palette[0]} 0%, ${palette[1]} 50%, transparent 100%)`,
              padding: "48px 40px 40px 40px",
            }}
          >
            <Link
              href={buildArtistPath(canonicalArtist, artistSpotifyId, artistDbId)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500, textDecoration: "none", marginBottom: 32 }}
            >
              <ChevronLeft size={16} />
              {canonicalArtist}
            </Link>
            <div style={{ display: "flex", gap: 40, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flexShrink: 0, boxShadow: "0 16px 48px rgba(0,0,0,0.35)", borderRadius: 14 }}>
                <Cover
                  cover={coverForHero}
                  song={{
                    title: canonicalAlbum,
                    artist: canonicalArtist,
                    album: canonicalAlbum,
                    spotifyId: firstEntrySpotifyId ?? undefined,
                    imageUrl: coverImageUrl,
                  }}
                  size={200}
                  rounded={14}
                />
              </div>
              <div style={{ color: "white", flex: 1, minWidth: 280 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8, marginBottom: 8 }}>
                  Álbum
                </div>
                <h1 style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 12 }}>
                  {canonicalAlbum}
                </h1>
                <Link
                  href={buildArtistPath(canonicalArtist, artistSpotifyId, artistDbId)}
                  style={{ display: "inline-block", fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.9)", textDecoration: "none", marginBottom: 20 }}
                >
                  {canonicalArtist}
                </Link>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14, opacity: 0.9 }}>
                  {releaseDate && <span>{releaseDate.getFullYear()}</span>}
                  {stats.map((s) => (
                    <span key={s.label}>
                      <strong>{s.value}</strong> {s.label.toLowerCase()}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
                  {albumDbId && (
                    <Link
                      href={`/criticsfm/${albumDbId}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "rgba(255,255,255,0.18)",
                        color: "white",
                        textDecoration: "none",
                        fontSize: 13,
                        fontWeight: 700,
                        padding: "8px 16px",
                        borderRadius: 100,
                        border: "1px solid rgba(255,255,255,0.3)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <MessageSquare size={14} />
                      Reviews no CriticsFM
                    </Link>
                  )}
                  {canEditAlbum && (
                    <Link href={`/album/${slug}/edit`} style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                      {t("albums.editAlbum")}
                    </Link>
                  )}
                </div>
                {canEditAlbum && albumDbId ? (
                  <div style={{ marginTop: 8 }}>
                    <EntityBackfillButtons kind="albums" id={albumDbId} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            margin: "32px 40px",
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
            Contexto no ChartFM
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
            Desempenho no ChartFM
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-subtle)", marginBottom: 16 }}>
            {albumContextText}
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-muted)", margin: 0 }}>
            A tabela de faixas mostra os pontos acumulados por cada música do álbum, quantas semanas ela passou
            no Global 100 e sua melhor posição no ranking coletivo.
          </p>
        </div>

        <AlbumDetailClient
          albumDbId={albumDbId}
          albumTitle={canonicalAlbum}
          albumArtist={canonicalArtist}
          palette={palette}
          statsSection={statsSection}
          tracklistSection={tracklistSection}
        />
      </Shell>
    );
  }

  if (albumEntries.length === 0) {
    return (
      <Shell title={t("albums.albumLabel")} subtitle={t("albums.notFoundPage")}>
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>{t("albums.noDataFound")}</p>
          <Link href="/discover" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
            {t("albums.backDiscover")}
          </Link>
        </div>
      </Shell>
    );
  }

  const canonicalAlbum = (albumEntries[0].song.albumRef?.exhibitionName?.trim() || albumEntries[0].song.album) ?? "";
  const canonicalArtist = artistRef?.name ?? albumEntries[0].song.artist;
  const coverImageUrl = albumEntries.find((e) => e.song.albumRef?.coverUrl?.trim())?.song.albumRef?.coverUrl?.trim() ?? null;
  const releaseDate = albumEntries.find((e) => e.song.albumRef?.releaseDate)?.song.albumRef?.releaseDate ?? null;
  const firstEntry = albumEntries[0];
  const palette = albumColor(canonicalAlbum + canonicalArtist);

  const listenersSet = new Set(albumEntries.map((e) => e.chart.userId));

  type SongRow = {
    key: string;
    songId: string;
    spotifyId: string | null;
    artistSpotifyId: string | null;
    dbArtist: string;
    title: string;
    points: number;
    cover: { palette: [string, string]; seed: number; imageUrl?: string | null };
    weeks: number;
    peak: number;
    number1s: number;
  };

  const songsMap = new Map<string, SongRow>();
  let totalPoints = 0;
  let number1sAlbum = 0;

  for (const e of albumEntries) {
    const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
    totalPoints += pts;
    if (e.position === 1) number1sAlbum += 1;

    const key = songKey(e.song.title, e.song.artist);
    const manual = e.song.albumRef?.coverUrl?.trim() || null;
    const cur = songsMap.get(key) ?? {
      key,
      songId: e.song.id,
      spotifyId: e.song.spotifyId,
      artistSpotifyId: e.song.artistSpotifyId,
      dbArtist: e.song.artist,
      title: e.song.title,
      points: 0,
      weeks: 0,
      peak: 9999,
      number1s: 0,
      cover: {
        palette: [e.coverPaletteA, e.coverPaletteB] as [string, string],
        seed: e.coverSeed,
        imageUrl: manual ?? undefined,
      },
    };
    cur.points += pts;
    if (manual) cur.cover = { ...cur.cover, imageUrl: manual };
    songsMap.set(key, cur);
  }

  let songs = [...songsMap.values()].sort((a, b) => b.points - a.points);
  let topFans: AlbumPageSnapshotPayload["topFans"] = [];
  let stats: AlbumPageSnapshotPayload["stats"] = [
    { label: t("albums.totalPoints"), value: totalPoints, color: "var(--accent)" },
    { label: t("albums.uniqueListeners"), value: listenersSet.size, color: "#8338EC" },
    { label: t("albums.rankedTracks"), value: songsMap.size, color: "#3A86FF" },
    { label: t("albums.numberOnes"), value: number1sAlbum, color: "#FFD700" },
  ];

  if (cachedSnapshot) {
    songs = cachedSnapshot.payload.songs;
    topFans = cachedSnapshot.payload.topFans;
    stats = cachedSnapshot.payload.stats;
  } else {
    const globalRank = await loadSongGlobalStatsFromSnapshots();
    songs = [...songsMap.values()]
      .map((s) => {
        const gs = globalRank.get(
          songSnapshotAggKey({
            spotifyId: s.spotifyId,
            title: s.title,
            artist: s.dbArtist,
            slugArtist: s.dbArtist,
          }),
        );
        return {
          ...s,
          weeks: gs?.weeks ?? 0,
          peak: gs?.peak ?? 0,
          number1s: gs?.numberOnes ?? 0,
        };
      })
      .sort((a, b) => b.points - a.points);

    const fanMap = new Map<string, { user: { id: string; handle: string; name: string; avatar: string; image: string | null }; points: number }>();
    for (const e of albumEntries) {
      const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
      const existing = fanMap.get(e.chart.user.id) ?? {
        user: { id: e.chart.user.id, handle: e.chart.user.handle, name: e.chart.user.name, avatar: e.chart.user.avatarColor, image: e.chart.user.image },
        points: 0,
      };
      existing.points += pts;
      fanMap.set(e.chart.user.id, existing);
    }
    topFans = [...fanMap.values()].sort((a, b) => b.points - a.points).slice(0, 4);
  }

  const coverForHero = {
    palette: [firstEntry.coverPaletteA, firstEntry.coverPaletteB] as [string, string],
    seed: firstEntry.coverSeed,
    imageUrl: coverImageUrl,
  };

  const artistSpotifyId = albumEntries[0].song.artistSpotifyId;
  const artistDbId = artistRef?.id ?? albumEntries[0].song.artistRef?.id ?? null;

  // Find the Album DB record ID for reviews
  const albumDbId = parsed.type === "artistAlbumIds"
    ? parsed.albumId
    : (albumEntries.find((e) => e.song.albumRef?.id)?.song.albumRef?.id ?? null);

  const rankedSongs = songs.filter((s) => s.peak > 0);
  const bestSong = rankedSongs.length > 0
    ? rankedSongs.reduce((best, s) => (s.peak < best.peak ? s : best))
    : null;
  const albumContextText = buildAlbumContext(
    {
      album: canonicalAlbum,
      artist: canonicalArtist,
      releaseYear: releaseDate ? releaseDate.getFullYear().toString() : null,
      trackCount: songs.length,
      rankedTrackCount: rankedSongs.length,
      bestSong: bestSong ? { title: bestSong.title, peak: bestSong.peak } : null,
    },
    locale,
  );

  // — Stats section (for "Estatísticas" tab) —
  const statsSection = (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 40 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden", marginBottom: 40 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--divider)" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em" }}>{t("albums.tracks")}</h2>
        </div>
        <div style={{ padding: "0 8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "40px 56px minmax(0,1fr) 100px 100px 100px 100px", padding: "8px 16px", gap: 0 }}>
            {["#", "", t("albums.colTrack"), t("albums.colPoints"), t("albums.colWeeks"), t("albums.colPeak"), "#1s"].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", padding: "8px 6px" }}>{h}</div>
            ))}
          </div>
          {songs.map((s, i) => (
            <div
              key={s.key}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 56px minmax(0,1fr) 100px 100px 100px 100px",
                alignItems: "center",
                padding: "4px 16px",
                borderRadius: 8,
                gap: 0,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{i + 1}</div>
              <div style={{ padding: "6px 6px" }}>
                <Cover cover={s.cover} song={{ title: s.title, artist: canonicalArtist, album: canonicalAlbum, spotifyId: s.spotifyId ?? undefined }} size={44} rounded={8} />
              </div>
              <div style={{ padding: "0 12px", minWidth: 0 }}>
                <Link
                  href={buildSongPath({ title: s.title, artist: canonicalArtist, id: s.songId, artistId: artistDbId, slugArtist: s.dbArtist, spotifyId: s.spotifyId })}
                  style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}
                >
                  {s.title}
                </Link>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.points}</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.weeks}</div>
              <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", padding: "0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                {s.peak === 1 && <span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center" }}><Star size={12} color="currentColor" fill="currentColor" /></span>}
                {s.peak > 0 ? `#${s.peak}` : "-"}
              </div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.number1s}</div>
            </div>
          ))}
        </div>
      </div>

      {topFans.length > 0 && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>{t("albums.topFans")}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {topFans.map(({ user, points }) => (
              <Link key={user.id} href={`/profile/${user.handle}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20, textAlign: "center" }}>
                  <Avatar user={user} imageUrl={user.image} size={56} />
                  <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>@{user.handle}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>{t("albums.pointsInAlbum")}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: palette[0], fontVariantNumeric: "tabular-nums" }}>{points}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );

  // — Tracklist section —
  const tracklistSection = (
    <div style={{ maxWidth: 800 }}>
      <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "50px minmax(0,1fr) 90px 90px 90px", padding: "12px 24px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: "1px solid var(--divider)" }}>
          <div>#</div>
          <div>{t("albums.colTrack")}</div>
          <div style={{ textAlign: "right" }}>{t("albums.colPoints")}</div>
          <div style={{ textAlign: "right" }}>{t("albums.colWeeks")}</div>
          <div style={{ textAlign: "right" }}>{t("albums.colPeak")}</div>
        </div>
        {songs.map((s, i) => (
          <div
            key={s.key}
            style={{
              display: "grid",
              gridTemplateColumns: "50px minmax(0,1fr) 90px 90px 90px",
              alignItems: "center",
              padding: "14px 24px",
              borderBottom: i < songs.length - 1 ? "1px solid var(--divider-soft)" : "none",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Cover cover={s.cover} song={{ title: s.title, artist: canonicalArtist, album: canonicalAlbum }} size={36} rounded={6} />
              <Link
                href={buildSongPath({ title: s.title, artist: canonicalArtist, id: s.songId, artistId: artistDbId, slugArtist: s.dbArtist, spotifyId: s.spotifyId })}
                style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", textDecoration: "none", color: "inherit" }}
              >
                {s.title}
              </Link>
            </div>
            <div style={{ textAlign: "right", fontSize: 13, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{s.points}</div>
            <div style={{ textAlign: "right", fontSize: 13, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{s.weeks}</div>
            <div style={{ textAlign: "right", fontSize: 13, fontVariantNumeric: "tabular-nums", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
              {s.peak === 1 && <span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center" }}><Star size={11} color="currentColor" fill="currentColor" /></span>}
              {s.peak > 0 ? `#${s.peak}` : "-"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Shell title="" noPadding>
      {/* Hero */}
      <div style={{ background: "var(--bg)" }}>
      <div style={{
        background: `linear-gradient(180deg, ${palette[0]} 0%, ${palette[1]} 50%, transparent 100%)`,
        padding: "48px 40px 40px 40px",
      }}>
        <Link
          href={buildArtistPath(canonicalArtist, artistSpotifyId, artistDbId)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500, textDecoration: "none", marginBottom: 32 }}
        >
          <ChevronLeft size={16} />
          {canonicalArtist}
        </Link>

        <div style={{ display: "flex", gap: 40, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flexShrink: 0, boxShadow: "0 16px 48px rgba(0,0,0,0.35)", borderRadius: 14 }}>
            <Cover
              cover={coverForHero}
              song={{ title: canonicalAlbum, artist: canonicalArtist, album: canonicalAlbum, spotifyId: albumEntries[0].song.spotifyId ?? undefined, imageUrl: coverImageUrl }}
              size={200}
              rounded={14}
            />
          </div>

          <div style={{ color: "white", flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8, marginBottom: 8 }}>
              {t("albums.albumLabel")}
            </div>
            <h1 style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 12 }}>
              {canonicalAlbum}
            </h1>
            <Link
              href={buildArtistPath(canonicalArtist, artistSpotifyId, artistDbId)}
              style={{ display: "inline-block", fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.9)", textDecoration: "none", marginBottom: 20 }}
            >
              {canonicalArtist}
            </Link>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14, opacity: 0.9 }}>
              {releaseDate && (
                <span>{releaseDate.getFullYear()}</span>
              )}
              <span><strong>{listenersSet.size}</strong> {t("albums.listenersWord")}</span>
              <span><strong>{songsMap.size}</strong> {t("albums.tracksWord")}</span>
              <span><strong>{totalPoints}</strong> {t("albums.pointsWord")}</span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
              {albumDbId && (
                <Link
                  href={`/criticsfm/${albumDbId}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(255,255,255,0.18)",
                    color: "white",
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    padding: "8px 16px",
                    borderRadius: 100,
                    border: "1px solid rgba(255,255,255,0.3)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <MessageSquare size={14} />
                  {t("albums.criticsReviews")}
                </Link>
              )}
              {canEditAlbum && (
                <Link
                  href={`/album/${slug}/edit`}
                  style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: 13, fontWeight: 700 }}
                >
                  {t("albums.editAlbum")}
                </Link>
              )}
            </div>
            {canEditAlbum && albumDbId ? (
              <div style={{ marginTop: 8 }}>
                <EntityBackfillButtons kind="albums" id={albumDbId} />
              </div>
            ) : null}
          </div>

        </div>
      </div>
      </div>

      <div
        style={{
          margin: "32px 40px",
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
          {t("albums.contextHeading")}
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
          {t("albums.performanceHeading")}
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-subtle)", marginBottom: 16 }}>
          {albumContextText}
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-muted)", margin: 0 }}>
          {t("albums.tracklistExplainer")}
        </p>
      </div>

      {/* Tabbed content */}
      <AlbumDetailClient
        albumDbId={albumDbId}
        albumTitle={canonicalAlbum}
        albumArtist={canonicalArtist}
        palette={palette}
        statsSection={statsSection}
        tracklistSection={tracklistSection}
      />
    </Shell>
  );
}
