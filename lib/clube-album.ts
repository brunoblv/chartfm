import { AlbumClubPhase, type Prisma } from "@prisma/client";
import { announceClubePhaseChange, announceClubeRegistrationOpen } from "@/lib/game-announcements";
import { prisma } from "@/lib/prisma";
import { buildScheduleFromDate, parseDateInput, parseDateTimeLocal, buildDateRangeLabel } from "@/lib/clube-schedule";
import { MIN_POLL_VOTES } from "@/lib/clube-album-shared";

export type UiPhase = "0" | "1" | "2" | "3" | "4";

export type ClubeAlbumInfo = {
  albumId: number;
  title: string;
  artist: string;
  year: string;
  coverUrl: string | null;
  spotifyUrl: string | null;
};

export type ClubeNomination = ClubeAlbumInfo & {
  id: string;
  /** null = oculto até a revelação (quarta 20h) */
  nominatedBy: string | null;
};

export type ClubeWinner = ClubeAlbumInfo & {
  nominationId: string;
  votes: number;
  rank: number;
  /** null = oculto até quarta 20h */
  nominatedBy: string | null;
  /** Nota CriticsFM; null se ainda não revelado ou sem reviews */
  score: number | null;
  reviewCount: number;
};

export type ClubeRoundData = {
  id: string;
  number: number;
  theme: string;
  dateRange: string;
  phase: UiPhase;
  nominationsOpenAt: string;
  nominationsDeadline: string;
  pollDeadline: string;
  listeningDeadline: string | null;
  nextRoundCountdown: string | null;
  nextRoundStartsAt: string | null;
  nominations: ClubeNomination[];
  winners: ClubeWinner[];
  participantCount: number;
  myNominations: ClubeNomination[] | null;
  myVoteNominationIds: string[] | null;
  isLoggedIn: boolean;
  /** true após quarta 20h (fim da escuta) */
  identitiesRevealed: boolean;
  revealsAt: string | null;
  /** Rodada já encerrou no banco, mas ainda visível com resultados finais */
  roundComplete: boolean;
  /** IDs de todos os álbuns já indicados em qualquer rodada (atual + anteriores) */
  allNominatedAlbumIds: number[];
};

export type ClubeHistoryRound = {
  rodada: number;
  theme: string;
  dateRange: string;
  participants: number;
  winners: {
    title: string;
    artist: string;
    year: string;
    coverUrl: string | null;
    nominatedBy: string | null;
    score: number | null;
    reviewCount: number;
    votes: number;
  }[];
};

export type ClubeAdminRound = {
  id: string;
  number: number;
  theme: string;
  dateRange: string;
  phase: AlbumClubPhase;
  nominationsOpenAt: string;
  nominationsCloseAt: string;
  pollCloseAt: string;
  resultCloseAt: string | null;
  listeningCloseAt: string | null;
  nominationCount: number;
  voteCount: number;
};

export type ClubeAdminPollEntry = {
  nominationId: string;
  title: string;
  artist: string;
  year: string;
  coverUrl: string | null;
  nominatedBy: string;
  votes: number;
  rank: number;
};

export type ClubeAdminPollPreview = {
  voterCount: number;
  totalVotes: number;
  entries: ClubeAdminPollEntry[];
  voters: ClubeAdminPollVoter[];
};

export type ClubeAdminPollSelection = {
  nominationId: string;
  title: string;
  artist: string;
};

export type ClubeAdminPollVoter = {
  userId: string;
  handle: string;
  selections: ClubeAdminPollSelection[];
  votedAt: string;
};

export type ClubeRoundSchedulePatch = {
  nominationsOpenAt?: string;
  nominationsCloseAt?: string;
  pollCloseAt?: string;
  resultCloseAt?: string;
  listeningCloseAt?: string;
};

export type UpdateClubeRoundInput = {
  theme?: string;
  /** Recalcula todas as datas a partir de uma quarta-feira */
  wednesdayDate?: string;
  applyWednesdayTemplate?: boolean;
  schedule?: ClubeRoundSchedulePatch;
  /** Força a fase; omitir ou "AUTO" para derivar das datas após salvar */
  phase?: AlbumClubPhase | "AUTO";
};

const nominationInclude = {
  user: { select: { handle: true } },
  album: {
    select: {
      id: true,
      title: true,
      exhibitionName: true,
      coverUrl: true,
      spotifyUrl: true,
      releaseDate: true,
      artist: { select: { name: true, exhibitionName: true } },
    },
  },
} satisfies Prisma.AlbumClubNominationInclude;

