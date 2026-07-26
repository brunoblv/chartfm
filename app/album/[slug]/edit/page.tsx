import Link from "next/link";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { parseAlbumSlug, slugify } from "@/lib/music-routes";
import { Shell } from "@/components/layout/Shell";
import { AlbumEditClient } from "./AlbumEditClient";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AlbumEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { t } = await getServerTranslations();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "var(--text-muted)" }}>{t("albums.signInRequired")}</div>
      </Shell>
    );
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "var(--text-muted)" }}>{t("albums.devAdminOnly")}</div>
      </Shell>
    );
  }

  const { slug } = await params;
  const parsed = parseAlbumSlug(slug);
  if (!parsed) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "var(--text-muted)" }}>{t("albums.albumNotFound")}</div>
      </Shell>
    );
  }

  const album =
    parsed.type === "artistAlbumIds"
      ? await prisma.album.findUnique({
          where: { id: parsed.albumId },
          select: {
            id: true,
            title: true,
            exhibitionName: true,
            coverUrl: true,
            spotifyId: true,
            artistSpotifyId: true,
            artist: { select: { name: true, spotifyId: true } },
          },
        })
      : (
          await prisma.album.findMany({
            select: {
              id: true,
              title: true,
              exhibitionName: true,
              coverUrl: true,
              spotifyId: true,
              artistSpotifyId: true,
              artist: { select: { name: true, spotifyId: true } },
            },
            take: 300,
          })
        ).find((a) => slugify(a.title) === parsed.albumSlug && slugify(a.artist.name) === parsed.artistSlug);

  if (!album) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "var(--text-muted)" }}>{t("albums.albumNotFound")}</div>
      </Shell>
    );
  }

  const albumSongs = await prisma.song.findMany({
    where: { albumSpotifyId: album.spotifyId },
    select: { id: true, title: true, artist: true, spotifyId: true, trackNumber: true },
    orderBy: [{ trackNumber: "asc" }, { title: "asc" }],
  });

  return (
    <Shell title="">
      <div style={{ margin: "32px 0", padding: "0 20px 48px" }}>
        <Link href={`/album/${slug}`} style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: 14 }}>
          {t("albums.backToAlbum")}
        </Link>
        <h1 style={{ fontSize: 30, margin: "12px 0 4px" }}>{t("albums.editAlbum")}</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 0 }}>{t("albums.editAvailableDevAdmin")}</p>
        <AlbumEditClient
          initialAlbum={{
            id: album.id,
            slug,
            title: album.title,
            spotifyId: album.spotifyId,
            romanization: album.exhibitionName ?? "",
            coverUrl: album.coverUrl ?? "",
            artist: album.artist.name,
            artistSpotifyId: album.artistSpotifyId,
          }}
          initialSongs={albumSongs}
        />
      </div>
    </Shell>
  );
}
