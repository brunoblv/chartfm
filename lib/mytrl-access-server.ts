import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";
import { MYTRL_OWNER_HANDLE } from "@/lib/mytrl-access";

export type MyTrlSession = {
  user: {
    id: string;
    handle: string;
    name?: string | null;
  };
};

async function readMyTrlToken(req?: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  if (req) {
    return getToken({ req, secret });
  }

  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (!cookieHeader) return null;

  return getToken({
    req: { headers: { cookie: cookieHeader } } as unknown as NextRequest,
    secret,
  });
}

/** Sessão @bruno via JWT — preferir passar `req` em Route Handlers. */
export async function requireMyTrlSession(req?: NextRequest): Promise<MyTrlSession | null> {
  const token = await readMyTrlToken(req);
  if (!token?.prismaUserId || token.handle !== MYTRL_OWNER_HANDLE) {
    return null;
  }

  return {
    user: {
      id: token.prismaUserId as string,
      handle: token.handle as string,
      name: (token.name as string) ?? null,
    },
  };
}
