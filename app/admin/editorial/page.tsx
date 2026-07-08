import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { EditorialAdminClient } from "./EditorialAdminClient";

export default async function AdminEditorialPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="Admin" subtitle="Editorial">
        <div>Faça login para acessar.</div>
      </Shell>
    );
  }
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) {
    return (
      <Shell title="Admin" subtitle="Editorial">
        <div>Acesso negado.</div>
      </Shell>
    );
  }

  return (
    <Shell title="Admin" subtitle="Editorial — artigos públicos em /editorial">
      <EditorialAdminClient />
    </Shell>
  );
}
