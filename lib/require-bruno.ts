import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/** Retorna o userId da sessão se for o @bruno (ADMIN/DEV); senão null. */
export async function requireBruno(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, handle: true },
  });
  if (user?.role !== "ADMIN" && user?.role !== "DEV") return null;
  if (user.handle?.toLowerCase() !== "bruno") return null;
  return session.user.id;
}