const winnerInclude = {
  nomination: {
    include: nominationInclude,
  },
} satisfies Prisma.AlbumClubWinnerInclude;

function formatDeadline(date: Date): string {
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const d = date.getDate();
  const m = months[date.getMonth()];
  const h = date.getHours();
  const min = date.getMinutes();
  return `${d} ${m}, ${String(h).padStart(2, "0")}h${String(min).padStart(2, "0")}`;
}

function mapAlbumInfo(
  album: {
    id: number;
    title: string;
    exhibitionName: string | null;
    coverUrl: string | null;
    spotifyUrl: string | null;
    releaseDate: Date | null;
    artist: { name: string; exhibitionName: string | null };
  },
): ClubeAlbumInfo {
  return {
    albumId: album.id,
    title: album.exhibitionName || album.title,
    artist: album.artist.exhibitionName || album.artist.name,
    year: album.releaseDate ? String(album.releaseDate.getFullYear()) : "—",
    coverUrl: album.coverUrl,
    spotifyUrl: album.spotifyUrl,
  };
}

function mapNomination(
  n: Prisma.AlbumClubNominationGetPayload<{ include: typeof nominationInclude }>,
): ClubeNomination & { _handle: string } {
  const album = mapAlbumInfo(n.album);
  return {
    id: n.id,
    nominatedBy: n.user.handle,
    _handle: n.user.handle,
    ...album,
  };
}

export function isIdentitiesRevealed(
  round: { listeningCloseAt: Date | null },
  now = new Date(),
): boolean {
  return !!round.listeningCloseAt && now >= round.listeningCloseAt;
}

function maskNomination(
  n: ClubeNomination & { _handle: string },
  viewerHandle: string | null,
  revealed: boolean,
): ClubeNomination {
  const show =
    revealed || (viewerHandle !== null && n._handle === viewerHandle);
  const { _handle: _, ...rest } = n;
  return {
    ...rest,
    nominatedBy: show ? n._handle : null,
  };
}

function sortNominationsAlphabetically(nominations: ClubeNomination[]): ClubeNomination[] {
  return [...nominations].sort((a, b) => {
    const byArtist = a.artist.localeCompare(b.artist, "pt-BR", { sensitivity: "base" });
    if (byArtist !== 0) return byArtist;
    return a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" });
  });
}

async function fetchAlbumScores(albumIds: number[]): Promise<Map<number, { score: number; count: number }>> {
  if (albumIds.length === 0) return new Map();
  const groups = await prisma.albumReview.groupBy({
    by: ["albumId"],
    where: { albumId: { in: albumIds } },
    _avg: { rating: true },
    _count: { id: true },
  });
  return new Map(
    groups.map((g) => [g.albumId, { score: Math.round(g._avg.rating ?? 0), count: g._count.id }]),
  );
}

function dbPhaseToUi(phase: AlbumClubPhase, now: Date, round: { nominationsOpenAt: Date }): UiPhase {
  if (phase === AlbumClubPhase.NOMINATIONS && now < round.nominationsOpenAt) return "0";
  switch (phase) {
    case AlbumClubPhase.NOMINATIONS:
      return "1";
    case AlbumClubPhase.POLL:
      return "2";
    case AlbumClubPhase.RESULT:
      return "3";
    case AlbumClubPhase.LISTENING:
      return "4";
    default:
      return "4";
  }
}

async function computeWinners(roundId: string): Promise<void> {
  const voteCounts = await prisma.albumClubPollVote.groupBy({
    by: ["nominationId"],
    where: { roundId },
    _count: { id: true },
  });

  const top = [...voteCounts].sort((a, b) => b._count.id - a._count.id).slice(0, 2);
  if (top.length === 0) return;

  await prisma.$transaction([
    prisma.albumClubWinner.deleteMany({ where: { roundId } }),
    ...top.map((t, i) =>
      prisma.albumClubWinner.create({
        data: {
          roundId,
          nominationId: t.nominationId,
          rank: i + 1,
          voteCount: t._count.id,
        },
      }),
    ),
  ]);
}

