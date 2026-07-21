import Link from "next/link";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { parseSongSlug } from "@/lib/music-routes";
import { resolveSongIdFromParsed } from "@/lib/resolve-song-id";
import { Shell } from "@/components/layout/Shell";
import { SongEditClient } from "./SongEditClient";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SongEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { t } = await getServerTranslations();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p>{t("song.signInRequired")}</p>
        </div>
      </Shell>
    );
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p>{t("song.devAdminOnly")}</p>
        </div>
      </Shell>
    );
  }

  const { slug } = await params;
  const parsed = parseSongSlug(slug);
  if (!parsed) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p>{t("song.songNotFound")}</p>
        </div>
      </Shell>
    );
  }

  const songId = await resolveSongIdFromParsed(parsed);
  if (!songId) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p>{t("song.songNotFound")}</p>
        </div>
      </Shell>
    );
  }

  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: {
      id: true,
      title: true,
      exhibitionName: true,
      artist: true,
      album: true,
      artistSpotifyId: true,
      albumSpotifyId: true,
      spotifyId: true,
      editorialNote: true,
      feats: {
        select: { id: true, artistSpotifyId: true, artist: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!song) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p>{t("song.songNotFound")}</p>
        </div>
      </Shell>
    );
  }

  let artistSpotifyIdForEdit = song.artistSpotifyId?.trim() ?? "";
  if (!artistSpotifyIdForEdit) {
    const guessed = await prisma.artist.findFirst({
      where: { name: { equals: song.artist, mode: "insensitive" } },
      select: { spotifyId: true },
    });
    artistSpotifyIdForEdit = guessed?.spotifyId ?? "";
  }

  return (
    <Shell title="">
      <div style={{ margin: "32px 0", padding: "0 20px 48px" }}>
        <Link href={`/song/${slug}`} style={{ color: "#86868B", textDecoration: "none", fontSize: 14 }}>
          {t("song.backToSong")}
        </Link>
        <h1 style={{ fontSize: 30, margin: "12px 0 4px" }}>{t("song.editSong")}</h1>
        <p style={{ color: "#86868B", marginTop: 0 }}>{t("song.editAvailableDevAdmin")}</p>
        <SongEditClient
          initialSong={{
            id: song.id,
            slug,
            title: song.title,
            spotifyId: song.spotifyId ?? "",
            romanization: song.exhibitionName ?? "",
            artist: song.artist,
            album: song.album ?? "",
            artistSpotifyId: artistSpotifyIdForEdit,
            albumSpotifyId: song.albumSpotifyId ?? "",
            editorialNote: song.editorialNote ?? "",
          }}
          initialFeats={song.feats.map((f) => ({ id: f.id, artistSpotifyId: f.artistSpotifyId, artistName: f.artist.name }))}
        />
      </div>
    </Shell>
  );
}
