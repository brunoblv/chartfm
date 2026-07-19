import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { CreateAlbumClient } from "@/app/admin/albums/CreateAlbumClient";

export default async function AdminAlbumNewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="Admin" subtitle="Novo álbum">
        <div>Faça login para acessar.</div>
      </Shell>
    );
  }
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) {
    return (
      <Shell title="Admin" subtitle="Novo álbum">
        <div>Acesso negado.</div>
      </Shell>
    );
  }

  return (
    <Shell title="Admin" subtitle="Novo álbum">
      <div>
        <Link href="/admin/dados/albuns-pendencias" style={{ color: "#86868B", textDecoration: "none", fontSize: 14 }}>
          ← Voltar para álbuns
        </Link>
        <h1 style={{ fontSize: 26, margin: "14px 0 6px" }}>Novo álbum</h1>
        <p style={{ color: "#86868B", marginTop: 0, marginBottom: 8 }}>
          Vincule a um artista já cadastrado (ou digite um nome — um artista manual pode ser criado se necessário).
        </p>
        <CreateAlbumClient defaultOpen />
      </div>
    </Shell>
  );
}