export async function syncRoundPhase(roundId: string): Promise<AlbumClubPhase> {
  const round = await prisma.albumClubRound.findUnique({ where: { id: roundId } });
  if (!round || round.phase === AlbumClubPhase.COMPLETED) return round?.phase ?? AlbumClubPhase.COMPLETED;

  const now = new Date();
  let nextPhase: AlbumClubPhase = round.phase;

  if (round.phase === AlbumClubPhase.NOMINATIONS && now >= round.nominationsOpenAt) {
    await announceClubeRegistrationOpen(round);
  }

  if (round.phase === AlbumClubPhase.NOMINATIONS && now >= round.nominationsCloseAt) {
    nextPhase = AlbumClubPhase.POLL;
  }

  if (
    (nextPhase === AlbumClubPhase.POLL || round.phase === AlbumClubPhase.POLL) &&
    now >= round.pollCloseAt
  ) {
    await computeWinners(roundId);
    nextPhase = AlbumClubPhase.RESULT;
  }

  if (
    (nextPhase === AlbumClubPhase.RESULT || round.phase === AlbumClubPhase.RESULT) &&
    now >= (round.resultCloseAt ?? round.pollCloseAt)
  ) {
    nextPhase = AlbumClubPhase.LISTENING;
  }

  if (
    (nextPhase === AlbumClubPhase.LISTENING || round.phase === AlbumClubPhase.LISTENING) &&
    round.listeningCloseAt &&
    now >= round.listeningCloseAt
  ) {
    nextPhase = AlbumClubPhase.COMPLETED;
  }

  if (nextPhase !== round.phase) {
    await prisma.albumClubRound.update({
      where: { id: roundId },
      data: { phase: nextPhase },
    });
    await announceClubePhaseChange(round, nextPhase);
  }

  return nextPhase;
}

/** Reconcilia fases de todas as rodadas ativas com o calendário (cron). */
export async function syncActiveClubeRounds(): Promise<
  { roundId: string; number: number; theme: string; previousPhase: AlbumClubPhase; phase: AlbumClubPhase }[]
> {
  const active = await prisma.albumClubRound.findMany({
    where: { phase: { not: AlbumClubPhase.COMPLETED } },
    select: { id: true, number: true, theme: true, phase: true },
  });

  const results: {
    roundId: string;
    number: number;
    theme: string;
    previousPhase: AlbumClubPhase;
    phase: AlbumClubPhase;
  }[] = [];

  for (const r of active) {
    const previousPhase = r.phase;
    const phase = await syncRoundPhase(r.id);
    if (phase !== previousPhase) {
      results.push({ roundId: r.id, number: r.number, theme: r.theme, previousPhase, phase });
    }
  }

  return results;
}

async function getNextRoundStart(activeRoundId: string): Promise<Date | null> {
  const upcoming = await prisma.albumClubRound.findFirst({
    where: {
      id: { not: activeRoundId },
      phase: AlbumClubPhase.NOMINATIONS,
      nominationsOpenAt: { gt: new Date() },
    },
    orderBy: { nominationsOpenAt: "asc" },
    select: { nominationsOpenAt: true },
  });
  if (upcoming) return upcoming.nominationsOpenAt;

  const active = await prisma.albumClubRound.findUnique({
    where: { id: activeRoundId },
    select: { listeningCloseAt: true },
  });
  return active?.listeningCloseAt ?? null;
}

async function findDisplayRound(): Promise<{ id: string; roundComplete: boolean } | null> {
  const inProgress = await prisma.albumClubRound.findFirst({
    where: { phase: { not: AlbumClubPhase.COMPLETED } },
    orderBy: { number: "desc" },
  });
  if (inProgress) return { id: inProgress.id, roundComplete: false };

  const latest = await prisma.albumClubRound.findFirst({
    where: { phase: AlbumClubPhase.COMPLETED },
    orderBy: { number: "desc" },
  });
  if (!latest?.listeningCloseAt) return null;

  const now = new Date();
  const nextCycleOpen = new Date(latest.nominationsOpenAt);
  nextCycleOpen.setDate(nextCycleOpen.getDate() + 7);

  const upcoming = await prisma.albumClubRound.findFirst({
    where: {
      number: { gt: latest.number },
      phase: { not: AlbumClubPhase.COMPLETED },
    },
    orderBy: { number: "asc" },
  });

  if (upcoming && now >= upcoming.nominationsOpenAt) return null;
  if (!upcoming && now >= nextCycleOpen) return null;

  return { id: latest.id, roundComplete: true };
}

