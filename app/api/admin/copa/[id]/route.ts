import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { GROUP_PAIRS, COPA_GROUP_LETTERS, COPA_UNASSIGNED_GROUP, drawGroups } from "@/lib/copa";
import { openNextBatch, advanceCopaDay, syncCopaToSchedule } from "@/lib/copa-day";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN" && user?.role !== "DEV") return null;
  return session.user.id;
}

// PATCH /api/admin/copa/[id] — update status or advance phase
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  const { action } = body as { action: string };

  const copa = await prisma.copaEdition.findUnique({ where: { id } });
  if (!copa) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "draw_groups") {
    // Sorteio dos grupos — só depois que todos os participantes se inscreverem
    // e cadastrarem o time completo. Garante que artistas de um mesmo dono não
    // caiam no mesmo grupo.
    if (copa.status !== "REGISTRATION") {
      return NextResponse.json({ error: "O sorteio só pode ser feito durante as inscrições" }, { status: 400 });
    }

    const participants = await prisma.copaParticipant.findMany({
      where: { copaId: id },
      include: { user: { select: { name: true } } },
    });
    if (participants.length < 2) {
      return NextResponse.json({ error: "São necessários pelo menos 2 participantes" }, { status: 400 });
    }

    const artists = await prisma.copaArtist.findMany({
      where: { copaId: id },
      select: { id: true, ownerId: true },
    });

    const incomplete = participants.filter(
      (p) => artists.filter((a) => a.ownerId === p.userId).length !== copa.artistsPerUser,
    );
    if (incomplete.length > 0) {
      return NextResponse.json(
        { error: `Aguardando todos completarem ${copa.artistsPerUser} artistas: ${incomplete.map((p) => p.user.name).join(", ")}` },
        { status: 400 },
      );
    }

    if (artists.length % 4 !== 0) {
      return NextResponse.json({ error: "O total de artistas precisa ser múltiplo de 4 para o sorteio" }, { status: 400 });
    }
    const numGroups = artists.length / 4;
    if (numGroups > COPA_GROUP_LETTERS.length) {
      return NextResponse.json({ error: "Artistas demais para o sorteio" }, { status: 400 });
    }

    const draw = drawGroups(artists, numGroups);
    if (!draw) {
      return NextResponse.json(
        { error: "Não foi possível sortear sem repetir donos no mesmo grupo. São necessários mais participantes." },
        { status: 400 },
      );
    }

    // Persist in two phases to avoid transient (copaId, groupLetter, slotInGroup)
    // unique collisions: first park everyone on unique placeholder slots, then
    // write the final group/slot.
    const park = artists.map((a, i) =>
      prisma.copaArtist.update({
        where: { id: a.id },
        data: { groupLetter: COPA_UNASSIGNED_GROUP, slotInGroup: 1000 + i },
      }),
    );
    const assign = draw.map((d) =>
      prisma.copaArtist.update({
        where: { id: d.artistId },
        data: { groupLetter: d.groupLetter, slotInGroup: d.slotInGroup },
      }),
    );
    await prisma.$transaction([...park, ...assign]);

    return NextResponse.json({ ok: true, groups: numGroups });
  }

  if (action === "start_group_stage") {
    // Create all group-stage fixtures from registered artists
    const artists = await prisma.copaArtist.findMany({
      where: { copaId: id },
      orderBy: [{ groupLetter: "asc" }, { slotInGroup: "asc" }],
    });

    if (artists.length === 0 || artists.some((a) => a.groupLetter === COPA_UNASSIGNED_GROUP)) {
      return NextResponse.json({ error: "Faça o sorteio dos grupos antes de iniciar a fase de grupos" }, { status: 400 });
    }

    const fixtureData: {
      copaId: string; phase: "GROUP"; groupLetter: string; round: number;
      matchIndex: number; artistAId: string; artistBId: string;
      singleAIdx: number; singleBIdx: number;
    }[] = [];

    let globalMatchIdx = 0;
    for (const letter of COPA_GROUP_LETTERS) {
      const group = artists.filter((a) => a.groupLetter === letter);
      if (group.length < 4) continue;
      GROUP_PAIRS.forEach(([i, j], pairIdx) => {
        const round = pairIdx < 2 ? 1 : pairIdx < 4 ? 2 : 3;
        const singleIdx = round - 1;
        fixtureData.push({
          copaId: id,
          phase: "GROUP",
          groupLetter: letter,
          round,
          matchIndex: globalMatchIdx++,
          artistAId: group[i].id,
          artistBId: group[j].id,
          singleAIdx: singleIdx,
          singleBIdx: singleIdx,
        });
      });
    }

    await prisma.$transaction([
      prisma.copaFixture.createMany({ data: fixtureData }),
      prisma.copaEdition.update({ where: { id }, data: { status: "GROUP_STAGE" } }),
    ]);

    // Com data marcada, o calendário abre os jogos no horário; sem data, abre já
    // o primeiro lote (1ª rodada, grupos A–H).
    const opened = copa.startsAt ? (await syncCopaToSchedule(id))?.opened ?? 0 : await openNextBatch(id);
    return NextResponse.json({ ok: true, created: fixtureData.length, opened });
  }

  if (action === "start_knockout") {
    await prisma.copaEdition.update({ where: { id }, data: { status: "KNOCKOUT" } });
    const opened = copa.startsAt ? (await syncCopaToSchedule(id))?.opened ?? 0 : await openNextBatch(id);
    return NextResponse.json({ ok: true, opened });
  }

  if (action === "set_start") {
    const { startsAt } = body as { startsAt?: string | null };
    const dt = startsAt ? new Date(startsAt) : null;
    if (startsAt && Number.isNaN(dt!.getTime())) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }
    await prisma.copaEdition.update({ where: { id }, data: { startsAt: dt } });
    // Se já está em andamento, reconcilia o estado dos jogos com a nova data.
    await syncCopaToSchedule(id);
    return NextResponse.json({ ok: true });
  }

  if (action === "advance_day") {
    const { closed, opened } = await advanceCopaDay(id);
    return NextResponse.json({ ok: true, closed, opened, done: opened === 0 });
  }

  if (action === "finish") {
    await prisma.copaEdition.update({ where: { id }, data: { status: "FINISHED" } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
