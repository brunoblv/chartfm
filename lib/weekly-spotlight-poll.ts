import { prisma } from "@/lib/prisma";
import {
  buildDateRangeFromDate,
  buildWeekIndexFromDate,
  buildWeekLabelFromDate,
} from "@/lib/chart-week";
import {
  mapPrismaSpotlightSong,
  SPOTLIGHT_SONG_INCLUDE,
  type ChartSpotlightSong,
} from "@/lib/chart-spotlight";
import { broadcastAdminAnnouncement } from "@/lib/admin-broadcast";
import { onWeeklyPollOpened } from "@/lib/social/events";
import { aggregatePushVotePoints } from "@/lib/push-scoring";

export const WEEKLY_POLL_PATH = "/votacao-da-semana";

export type SpotlightCategory = "destaque" | "flashback";

export type SpotlightNominator = {
  id: string;
  handle: string;
  name: string;
  image: string | null;
  avatarColor: string;
};

export type WeeklySpotlightWinner = {
  category: SpotlightCategory;
  song: ChartSpotlightSong;
  voteCount: number;
  totalPoints: number;
  nominators: SpotlightNominator[];
};

const NOMINATOR_SELECT = {
  id: true,
  handle: true,
  name: true,
  image: true,
  avatarColor: true,
} as const;

/**
 * Semana alvo da enquete: a semana ISO que termina no domingo mais recente (em BRT).
 * No cron de domingo 23:59 BRT é a própria semana que está acabando; numa reexecução
 * manual na segunda/terça continua apontando para a mesma semana encerrada.
 */
export function getWeeklyPollTargetWeek(now: Date = new Date()) {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  // Date local cujo dia/mês/ano correspondem ao relógio de parede BRT (meio-dia evita bordas de fuso)
  const wall = new Date(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), 12);
  const daysBackToSunday = wall.getDay(); // 0=domingo
  const sunday = new Date(wall);
  sunday.setDate(wall.getDate() - daysBackToSunday);
  return {
    weekIndex: buildWeekIndexFromDate(sunday),
    weekLabel: buildWeekLabelFromDate(sunday),
    dateRange: buildDateRangeFromDate(sunday),
  };
}

export type OpenWeeklyPollResult = {
  created: boolean;
  weekIndex: number;
  options: number;
  notified: number;
  reason?: string;
};

/**
 * Abre a enquete da semana (create-only): agrupa as indicações de Melhor da Semana
 * (destaque) e Flashback das paradas pessoais publicadas na semana e avisa todo mundo.
 */
export async function openWeeklySpotlightPoll(now: Date = new Date()): Promise<OpenWeeklyPollResult> {
  const week = getWeeklyPollTargetWeek(now);

  const existing = await prisma.weeklySpotlightPoll.findUnique({
    where: { weekIndex: week.weekIndex },
    select: { id: true },
  });
  if (existing) {
    return { created: false, weekIndex: week.weekIndex, options: 0, notified: 0, reason: "já existe" };
  }

  const charts = await prisma.chart.findMany({
    where: {
      weekIndex: week.weekIndex,
      isPublished: true,
      communityId: null,
      parada: { deletedAt: null, isCommunityOfficial: false },
      OR: [{ flashbackSongId: { not: null } }, { destaqueSongId: { not: null } }],
    },
    select: {
      userId: true,
      flashbackSongId: true,
      destaqueSongId: true,
    },
  });

  // categoria → songId → usuários que indicaram
  const grouped: Record<SpotlightCategory, Map<string, Set<string>>> = {
    destaque: new Map(),
    flashback: new Map(),
  };
  for (const chart of charts) {
    if (chart.destaqueSongId) {
      const set = grouped.destaque.get(chart.destaqueSongId) ?? new Set<string>();
      set.add(chart.userId);
      grouped.destaque.set(chart.destaqueSongId, set);
    }
    if (chart.flashbackSongId) {
      const set = grouped.flashback.get(chart.flashbackSongId) ?? new Set<string>();
      set.add(chart.userId);
      grouped.flashback.set(chart.flashbackSongId, set);
    }
  }

  // Música que já venceu a categoria (destaque ou flashback) uma vez não compete de novo nela.
  const priorWinners = await prisma.weeklySpotlightOption.findMany({
    where: { isWinner: true },
    select: { category: true, songId: true },
  });
  for (const winner of priorWinners) {
    const category = winner.category as SpotlightCategory;
    grouped[category].delete(winner.songId);
  }

  const totalOptions = grouped.destaque.size + grouped.flashback.size;
  if (totalOptions === 0) {
    return { created: false, weekIndex: week.weekIndex, options: 0, notified: 0, reason: "sem indicações" };
  }

  await prisma.$transaction(async (tx) => {
    const poll = await tx.weeklySpotlightPoll.create({
      data: {
        weekIndex: week.weekIndex,
        weekLabel: week.weekLabel,
        dateRange: week.dateRange,
        status: "open",
      },
    });

    for (const category of ["destaque", "flashback"] as const) {
      for (const [songId, userIds] of grouped[category]) {
        await tx.weeklySpotlightOption.create({
          data: {
            pollId: poll.id,
            category,
            songId,
            nominations: {
              create: [...userIds].map((userId) => ({ userId })),
            },
          },
        });
      }
    }
  });

  const notified = await broadcastAdminAnnouncement({
    text: `A votação da semana está aberta! Escolha a Melhor da Semana e o Flashback da Semana (${week.weekLabel}). Você pode votar em quantas quiser, as vencedoras aparecem na Parada Global de terça.`,
    targetUrl: WEEKLY_POLL_PATH,
    notifyType: "weekly_poll_open",
    feedKind: "weekly_poll_open",
  });
  onWeeklyPollOpened(week.weekIndex).catch((e) => console.error("[weekly-spotlight-poll] onWeeklyPollOpened", e));

  return { created: true, weekIndex: week.weekIndex, options: totalOptions, notified };
}

