import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// Handles das 22 paradas "de estilo" criadas para votarem em massa nos jogos
// abertos da Copa (botão admin visível só para @bruno).
const AUTO_VOTE_HANDLES = [
  "cesarmaziero", "demilovatique", "dudabts", "kendikamura", "julianast", "karlacomk",
  "theandre", "joaoHT", "caiosoares", "heavydirtysoul", "jessycv", "midnightrain",
  "mayaradias", "diegox", "guisouza", "kamarcelino", "marinasemdiamonds", "lachica",
  "xalmeida", "sandman", "ingrididas7", "keku",
];

const FORCED_ARTIST_NAMES = ["Silverchair", "Bring Me the Horizon", "Foo Fighters", "Keane"];

function randomSide(): "A" | "B" {
  return Math.random() < 0.5 ? "A" : "B";
}

// POST /api/admin/copa/bruno-auto-vote — só @bruno. Faz os 22 usuários votarem
// em todos os jogos "LIVE" da Copa ativa: aleatório em geral, mas todos votam
// no lado dos artistas em FORCED_ARTIST_NAMES (se estiverem em algum jogo aberto).
export async function POST() {
  const session = await getServerSession(authOptions);
  if (session?.user?.handle !== "bruno") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const copa = await prisma.copaEdition.findFirst({
    where: { status: { not: "FINISHED" } },
    orderBy: { createdAt: "desc" },
  });
  if (!copa) {
    return NextResponse.json({ error: "Nenhuma Copa ativa encontrada" }, { status: 404 });
  }

  const fixtures = await prisma.copaFixture.findMany({
    where: { copaId: copa.id, status: "LIVE" },
    select: { id: true, artistAId: true, artistBId: true },
  });
  if (!fixtures.length) {
    return NextResponse.json({ error: "Nenhum jogo aberto (LIVE) no momento" }, { status: 400 });
  }

  const forcedArtists = await prisma.copaArtist.findMany({
    where: { copaId: copa.id, OR: FORCED_ARTIST_NAMES.map((name) => ({ artistName: { contains: name, mode: "insensitive" as const } })) },
    select: { id: true, artistName: true },
  });
  const forcedArtistIds = new Set(forcedArtists.map((a) => a.id));

  const users = await prisma.user.findMany({
    where: { handle: { in: AUTO_VOTE_HANDLES } },
    select: { id: true, handle: true },
  });
  const missingHandles = AUTO_VOTE_HANDLES.filter((h) => !users.some((u) => u.handle.toLowerCase() === h.toLowerCase()));

  const sideForFixture = new Map<string, "A" | "B">();
  for (const f of fixtures) {
    if (forcedArtistIds.has(f.artistAId)) sideForFixture.set(f.id, "A");
    else if (forcedArtistIds.has(f.artistBId)) sideForFixture.set(f.id, "B");
  }

  const votesData: Array<{ fixtureId: string; userId: string; side: "A" | "B" }> = [];
  for (const user of users) {
    for (const f of fixtures) {
      const side = sideForFixture.get(f.id) ?? randomSide();
      votesData.push({ fixtureId: f.id, userId: user.id, side });
    }
  }

  const result = await prisma.copaVote.createMany({ data: votesData, skipDuplicates: true });

  return NextResponse.json({
    ok: true,
    copaId: copa.id,
    fixturesVoted: fixtures.length,
    usersVoted: users.length,
    votesCreated: result.count,
    votesAttempted: votesData.length,
    forcedArtists: forcedArtists.map((a) => a.artistName),
    forcedFixtures: sideForFixture.size,
    missingHandles,
  });
}
