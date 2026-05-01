import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { parseAlbumSlug, slugify } from "@/lib/music-routes";
import { Shell } from "@/components/layout/Shell";
import { AlbumEditClient } from "./AlbumEditClient";

export default async function AlbumEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>Você precisa entrar para editar álbuns.</div>
      </Shell>
    );
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>Acesso permitido somente para DEV e ADMIN.</div>
      </Shell>
    );
  }

  const { slug } = await params;
  const parsed = parseAlbumSlug(slug);
  if (!parsed) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>Álbum não encontrado.</div>
      </Shell>
    );
  }

  const album =
    parsed.type === "artistAlbumIds"
      ? await prisma.album.findUnique({
          where: { id: parsed.albumId },
          select: { id: true, title: true, exhibitionName: true, coverUrl: true },
        })
      : (
          await prisma.album.findMany({
            select: { id: true, title: true, exhibitionName: true, coverUrl: true, artist: { select: { name: true } } },
            take: 300,
          })
        ).find((a) => slugify(a.title) === parsed.albumSlug && slugify(a.artist.name) === parsed.artistSlug);

  if (!album) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>Álbum não encontrado.</div>
      </Shell>
    );
  }

  return (
    <Shell title="">
      <div style={{ maxWidth: 760, margin: "32px auto", padding: "0 20px 48px" }}>
        <Link href={`/album/${slug}`} style={{ color: "#86868B", textDecoration: "none", fontSize: 14 }}>
          ← Voltar para álbum
        </Link>
        <h1 style={{ fontSize: 30, margin: "12px 0 4px" }}>Editar álbum</h1>
        <p style={{ color: "#86868B", marginTop: 0 }}>Disponível apenas para perfis DEV e ADMIN.</p>
        <AlbumEditClient
          initialAlbum={{
            id: album.id,
            slug,
            title: album.title,
            romanization: album.exhibitionName ?? "",
            coverUrl: album.coverUrl ?? "",
          }}
        />
      </div>
    </Shell>
  );
}
