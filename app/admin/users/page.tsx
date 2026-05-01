import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { UsersAdminClient } from "./users-admin-client";
import { Shell } from "@/components/layout/Shell";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <Shell title="Admin" subtitle="Acesso"><div>Faça login para acessar.</div></Shell>;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return <Shell title="Admin" subtitle="Acesso"><div>Acesso negado.</div></Shell>;

  const users = await prisma.user.findMany({
    select: { id: true, handle: true, name: true, role: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return <Shell title="Admin" subtitle="Editar usuários"><UsersAdminClient users={users} /></Shell>;
}