async function loadRoundPayload(
  roundId: string,
  userId: string | null,
  opts: { roundComplete?: boolean } = {},
): Promise<ClubeRoundData | null> {
  const roundComplete = opts.roundComplete ?? false;
  const phase = roundComplete ? AlbumClubPhase.COMPLETED : await syncRoundPhase(roundId);
  const now = new Date();

  const round = await prisma.albumClubRound.findUnique({
    where: { id: roundId },
    include: {
      nominations: { include: nominationInclude, orderBy: { createdAt: "asc" } },
      winners: { include: winnerInclude, orderBy: { rank: "asc" } },
    },
  });

  if (!round) return null;
  if (phase === AlbumClubPhase.COMPLETED && !roundComplete) return null;

  const viewer = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { handle: true } })
    : null;
  const viewerHandle = viewer?.handle ?? null;

  const revealed = isIdentitiesRevealed(round, now);

  const participantRows = await prisma.albumClubNomination.groupBy({
    by: ["userId"],
    where: { roundId },
  });

  let myNominations: ClubeNomination[] | null = null;
  let myVoteNominationIds: string[] | null = null;

  if (userId) {
    myNominations = round.nominations
      .filter((n) => n.userId === userId)
      .map(mapNomination)
      .map((n) => maskNomination(n, viewerHandle, true));
    const myVotes = await prisma.albumClubPollVote.findMany({
      where: { roundId, userId },
      select: { nominationId: true },
    });
    myVoteNominationIds = myVotes.map((v) => v.nominationId);
  }

  const winnerAlbumIds = round.winners.map((w) => w.nomination.album.id);
  const scoreMap = revealed ? await fetchAlbumScores(winnerAlbumIds) : new Map();

  const winners: ClubeWinner[] = round.winners.map((w) => {
    const album = mapAlbumInfo(w.nomination.album);
    const stats = scoreMap.get(w.nomination.album.id);
    const nominator = w.nomination.user.handle;
    return {
      nominationId: w.nominationId,
      votes: w.voteCount,
      rank: w.rank,
      ...album,
      nominatedBy: revealed ? nominator : null,
      score: revealed && stats && stats.count > 0 ? stats.score : null,
      reviewCount: revealed ? (stats?.count ?? 0) : 0,
    };
  });

  const uiPhase = roundComplete ? "4" : dbPhaseToUi(phase, now, round);

  let nextStart: Date | null = null;
  if (uiPhase === "0") {
    nextStart = round.nominationsOpenAt;
  } else if (uiPhase === "4") {
    nextStart = new Date(round.nominationsOpenAt);
    nextStart.setDate(nextStart.getDate() + 7);
  } else {
    nextStart = await getNextRoundStart(roundId);
  }

  const nominations = sortNominationsAlphabetically(
    round.nominations
      .map(mapNomination)
      .map((n) => maskNomination(n, viewerHandle, revealed)),
  );

  const prevNominationRows = await prisma.albumClubNomination.findMany({
    where: { roundId: { not: roundId } },
    select: { albumId: true },
    distinct: ["albumId"],
  });
  const allNominatedAlbumIds = [
    ...new Set([
      ...round.nominations.map((n) => n.album.id),
      ...prevNominationRows.map((n) => n.albumId),
    ]),
  ];

  return {
    id: round.id,
    number: round.number,
    theme: round.theme,
    dateRange: round.dateRange,
    phase: uiPhase,
    nominationsOpenAt: formatDeadline(round.nominationsOpenAt),
    nominationsDeadline: formatDeadline(round.nominationsCloseAt),
    pollDeadline: formatDeadline(round.pollCloseAt),
    listeningDeadline: round.listeningCloseAt ? formatDeadline(round.listeningCloseAt) : null,
    nextRoundStartsAt: nextStart?.toISOString() ?? round.listeningCloseAt?.toISOString() ?? null,
    nextRoundCountdown: nextStart ? formatDeadline(nextStart) : round.listeningCloseAt ? formatDeadline(round.listeningCloseAt) : null,
    nominations,
    winners,
    participantCount: participantRows.length,
    myNominations,
    myVoteNominationIds,
    isLoggedIn: !!userId,
    identitiesRevealed: revealed,
    revealsAt: round.listeningCloseAt ? formatDeadline(round.listeningCloseAt) : null,
    roundComplete,
    allNominatedAlbumIds,
  };
}

export async function getActiveClubeRound(userId: string | null): Promise<ClubeRoundData | null> {
  const display = await findDisplayRound();
  if (!display) return null;
  return loadRoundPayload(display.id, userId, { roundComplete: display.roundComplete });
}

export async function getClubeHistorico(): Promise<ClubeHistoryRound[]> {
  const rounds = await prisma.albumClubRound.findMany({
    where: { phase: AlbumClubPhase.COMPLETED },
    orderBy: { number: "desc" },
    include: {
      winners: { include: winnerInclude, orderBy: { rank: "asc" } },
      nominations: { select: { userId: true } },
    },
  });

  const allAlbumIds = rounds.flatMap((r) => r.winners.map((w) => w.nomination.album.id));
  const scoreMap = await fetchAlbumScores(allAlbumIds);

  return rounds.map((r) => ({
    rodada: r.number,
    theme: r.theme,
    dateRange: r.dateRange,
    participants: new Set(r.nominations.map((n) => n.userId)).size,
    winners: r.winners.map((w) => {
      const album = mapAlbumInfo(w.nomination.album);
      const stats = scoreMap.get(w.nomination.album.id);
      return {
        title: album.title,
        artist: album.artist,
        year: album.year,
        coverUrl: album.coverUrl,
        nominatedBy: w.nomination.user.handle,
        score: stats && stats.count > 0 ? stats.score : null,
        reviewCount: stats?.count ?? 0,
        votes: w.voteCount,
      };
    }),
  }));
}

