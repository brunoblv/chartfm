import Link from "next/link";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { parseArtistSlug } from "@/lib/music-routes";
import { Shell } from "@/components/layout/Shell";
import { ArtistEditClient } from "./ArtistEditClient";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ArtistEditPage({ params }: { params: Promise<{ name: string }> }) {
  const { t } = await getServerTranslations();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>{t("artist.signInRequired")}</div>
      </Shell>
    );
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>{t("artist.devAdminOnly")}</div>
      </Shell>
    );
  }

  const { name } = await params;
  const parsed = parseArtistSlug(name);
  const artist = await prisma.artist.findFirst({
    where:
      parsed.type === "dbId"
        ? { id: parsed.artistId }
        : parsed.type === "spotify"
          ? { spotifyId: parsed.spotifyId }
          : { name: { equals: parsed.name, mode: "insensitive" } },
    select: { id: true, name: true, exhibitionName: true, imageUrl: true, spotifyId: true, bio: true },
  });
  if (!artist) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>{t("artist.artistNotFound")}</div>
      </Shell>
    );
  }

  return (
    <Shell title="">
      <div style={{ margin: "32px 0", padding: "0 20px 48px" }}>
        <Link href={`/artist/${name}`} style={{ color: "#86868B", textDecoration: "none", fontSize: 14 }}>
          {t("artist.backToArtist")}
        </Link>
        <h1 style={{ fontSize: 30, margin: "12px 0 4px" }}>{t("artist.editArtist")}</h1>
        <p style={{ color: "#86868B", marginTop: 0 }}>{t("artist.editAvailableDevAdmin")}</p>
        <ArtistEditClient
          initialArtist={{
            id: artist.id,
            slug: name,
            name: artist.name,
            spotifyId: artist.spotifyId,
            romanization: artist.exhibitionName ?? "",
            imageUrl: artist.imageUrl ?? "",
            bio: artist.bio ?? "",
          }}
        />
      </div>
    </Shell>
  );
}
