import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { ArtistCreatePanel } from "@/app/admin/artists/ArtistCreatePanel";

export default async function AdminArtistNewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="Admin" subtitle="Novo artista">
        <div>Faça login para acessar.</div>
      </Shell>
    );
  }
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) {
    return (
      <Shell title="Admin" subtitle="Novo artista">
        <div>Acesso negado.</div>
      </Shell>
    );
  }

  return (
    <Shell title="Admin" subtitle="Novo artista">
      <div>
        <Link href="/admin/dados/artistas-pendencias" style={{ color: "#86868B", textDecoration: "none", fontSize: 14 }}>
          ← Voltar para artistas
        </Link>
        <h1 style={{ fontSize: 26, margin: "14px 0 6px" }}>Novo artista</h1>
        <p style={{ color: "#86868B", marginTop: 0, marginBottom: 8 }}>
          Cadastro manual no catálogo. Spotify ID é obrigatório para vincular a capa e metadados depois.
        </p>
        <ArtistCreatePanel />
      </div>
    </Shell>
  );
}
