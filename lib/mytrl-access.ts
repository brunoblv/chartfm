import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export const MYTRL_OWNER_HANDLE = "bruno";

/** Parada semanal @bruno alimentada pelo MyTRL (sexta 7h BRT). */
export const MYTRL_WEEKLY_PARADA_ID = "cmpn5qqi20001mly9beqx3xkt";

export async function requireMyTrlSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.handle || session.user.handle !== MYTRL_OWNER_HANDLE) {
    return null;
  }
  return session;
}

export function isMyTrlOwner(handle: string | null | undefined): boolean {
  return handle === MYTRL_OWNER_HANDLE;
}

export function authorizeMyTrlCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
