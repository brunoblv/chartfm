import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { AdminSupportClient } from "./AdminSupportClient";

export default async function AdminSupportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="Suporte" subtitle="Admin">
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
      <Shell title="Suporte" subtitle="Admin">
        <div>Acesso negado.</div>
      </Shell>
    );
  }

  return (
    <Shell title="Tickets de suporte" subtitle="Admin">
      <Suspense>
        <AdminSupportClient />
      </Suspense>
    </Shell>
  );
}