export type CloseWeeklyPollResult = {
  closed: boolean;
  weekIndex: number;
  winners: number;
  reason?: string;
};

/**
 * Fecha a enquete da semana e apura: congela voteCount/totalPoints por opção e marca
 * como vencedora(s) a(s) de maior pontuação de cada categoria (ranking com pontos
 * 20→1 por posição, mesma curva do Push — empate = todas; ninguém ranqueou = sem vencedora).
 */
export async function closeWeeklySpotlightPoll(weekIndex: number): Promise<CloseWeeklyPollResult> {
  const poll = await prisma.weeklySpotlightPoll.findUnique({
    where: { weekIndex },
    select: { id: true, status: true, options: { select: { id: true, category: true } } },
  });
  if (!poll) return { closed: false, weekIndex, winners: 0, reason: "enquete não existe" };
  if (poll.status === "closed") return { closed: false, weekIndex, winners: 0, reason: "já fechada" };

  const allVotes = await prisma.weeklySpotlightVote.findMany({
    where: { pollId: poll.id },
    select: { userId: true, optionId: true, position: true },
  });
  const countByOption = new Map<string, number>();
  for (const v of allVotes) countByOption.set(v.optionId, (countByOption.get(v.optionId) ?? 0) + 1);

  const winnerIds: string[] = [];
  const pointsByOption = new Map<string, number>();
  for (const category of ["destaque", "flashback"] as const) {
    const options = poll.options.filter((o) => o.category === category);
    const optionIds = new Set(options.map((o) => o.id));
    const categoryVotes = allVotes
      .filter((v) => optionIds.has(v.optionId))
      .map((v) => ({ userId: v.userId, submissionId: v.optionId, position: v.position }));
    const totals = aggregatePushVotePoints(categoryVotes);
    for (const [optionId, pts] of totals) pointsByOption.set(optionId, pts);

    const max = Math.max(0, ...options.map((o) => totals.get(o.id) ?? 0));
    if (max <= 0) continue;
    winnerIds.push(...options.filter((o) => (totals.get(o.id) ?? 0) === max).map((o) => o.id));
  }

  await prisma.$transaction(async (tx) => {
    for (const option of poll.options) {
      await tx.weeklySpotlightOption.update({
        where: { id: option.id },
        data: {
          voteCount: countByOption.get(option.id) ?? 0,
          totalPoints: pointsByOption.get(option.id) ?? 0,
          isWinner: winnerIds.includes(option.id),
        },
      });
    }
    await tx.weeklySpotlightPoll.update({
      where: { id: poll.id },
      data: { status: "closed", closedAt: new Date() },
    });
  });

  return { closed: true, weekIndex, winners: winnerIds.length };
}

/** Vencedoras da enquete fechada da semana — para os cards na Parada Global. */
export async function getWeeklySpotlightWinners(weekIndex: number): Promise<WeeklySpotlightWinner[]> {
  const poll = await prisma.weeklySpotlightPoll.findUnique({
    where: { weekIndex },
    select: {
      status: true,
      options: {
        where: { isWinner: true },
        include: {
          song: { include: SPOTLIGHT_SONG_INCLUDE },
          nominations: { include: { user: { select: NOMINATOR_SELECT } } },
        },
      },
    },
  });
  if (!poll || poll.status !== "closed") return [];

  return poll.options
    .map((option) => ({
      category: option.category as SpotlightCategory,
      song: mapPrismaSpotlightSong(option.song),
      voteCount: option.voteCount,
      totalPoints: option.totalPoints,
      nominators: option.nominations.map((n) => n.user),
    }))
    .sort((a, b) => (a.category === b.category ? b.totalPoints - a.totalPoints : a.category === "destaque" ? -1 : 1));
}

