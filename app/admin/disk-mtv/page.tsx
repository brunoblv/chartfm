import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { isVideoparadaModuleEnabled } from "@/lib/videoparada-dev-only";
import { DiskMtvAdminClient } from "./DiskMtvAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminDiskMtvPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="Admin" subtitle="Disk MTV">
        <div>Faça login para acessar.</div>
      </Shell>
    );
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!isPrivilegedRole(me?.role)) {
    return (
      <Shell title="Admin" subtitle="Disk MTV">
        <div>Acesso negado.</div>
      </Shell>
    );
  }
  if (!isVideoparadaModuleEnabled()) {
    return (
      <Shell title="Admin" subtitle="Disk MTV">
        <div>Este módulo fica disponível apenas em ambiente de desenvolvimento (desligado em produção por consumo de memória na VPS).</div>
      </Shell>
    );
  }

  return (
    <Shell title="Admin" subtitle="Disk MTV — pré-refill de clipes">
      <DiskMtvAdminClient />
    </Shell>
  );
}
