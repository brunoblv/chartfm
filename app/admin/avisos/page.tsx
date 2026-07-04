import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { AvisosAdminClient } from "./AvisosAdminClient";

export default async function AdminAvisosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="Admin" subtitle="Emissão de avisos">
        <div>Faça login para acessar.</div>
      </Shell>
    );
  }
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) {
    return (
      <Shell title="Admin" subtitle="Emissão de avisos">
        <div>Acesso negado.</div>
      </Shell>
    );
  }

  return (
    <Shell
      title="Admin"
      subtitle="Emissão de avisos — timeline e notificações"
    >
      <AvisosAdminClient />
    </Shell>
  );
}