export type WeeklyPollOptionView = {
  id: string;
  category: SpotlightCategory;
  song: ChartSpotlightSong;
  nominators: SpotlightNominator[];
  voteCount: number;
  /** Pontuação total do ranking (soma de pontos por posição, 20→1) — null enquanto a enquete está aberta. */
  totalPoints: number | null;
  /** Posição que o usuário logado deu a essa opção no ranking já salvo, ou null se ainda não ranqueou. */
  myPosition: number | null;
  /** Foi indicada pelo próprio usuário logado (fica de fora do ranking dele). */
  excludedForMe: boolean;
  isWinner: boolean;
};

export type WeeklyPollView = {
  id: string;
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
  status: "open" | "closed";
  options: WeeklyPollOptionView[];
};

/** Enquete mais recente (aberta ou fechada) com opções, indicadores e ranking — para a página de votação. */
export async function getLatestWeeklyPollView(userId: string | null): Promise<WeeklyPollView | null> {
  const poll = await prisma.weeklySpotlightPoll.findFirst({
    orderBy: { weekIndex: "desc" },
    include: {
      options: {
        include: {
          song: { include: SPOTLIGHT_SONG_INCLUDE },
          nominations: { include: { user: { select: NOMINATOR_SELECT } } },
          _count: { select: { votes: true } },
        },
      },
    },
  });
  if (!poll) return null;

  const myVotes = userId
    ? await prisma.weeklySpotlightVote.findMany({
        where: { pollId: poll.id, userId },
        select: { optionId: true, position: true },
      })
    : [];
  const myPositionByOption = new Map(myVotes.map((v) => [v.optionId, v.position]));

  const options = poll.options
    .map((option) => ({
      id: option.id,
      category: option.category as SpotlightCategory,
      song: mapPrismaSpotlightSong(option.song),
      nominators: option.nominations.map((n) => n.user),
      voteCount: poll.status === "closed" ? option.voteCount : option._count.votes,
      totalPoints: poll.status === "closed" ? option.totalPoints : null,
      myPosition: myPositionByOption.get(option.id) ?? null,
      excludedForMe: userId ? option.nominations.some((n) => n.userId === userId) : false,
      isWinner: option.isWinner,
    }))
    .sort((a, b) =>
      poll.status === "closed"
        ? (b.totalPoints ?? 0) - (a.totalPoints ?? 0) || a.song.title.localeCompare(b.song.title)
        : a.song.title.localeCompare(b.song.title),
    );

  return {
    id: poll.id,
    weekIndex: poll.weekIndex,
    weekLabel: poll.weekLabel,
    dateRange: poll.dateRange,
    status: poll.status as "open" | "closed",
    options,
  };
}

/** Salva o ranking completo do usuário para uma categoria da enquete aberta (excluindo a própria indicação). */
export async function submitWeeklyPollRanking(
  userId: string,
  pollId: string,
  category: SpotlightCategory,
  positions: { optionId: string; position: number }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const poll = await prisma.weeklySpotlightPoll.findUnique({
    where: { id: pollId },
    select: {
      status: true,
      options: {
        where: { category },
        select: { id: true, nominations: { select: { userId: true } } },
      },
    },
  });
  if (!poll) return { ok: false, error: "Enquete não encontrada." };
  if (poll.status !== "open") return { ok: false, error: "A votação desta semana já foi encerrada." };

  const eligibleIds = new Set(
    poll.options.filter((o) => !o.nominations.some((n) => n.userId === userId)).map((o) => o.id),
  );

  const submittedIds = positions.map((p) => p.optionId);
  if (submittedIds.some((id) => !eligibleIds.has(id))) {
    return { ok: false, error: "Opção inválida para o seu ranking." };
  }

  const total = eligibleIds.size;
  const posValues = positions.map((p) => p.position);
  const expectedPositions = new Set(Array.from({ length: total }, (_, i) => i + 1));
  const valid =
    submittedIds.length === total &&
    new Set(submittedIds).size === total &&
    posValues.every((p) => expectedPositions.has(p)) &&
    new Set(posValues).size === posValues.length;
  if (!valid) {
    return { ok: false, error: "Posições inválidas — todas as músicas elegíveis devem ser ranqueadas uma vez." };
  }

  await prisma.$transaction(
    positions.map((p) =>
      prisma.weeklySpotlightVote.upsert({
        where: { optionId_userId: { optionId: p.optionId, userId } },
        create: { pollId, optionId: p.optionId, userId, position: p.position },
        update: { position: p.position },
      }),
    ),
  );

  return { ok: true };
}
