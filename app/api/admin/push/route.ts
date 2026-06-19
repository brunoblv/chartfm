import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const rounds = await prisma.pushRound.findMany({
    orderBy: { number: "desc" },
    include: { submissions: { select: { id: true } } },
  });

  return NextResponse.json(rounds.map((r) => ({ ...r, submissionCount: r.submissions.length })));
}

export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = (await req.json()) as {
    title?: string;
    season?: number;
    submissionEndsAt?: string;
    listeningEndsAt?: string;
    rankingEndsAt?: string;
  };

  if (!body.submissionEndsAt || !body.listeningEndsAt || !body.rankingEndsAt) {
    return NextResponse.json({ error: "Datas obrigatórias" }, { status: 400 });
  }

  const last = await prisma.pushRound.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const number = (last?.number ?? 0) + 1;

  const round = await prisma.pushRound.create({
    data: {
      number,
      title: body.title ?? null,
      season: body.season ?? 1,
      submissionEndsAt: new Date(body.submissionEndsAt),
      listeningEndsAt: new Date(body.listeningEndsAt),
      rankingEndsAt: new Date(body.rankingEndsAt),
    },
  });

  return NextResponse.json(round, { status: 201 });
}
