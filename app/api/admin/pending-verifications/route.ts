import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { sendVerificationEmailForUser } from "@/lib/email-verification";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Usuários que criaram conta por email/senha mas nunca confirmaram o email. */
function pendingWhere() {
  return {
    emailVerifiedAt: null,
    passwordHash: { not: null },
    email: { not: null },
  } as const;
}

export async function GET() {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    where: pendingWhere(),
    select: { id: true, email: true, name: true, handle: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json({
    total: users.length,
    users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { userId?: string; all?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;

  // Reenvio individual.
  if (body.userId) {
    const sent = await sendVerificationEmailForUser(body.userId, origin);
    return NextResponse.json({ ok: sent, sent: sent ? 1 : 0, failed: sent ? 0 : 1 });
  }

  // Reenvio em massa para todos os pendentes.
  if (body.all) {
    const users = await prisma.user.findMany({
      where: pendingWhere(),
      select: { id: true },
      take: 500,
    });

    let sent = 0;
    let failed = 0;
    for (const u of users) {
      // Serial de propósito: evita estourar o rate limit do Resend.
      const ok = await sendVerificationEmailForUser(u.id, origin);
      if (ok) sent += 1;
      else failed += 1;
    }

    return NextResponse.json({ ok: failed === 0, total: users.length, sent, failed });
  }

  return NextResponse.json({ error: "missing_target" }, { status: 400 });
}
