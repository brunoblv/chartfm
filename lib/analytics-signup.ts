import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "cfm_sid";
const SESSION_ID_RE = /^[a-z0-9-]{10,64}$/i;

// Vincula a criação de conta à sessão de tracking do visitante (cookie setado
// pelo AnalyticsTracker), permitindo medir conversão visitante → cadastro.
export async function recordSignupEvent(userId: string, path: string) {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SESSION_COOKIE)?.value ?? "";
    if (!SESSION_ID_RE.test(sessionId)) return;

    await prisma.analyticsEvent.create({
      data: { sessionId, userId, type: "signup", path },
    });
  } catch (err) {
    console.error("[analytics] recordSignupEvent", err);
  }
}
