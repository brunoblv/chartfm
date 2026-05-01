import Link from "next/link";
import type { CSSProperties } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";

export default async function AdminDuplicatesHomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <Shell title="Admin" subtitle="Duplicados"><div>Faça login para acessar.</div></Shell>;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return <Shell title="Admin" subtitle="Duplicados"><div>Acesso negado.</div></Shell>;

  return (
    <Shell title="Admin" subtitle="Deduplicação de catálogo">
      <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
        <Link href="/admin/duplicates/songs" style={cardStyle}>
          <strong>Músicas duplicadas</strong>
          <span style={subStyle}>Agrupa por título + artista normalizados e permite merge.</span>
        </Link>
        <Link href="/admin/duplicates/artists" style={cardStyle}>
          <strong>Artistas duplicados</strong>
          <span style={subStyle}>Agrupa por nome normalizado e permite merge com atualização de referências.</span>
        </Link>
        <Link href="/admin/duplicates/albums" style={cardStyle}>
          <strong>Álbuns duplicados</strong>
          <span style={subStyle}>Comparação fuzzy (deluxe, track by track, etc.) com merge de referências.</span>
        </Link>
      </div>
    </Shell>
  );
}

const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  textDecoration: "none",
  color: "#1D1D1F",
  background: "white",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 12,
  padding: "14px 16px",
};

const subStyle: CSSProperties = {
  fontSize: 13,
  color: "#6B6B70",
};