export async function getClubeHistoricoStats() {
  const rounds = await prisma.albumClubRound.findMany({
    where: { phase: AlbumClubPhase.COMPLETED },
    include: { nominations: { select: { userId: true } } },
  });

  const allParticipants = new Set<string>();
  for (const r of rounds) {
    for (const n of r.nominations) allParticipants.add(n.userId);
  }

  return {
    totalRounds: rounds.length,
    totalAlbums: rounds.length * 2,
    totalParticipants: allParticipants.size,
  };
}

export async function getClubeAdminPollPreview(roundId: string): Promise<ClubeAdminPollPreview | null> {
  const round = await prisma.albumClubRound.findUnique({
    where: { id: roundId },
    include: {
      nominations: { include: nominationInclude },
    },
  });
  if (!round) return null;

  const [voteCounts, pollVotes] = await Promise.all([
    prisma.albumClubPollVote.groupBy({
      by: ["nominationId"],
      where: { roundId },
      _count: { id: true },
    }),
    prisma.albumClubPollVote.findMany({
      where: { roundId },
      include: {
        user: { select: { handle: true } },
        nomination: { include: nominationInclude },
      },
      orderBy: [{ userId: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const voteMap = new Map(voteCounts.map((v) => [v.nominationId, v._count.id]));

  const voterMap = new Map<string, ClubeAdminPollVoter>();
  for (const vote of pollVotes) {
    const mapped = mapNomination(vote.nomination);
    const existing = voterMap.get(vote.userId);
    const selection: ClubeAdminPollSelection = {
      nominationId: vote.nominationId,
      title: mapped.title,
      artist: mapped.artist,
    };
    if (existing) {
      existing.selections.push(selection);
    } else {
      voterMap.set(vote.userId, {
        userId: vote.userId,
        handle: vote.user.handle,
        selections: [selection],
        votedAt: vote.createdAt.toISOString(),
      });
    }
  }

  const voters = [...voterMap.values()].sort((a, b) =>
    a.handle.localeCompare(b.handle, "pt-BR", { sensitivity: "base" }),
  );

  const entries = round.nominations
    .map((n) => {
      const mapped = mapNomination(n);
      return {
        nominationId: n.id,
        title: mapped.title,
        artist: mapped.artist,
        year: mapped.year,
        coverUrl: mapped.coverUrl,
        nominatedBy: mapped._handle,
        votes: voteMap.get(n.id) ?? 0,
        rank: 0,
      };
    })
    .sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      const byArtist = a.artist.localeCompare(b.artist, "pt-BR", { sensitivity: "base" });
      if (byArtist !== 0) return byArtist;
      return a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" });
    });

  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return {
    voterCount: voters.length,
    totalVotes: voteCounts.reduce((sum, v) => sum + v._count.id, 0),
    entries,
    voters,
  };
}

export async function getClubeAdminData(): Promise<{
  active: ClubeAdminRound | null;
  pollPreview: ClubeAdminPollPreview | null;
  upcoming: ClubeAdminRound[];
  completed: ClubeAdminRound[];
}> {
  const rounds = await prisma.albumClubRound.findMany({
    orderBy: { number: "desc" },
    include: {
      _count: { select: { nominations: true, pollVotes: true } },
    },
  });

  const mapRound = (r: (typeof rounds)[number]): ClubeAdminRound => ({
    id: r.id,
    number: r.number,
    theme: r.theme,
    dateRange: r.dateRange,
    phase: r.phase,
    nominationsOpenAt: r.nominationsOpenAt.toISOString(),
    nominationsCloseAt: r.nominationsCloseAt.toISOString(),
    pollCloseAt: r.pollCloseAt.toISOString(),
    resultCloseAt: r.resultCloseAt?.toISOString() ?? null,
    listeningCloseAt: r.listeningCloseAt?.toISOString() ?? null,
    nominationCount: r._count.nominations,
    voteCount: r._count.pollVotes,
  });

  const active = rounds.find((r) => r.phase !== AlbumClubPhase.COMPLETED) ?? null;
  const completed = rounds.filter((r) => r.phase === AlbumClubPhase.COMPLETED).map(mapRound);
  const upcoming: ClubeAdminRound[] = [];

  const pollPreview =
    active && active._count.nominations > 0 ? await getClubeAdminPollPreview(active.id) : null;

  return {
    active: active ? mapRound(active) : null,
    pollPreview,
    upcoming,
    completed,
  };
}

function validateRoundSchedule(dates: {
  nominationsOpenAt: Date;
  nominationsCloseAt: Date;
  pollCloseAt: Date;
  resultCloseAt: Date;
  listeningCloseAt: Date;
}): string | null {
  if (dates.nominationsOpenAt >= dates.nominationsCloseAt) {
    return "Inscrições: abertura deve ser antes do fechamento";
  }
  if (dates.nominationsCloseAt > dates.pollCloseAt) {
    return "A enquete deve fechar após o fim das inscrições";
  }
  if (dates.pollCloseAt > dates.resultCloseAt) {
    return "O resultado deve ser após o fechamento da enquete";
  }
  if (dates.resultCloseAt > dates.listeningCloseAt) {
    return "A escuta deve encerrar após o resultado";
  }
  return null;
}

function parseSchedulePatch(
  patch: ClubeRoundSchedulePatch,
  current: {
    nominationsOpenAt: Date;
    nominationsCloseAt: Date;
    pollCloseAt: Date;
    resultCloseAt: Date | null;
    listeningCloseAt: Date | null;
  },
): { ok: true; dates: typeof current & { resultCloseAt: Date; listeningCloseAt: Date } } | { ok: false; error: string } {
  const parse = (key: keyof ClubeRoundSchedulePatch, fallback: Date) => {
    const raw = patch[key];
    if (raw === undefined) return fallback;
    const d = parseDateTimeLocal(raw);
    if (!d) return null;
    return d;
  };

  const nominationsOpenAt = parse("nominationsOpenAt", current.nominationsOpenAt);
  const nominationsCloseAt = parse("nominationsCloseAt", current.nominationsCloseAt);
  const pollCloseAt = parse("pollCloseAt", current.pollCloseAt);
  const resultCloseAt = parse("resultCloseAt", current.resultCloseAt ?? current.pollCloseAt);
  const listeningCloseAt = parse("listeningCloseAt", current.listeningCloseAt ?? current.pollCloseAt);

  if (!nominationsOpenAt || !nominationsCloseAt || !pollCloseAt || !resultCloseAt || !listeningCloseAt) {
    return { ok: false, error: "Data/hora inválida" };
  }

  const err = validateRoundSchedule({
    nominationsOpenAt,
    nominationsCloseAt,
    pollCloseAt,
    resultCloseAt,
    listeningCloseAt,
  });
  if (err) return { ok: false, error: err };

  return {
    ok: true,
    dates: { nominationsOpenAt, nominationsCloseAt, pollCloseAt, resultCloseAt, listeningCloseAt },
  };
}

export async function createClubeRound(
  theme: string,
  opts: { wednesdayDate?: string; schedule?: ClubeRoundSchedulePatch } = {},
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const trimmed = theme.trim();
  if (!trimmed) return { ok: false, error: "Informe o tema da semana" };

  const active = await prisma.albumClubRound.findFirst({
    where: { phase: { not: AlbumClubPhase.COMPLETED } },
  });
  if (active) return { ok: false, error: "Já existe uma rodada ativa. Aguarde ela terminar ou encerre manualmente." };

  let nominationsOpenAt: Date;
  let nominationsCloseAt: Date;
  let pollCloseAt: Date;
  let resultCloseAt: Date;
  let listeningCloseAt: Date;
  let dateRange: string;

  if (opts.schedule) {
    const now = new Date();
    const base = {
      nominationsOpenAt: now,
      nominationsCloseAt: now,
      pollCloseAt: now,
      resultCloseAt: now,
      listeningCloseAt: now,
    };
    const parsed = parseSchedulePatch(opts.schedule, base);
    if (!parsed.ok) return parsed;
    ({ nominationsOpenAt, nominationsCloseAt, pollCloseAt, resultCloseAt, listeningCloseAt } = parsed.dates);
    dateRange = buildDateRangeLabel(nominationsOpenAt, listeningCloseAt);
  } else {
    const wednesdayDate = opts.wednesdayDate ?? "";
    const wednesday = parseDateInput(wednesdayDate);
    if (!wednesday) return { ok: false, error: "Data inválida" };

    const schedule = buildScheduleFromDate(wednesday);
    nominationsOpenAt = schedule.nominationsOpenAt;
    nominationsCloseAt = schedule.nominationsCloseAt;
    pollCloseAt = schedule.pollCloseAt;
    resultCloseAt = schedule.resultCloseAt;
    listeningCloseAt = schedule.listeningCloseAt;
    dateRange = schedule.dateRange;
  }
  const last = await prisma.albumClubRound.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const number = (last?.number ?? 0) + 1;

  const now = new Date();
  let initialPhase: AlbumClubPhase = AlbumClubPhase.NOMINATIONS;
  if (now >= listeningCloseAt) initialPhase = AlbumClubPhase.COMPLETED;
  else if (now >= pollCloseAt) initialPhase = AlbumClubPhase.LISTENING;
  else if (now >= nominationsCloseAt) initialPhase = AlbumClubPhase.POLL;
  else if (now >= nominationsOpenAt) initialPhase = AlbumClubPhase.NOMINATIONS;

  const round = await prisma.albumClubRound.create({
    data: {
      number,
      theme: trimmed,
      dateRange,
      phase: initialPhase,
      nominationsOpenAt,
      nominationsCloseAt,
      pollCloseAt,
      resultCloseAt,
      listeningCloseAt,
    },
    select: { id: true, number: true, theme: true, nominationsOpenAt: true, phase: true },
  });

  if (initialPhase !== AlbumClubPhase.COMPLETED) {
    await syncRoundPhase(round.id);
  } else if (now >= pollCloseAt) {
    await computeWinners(round.id);
  }

  return { ok: true, id: round.id };
}

export async function updateClubeRound(
  roundId: string,
  data: UpdateClubeRoundInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const round = await prisma.albumClubRound.findUnique({ where: { id: roundId } });
  if (!round) return { ok: false, error: "Rodada não encontrada" };
  if (round.phase === AlbumClubPhase.COMPLETED) return { ok: false, error: "Rodada já concluída" };

  const update: Prisma.AlbumClubRoundUpdateInput = {};

  if (data.theme !== undefined) {
    const trimmed = data.theme.trim();
    if (!trimmed) return { ok: false, error: "Tema inválido" };
    update.theme = trimmed;
  }

  if (data.applyWednesdayTemplate && data.wednesdayDate) {
    const wednesday = parseDateInput(data.wednesdayDate);
    if (!wednesday) return { ok: false, error: "Data inválida" };

    const schedule = buildScheduleFromDate(wednesday);
    update.dateRange = schedule.dateRange;
    update.nominationsOpenAt = schedule.nominationsOpenAt;
    update.nominationsCloseAt = schedule.nominationsCloseAt;
    update.pollCloseAt = schedule.pollCloseAt;
    update.resultCloseAt = schedule.resultCloseAt;
    update.listeningCloseAt = schedule.listeningCloseAt;
  } else if (data.schedule && Object.keys(data.schedule).length > 0) {
    const parsed = parseSchedulePatch(data.schedule, {
      nominationsOpenAt: round.nominationsOpenAt,
      nominationsCloseAt: round.nominationsCloseAt,
      pollCloseAt: round.pollCloseAt,
      resultCloseAt: round.resultCloseAt,
      listeningCloseAt: round.listeningCloseAt,
    });
    if (!parsed.ok) return parsed;

    const { dates } = parsed;
    update.nominationsOpenAt = dates.nominationsOpenAt;
    update.nominationsCloseAt = dates.nominationsCloseAt;
    update.pollCloseAt = dates.pollCloseAt;
    update.resultCloseAt = dates.resultCloseAt;
    update.listeningCloseAt = dates.listeningCloseAt;
    update.dateRange = buildDateRangeLabel(dates.nominationsOpenAt, dates.listeningCloseAt);
  }

  if (data.phase && data.phase !== "AUTO") {
    update.phase = data.phase;
  }

  if (Object.keys(update).length === 0) return { ok: false, error: "Nada para atualizar" };

  const previousPhase = round.phase;
  await prisma.albumClubRound.update({ where: { id: roundId }, data: update });

  if (data.phase && data.phase !== "AUTO" && data.phase !== previousPhase) {
    await announceClubePhaseChange(
      { id: roundId, number: round.number, theme: (update.theme as string | undefined) ?? round.theme },
      data.phase,
    );
  } else if (!data.phase || data.phase === "AUTO") {
    await syncRoundPhase(roundId);
  }

  return { ok: true };
}

export async function openClubePollNow(
  roundId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const round = await prisma.albumClubRound.findUnique({ where: { id: roundId } });
  if (!round) return { ok: false, error: "Rodada não encontrada" };
  if (round.phase === AlbumClubPhase.COMPLETED) return { ok: false, error: "Rodada já concluída" };

  const now = new Date();
  let pollCloseAt = round.pollCloseAt;
  if (pollCloseAt <= now) {
    pollCloseAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  await prisma.albumClubRound.update({
    where: { id: roundId },
    data: {
      nominationsCloseAt: now,
      pollCloseAt,
      resultCloseAt: round.resultCloseAt && round.resultCloseAt > pollCloseAt ? round.resultCloseAt : pollCloseAt,
      phase: AlbumClubPhase.POLL,
      dateRange: buildDateRangeLabel(round.nominationsOpenAt, round.listeningCloseAt ?? pollCloseAt),
    },
  });

  await announceClubePhaseChange(round, AlbumClubPhase.POLL);

  return { ok: true };
}

export async function completeClubeRound(roundId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const round = await prisma.albumClubRound.findUnique({ where: { id: roundId } });
  if (!round) return { ok: false, error: "Rodada não encontrada" };
  if (round.phase === AlbumClubPhase.COMPLETED) return { ok: false, error: "Rodada já concluída" };

  await prisma.albumClubRound.update({
    where: { id: roundId },
    data: { phase: AlbumClubPhase.COMPLETED },
  });
  await announceClubePhaseChange(round, AlbumClubPhase.COMPLETED);
  return { ok: true };
}

// MIN_POLL_VOTES vive em clube-album-shared.ts: componentes client importam de lá
// sem puxar este módulo (que arrasta system-feed → telegram → playwright).
export { MIN_POLL_VOTES };
export const MAX_NOMINATIONS = 2;

export async function submitClubeNominations(
  userId: string,
  roundId: string,
  albumIds: [number, number],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const round = await prisma.albumClubRound.findUnique({ where: { id: roundId } });
  if (!round) return { ok: false, error: "Rodada não encontrada" };

  const now = new Date();
  if (round.phase !== AlbumClubPhase.NOMINATIONS) return { ok: false, error: "Inscrições encerradas" };
  if (now < round.nominationsOpenAt) return { ok: false, error: "Inscrições ainda não abriram" };
  if (now >= round.nominationsCloseAt) return { ok: false, error: "Prazo de inscrições expirou" };
  if (albumIds[0] === albumIds[1]) return { ok: false, error: "Escolha dois álbuns diferentes" };

  const albums = await prisma.album.findMany({
    where: { id: { in: albumIds } },
    select: { id: true },
  });
  if (albums.length !== 2) return { ok: false, error: "Álbum inválido" };

  const conflict = await prisma.albumClubNomination.findFirst({
    where: {
      albumId: { in: albumIds },
      OR: [{ roundId: { not: roundId } }, { userId: { not: userId } }],
    },
    select: { albumId: true },
  });
  if (conflict) return { ok: false, error: "Este álbum já foi indicado em uma rodada anterior ou por outro participante nesta rodada" };

  await prisma.$transaction([
    prisma.albumClubNomination.deleteMany({ where: { roundId, userId } }),
    prisma.albumClubNomination.createMany({
      data: [
        { roundId, userId, albumId: albumIds[0], slot: 1 },
        { roundId, userId, albumId: albumIds[1], slot: 2 },
      ],
    }),
  ]);

  return { ok: true };
}

export async function submitClubeVotes(
  userId: string,
  roundId: string,
  nominationIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const round = await prisma.albumClubRound.findUnique({ where: { id: roundId } });
  if (!round) return { ok: false, error: "Rodada não encontrada" };
  if (round.phase !== AlbumClubPhase.POLL) return { ok: false, error: "Enquete não está aberta" };
  if (new Date() >= round.pollCloseAt) return { ok: false, error: "Prazo da enquete expirou" };
  if (nominationIds.length < MIN_POLL_VOTES) {
    return { ok: false, error: `Selecione pelo menos ${MIN_POLL_VOTES} álbuns` };
  }

  const valid = await prisma.albumClubNomination.count({
    where: { roundId, id: { in: nominationIds } },
  });
  if (valid !== nominationIds.length) return { ok: false, error: "Indicação inválida" };

  const unique = new Set(nominationIds);
  if (unique.size !== nominationIds.length) return { ok: false, error: "Votos duplicados" };

  await prisma.$transaction([
    prisma.albumClubPollVote.deleteMany({ where: { roundId, userId } }),
    prisma.albumClubPollVote.createMany({
      data: nominationIds.map((nominationId) => ({ roundId, userId, nominationId })),
    }),
  ]);

  return { ok: true };
}
