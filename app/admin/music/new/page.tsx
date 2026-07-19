import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { AddSongManual } from "@/components/admin/AddSongManual";

export default async function AdminMusicNewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="Admin" subtitle="Nova música">
        <div>Faça login para acessar.</div>
      </Shell>
    );
  }
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) {
    return (
      <Shell title="Admin" subtitle="Nova música">
        <div>Acesso negado.</div>
      </Shell>
    );
  }

  return (
    <Shell title="Admin" subtitle="Nova música">
      <div>
        <Link href="/admin/dados/catalogo" style={{ color: "#86868B", textDecoration: "none", fontSize: 14 }}>
          ← Voltar para músicas
        </Link>
        <h1 style={{ fontSize: 26, margin: "14px 0 6px" }}>Nova música</h1>
        <p style={{ color: "#86868B", marginTop: 0, marginBottom: 8 }}>Preencha os dados abaixo. Não é necessário usar a API do Spotify.</p>
        <AddSongManual heading="Cadastro manual" description="Escolha artista (e álbum, se quiser) entre os já cadastrados. Spotify ID da faixa é opcional." />
      </div>
    </Shell>
  );
}
