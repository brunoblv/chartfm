import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { parseArtistSlug } from "@/lib/music-routes";
import { ArtistEditClient } from "./ArtistEditClient";

export default async function ArtistEditPage({ params }: { params: Promise<{ name: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>Você precisa entrar para editar artistas.</div>;

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>Acesso permitido somente para DEV e ADMIN.</div>;

  const { name } = await params;
  const parsed = parseArtistSlug(name);
  const artist = await prisma.artist.findFirst({
    where:
      parsed.type === "dbId"
        ? { id: parsed.artistId }
        : parsed.type === "spotify"
          ? { spotifyId: parsed.spotifyId }
          : { name: { equals: parsed.name, mode: "insensitive" } },
    select: { id: true, name: true, exhibitionName: true, imageUrl: true },
  });
  if (!artist) return <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>Artista não encontrado.</div>;

  return (
    <div style={{ maxWidth: 760, margin: "32px auto", padding: "0 20px 48px" }}>
      <Link href={`/artist/${name}`} style={{ color: "#86868B", textDecoration: "none", fontSize: 14 }}>
        ← Voltar para artista
      </Link>
      <h1 style={{ fontSize: 30, margin: "12px 0 4px" }}>Editar artista</h1>
      <p style={{ color: "#86868B", marginTop: 0 }}>Disponível apenas para perfis DEV e ADMIN.</p>
      <ArtistEditClient
        initialArtist={{
          id: artist.id,
          slug: name,
          name: artist.name,
          romanization: artist.exhibitionName ?? "",
          imageUrl: artist.imageUrl ?? "",
        }}
      />
    </div>
  );
}
