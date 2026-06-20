import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export const MYTRL_OWNER_HANDLE = "bruno";

/** Parada diária @bruno — top 10 new hits (MyTRL → UMS Request Live). */
export const UMS_REQUEST_LIVE_PARADA_ID = "cmc06e6c262cf93ad97616c3c";

/** Parada semanal @bruno alimentada pelo MyTRL (sexta 8:05 BRT, após as 5 diárias). */
export const MYTRL_WEEKLY_PARADA_ID = "cmpn5qqi20001mly9beqx3xkt";

/** Publicação diária às 8h BRT (= 11:00 UTC). */
export const MYTRL_DAILY_PUBLISH_UTC_HOUR = 11;

/** Publicação semanal às 8:05 BRT (= 11:05 UTC), após a diária de sexta. */
export const MYTRL_WEEKLY_PUBLISH_UTC_HOUR = 11;
export const MYTRL_WEEKLY_PUBLISH_UTC_MINUTE = 5;

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
