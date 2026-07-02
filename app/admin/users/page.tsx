import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { UsersAdminClient } from "./users-admin-client";
import { Shell } from "@/components/layout/Shell";

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <Shell title="Admin" subtitle="Acesso"><div>Faça login para acessar.</div></Shell>;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return <Shell title="Admin" subtitle="Acesso"><div>Acesso negado.</div></Shell>;

  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const searchTerm = query.startsWith("@") ? query.slice(1).trim() : query;
  const pageRaw = parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const skip = (page - 1) * PAGE_SIZE;

  const where = searchTerm
    ? {
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" as const } },
          { handle: { contains: searchTerm, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: { id: true, handle: true, name: true, role: true, image: true, avatarColor: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Shell title="Admin" subtitle="Editar usuários">
      <UsersAdminClient
        users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
        page={page}
        totalPages={totalPages}
        total={total}
        query={query}
      />
    </Shell>
  );
}
