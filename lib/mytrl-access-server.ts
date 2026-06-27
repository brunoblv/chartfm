import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth-options";
import { MYTRL_OWNER_HANDLE, canUseSpotifyFeatures } from "@/lib/mytrl-access";

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
  const handle = session?.user?.handle;
  if (!session?.user?.id || handle !== MYTRL_OWNER_HANDLE) return null;

  return {
    user: {
      id: session.user.id,
      handle,
      name: session.user.name ?? null,
    },
  };
}

function sessionFromTokenSpotify(token: {
  prismaUserId?: string;
  handle?: string;
  name?: string | null;
} | null): MyTrlSession | null {
  if (!token?.prismaUserId || !canUseSpotifyFeatures(token.handle)) return null;
  return {
    user: {
      id: token.prismaUserId,
      handle: token.handle!,
      name: token.name ?? null,
    },
  };
}

/** Sessão com acesso aos recursos Spotify (importação, playlists de parada, etc.). */
export async function requireSpotifySession(req?: NextRequest): Promise<MyTrlSession | null> {
  if (req) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;
    const token = await getToken({ req, secret });
    return sessionFromTokenSpotify(token);
  }

  const session = await getServerSession(authOptions);
  const handle = session?.user?.handle;
  if (!session?.user?.id || !handle || !canUseSpotifyFeatures(handle)) return null;

  return {
    user: {
      id: session.user.id,
      handle,
      name: session.user.name ?? null,
    },
  };
}
