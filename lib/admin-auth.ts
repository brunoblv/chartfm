import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";

export async function requirePrivilegedSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });

  if (!me || !isPrivilegedRole(me.role)) return null;
  return { session, userId: me.id, role: me.role };
}
