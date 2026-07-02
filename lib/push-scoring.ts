export const PUSH_NO_VOTE_PENALTY = 20;

export function pushPoints(pos: number, totalToRank: number): number {
  if (totalToRank <= 0) return 0;
  if (totalToRank === 1) return 20;
  const k = Math.log(20) / (totalToRank - 1);
  return Math.max(1, Math.round(20 * Math.exp(-k * (pos - 1))));
}

export type PushVoteRow = { userId: string; submissionId: string; position: number };
export type PushSubmissionRow = { id: string; userId: string };

/** Soma pontos por inscrição; o tamanho da cédula é calculado por votante. */
export function aggregatePushVotePoints(votes: PushVoteRow[]): Map<string, number> {
  const ballotSizes = new Map<string, number>();
  for (const v of votes) {
    ballotSizes.set(v.userId, (ballotSizes.get(v.userId) ?? 0) + 1);
  }
  const totals = new Map<string, number>();
  for (const v of votes) {
    const ballotSize = ballotSizes.get(v.userId) ?? 0;
    const pts = pushPoints(v.position, ballotSize);
    totals.set(v.submissionId, (totals.get(v.submissionId) ?? 0) + pts);
  }
  return totals;
}

/** Participante que não enviou avaliação: +20 pts para cada outra música da rodada. */
export function applyNoVotePenalties(
  totals: Map<string, number>,
  submissions: PushSubmissionRow[],
  votes: PushVoteRow[],
): Map<string, number> {
  const voters = new Set(votes.map((v) => v.userId));
  for (const sub of submissions) {
    if (voters.has(sub.userId)) continue;
    for (const other of submissions) {
      if (other.userId === sub.userId) continue;
      totals.set(other.id, (totals.get(other.id) ?? 0) + PUSH_NO_VOTE_PENALTY);
    }
  }
  return totals;
}

export function computePushRoundScores(
  submissions: PushSubmissionRow[],
  votes: PushVoteRow[],
): Map<string, number> {
  const totals = aggregatePushVotePoints(votes);
  return applyNoVotePenalties(totals, submissions, votes);
}

export function rankPushSubmissions<T extends PushSubmissionRow>(
  submissions: T[],
  totals: Map<string, number>,
): Array<T & { totalPoints: number; rank: number }> {
  const sorted = submissions
    .map((s) => ({ ...s, totalPoints: totals.get(s.id) ?? 0 }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
  return sorted.map((s, i) => ({ ...s, rank: i + 1 }));
}
