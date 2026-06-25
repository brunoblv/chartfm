import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth-options";
import { MYTRL_OWNER_HANDLE } from "@/lib/mytrl-access";

export type MyTrlSession = {
  user: {
    id: string;
    handle: string;
    name?: string | null;
  };
};

function sessionFromToken(token: {
  prismaUserId?: string;
  handle?: string;
  name?: string | null;
} | null): MyTrlSession | null {
  if (!token?.prismaUserId || token.handle !== MYTRL_OWNER_HANDLE) return null;
  return {
    user: {
      id: token.prismaUserId,
      handle: token.handle,
      name: token.name ?? null,
    },
  };
}

/** Sessão @bruno — em Route Handlers passar `req`; em Server Components usa getServerSession. */
export async function requireMyTrlSession(req?: NextRequest): Promise<MyTrlSession | null> {
  if (req) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;
    const token = await getToken({ req, secret });
    return sessionFromToken(token);
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.handle !== MYTRL_OWNER_HANDLE) return null;

  return {
    user: {
      id: session.user.id,
      handle: session.user.handle,
      name: session.user.name ?? null,
    },
  };
}
