import type { CopaArtist, CopaFixture, CopaSingle, CopaVote, CopaEdition, CopaParticipant, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchSpotifyTrackCovers } from "@/lib/spotify-server";

export const COPA_GROUP_LETTERS = "ABCDEFGHIJKLMNOP".split("") as string[];

// Placeholder group for artists that have been claimed but not yet drawn into a
// real group. Groups are only formed by the draw (sorteio), after registration.
export const COPA_UNASSIGNED_GROUP = "?";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type DrawInput = { id: string; ownerId: string };
export type DrawSlot = { artistId: string; groupLetter: string; slotInGroup: number };

// Randomly distribute artists into groups of 4 such that no two artists owned by
// the same participant land in the same group. Returns null if no valid draw was
// found (e.g. too few participants for the number of artists per owner).
export function drawGroups(artists: DrawInput[], numGroups: number, maxTries = 300): DrawSlot[] | null {
  if (numGroups <= 0 || numGroups > COPA_GROUP_LETTERS.length) return null;
  if (artists.length !== numGroups * 4) return null;

  for (let t = 0; t < maxTries; t++) {
    const groups: DrawInput[][] = Array.from({ length: numGroups }, () => []);
    let ok = true;

    for (const art of shuffle(artists)) {
      const candidates: number[] = [];
      for (let g = 0; g < numGroups; g++) {
        if (groups[g].length < 4 && !groups[g].some((a) => a.ownerId === art.ownerId)) {
          candidates.push(g);
        }
      }
      if (candidates.length === 0) { ok = false; break; }
      // Prefer the emptiest valid group to keep groups balanced; random tiebreak.
      const minLen = Math.min(...candidates.map((g) => groups[g].length));
      const best = candidates.filter((g) => groups[g].length === minLen);
      groups[best[Math.floor(Math.random() * best.length)]].push(art);
    }
    if (!ok) continue;

    const result: DrawSlot[] = [];
    groups.forEach((grp, gi) =>
      grp.forEach((a, slot) =>
        result.push({ artistId: a.id, groupLetter: COPA_GROUP_LETTERS[gi], slotInGroup: slot }),
      ),
    );
    return result;
  }
  return null;
}

// Round-robin fixture pairs for a group of 4
// [i, j] → artist at slot i vs artist at slot j
export const GROUP_PAIRS: [number, number][] = [
  [0, 1], [2, 3], // Round 1
  [0, 2], [1, 3], // Round 2
  [0, 3], [1, 2], // Round 3
];

export const COPA_SINGLES_COUNT = 8;

export const SLOT_LABELS = [
  "Grupo · Jogo 1",
  "Grupo · Jogo 2",
  "Grupo · Jogo 3",
  "1/16 de Final",
  "Oitavas de Final",
  "Quartas de Final",
  "Semi-Final",
  "Final / 3º Lugar",
];

export const PHASE_SLOT_INDEX: Record<string, number> = {
  GROUP_1: 0,
  GROUP_2: 1,
  GROUP_3: 2,
  R32: 3,
  R16: 4,
  QF: 5,
  SF: 6,
  THIRD_PLACE: 7,
  FINAL: 7,
};

const FIXTURE_PHASE_LABELS: Record<string, string> = {
  GROUP: "Grupos",
  R32: "1/16 de Final",
  R16: "Oitavas",
  QF: "Quartas",
  SF: "Semi",
  FINAL: "Final",
  THIRD_PLACE: "3º lugar",
};

export type LockedSingleSlot = {
  slotIndex: number;
  status: "LIVE" | "DONE";
  phase: string;
  label: string;
};

/** Slots já usados em jogos LIVE ou DONE — não podem trocar a música. */
export function getLockedSingleSlots(
  artistId: string,
  fixtures: Array<{
    artistAId: string;
    artistBId: string;
    singleAIdx: number;
    singleBIdx: number;
    status: string;
    phase: string;
  }>,
): LockedSingleSlot[] {
  const bySlot = new Map<number, LockedSingleSlot>();
  for (const f of fixtures) {
    if (f.status !== "LIVE" && f.status !== "DONE") continue;
    const pairs: [string, number][] = [
      [f.artistAId, f.singleAIdx],
      [f.artistBId, f.singleBIdx],
    ];
    for (const [id, idx] of pairs) {
      if (id !== artistId) continue;
      const next: LockedSingleSlot = {
        slotIndex: idx,
        status: f.status as "LIVE" | "DONE",
        phase: f.phase,
        label: FIXTURE_PHASE_LABELS[f.phase] ?? f.phase,
      };
      const prev = bySlot.get(idx);
      if (!prev || (prev.status === "LIVE" && next.status === "DONE")) {
        bySlot.set(idx, next);
      }
    }
  }
  return [...bySlot.values()].sort((a, b) => a.slotIndex - b.slotIndex);
}

export function isSingleSlotEditable(slotIndex: number, locked: LockedSingleSlot[]): boolean {
  return !locked.some((l) => l.slotIndex === slotIndex);
}

export type ArtistSinglePick = {
  slotIndex: number;
  songName: string;
  songId: string | null;
};

/** Chave estável para comparar se duas escolhas são a mesma música. */
export function songPickKey(songId: string | null | undefined, songName: string): string | null {
  const name = songName.trim();
  if (!name || /^Single \d+$/i.test(name)) return null;
  if (songId) return `id:${songId}`;
  return `name:${name.toLowerCase()}`;
}

/** Músicas já atribuídas a outros slots do mesmo artista (slotIndex → fase). */
export function getArtistUsedSongKeys(
  singles: ArtistSinglePick[],
  excludeSlotIndex?: number,
): Map<string, { slotIndex: number; label: string }> {
  const used = new Map<string, { slotIndex: number; label: string }>();
  for (const s of singles) {
    if (excludeSlotIndex != null && s.slotIndex === excludeSlotIndex) continue;
    const key = songPickKey(s.songId, s.songName);
    if (!key) continue;
    used.set(key, {
      slotIndex: s.slotIndex,
      label: SLOT_LABELS[s.slotIndex] ?? `Fase ${s.slotIndex + 1}`,
    });
  }
  return used;
}

export function getLockedSlotIndexes(locked: LockedSingleSlot[]): Set<number> {
  return new Set(locked.map((l) => l.slotIndex));
}

export type CopaSingleValidationOpts = {
  /** Só bloqueia reuso de música em slots já disputados (LIVE/DONE). */
  lockedSlotIndexes?: Set<number> | number[];
};

function lockedSet(opts?: CopaSingleValidationOpts): Set<number> | null {
  if (!opts?.lockedSlotIndexes) return null;
  return opts.lockedSlotIndexes instanceof Set
    ? opts.lockedSlotIndexes
    : new Set(opts.lockedSlotIndexes);
}

/** Retorna mensagem de erro se a música já foi usada em outro jogo/fase do artista. */
export function validateArtistSingleAssignment(
  slotIndex: number,
  songName: string,
  songId: string | null,
  allSingles: ArtistSinglePick[],
  opts?: CopaSingleValidationOpts,
): string | null {
  const key = songPickKey(songId, songName);
  if (!key) return null;

  const used = getArtistUsedSongKeys(allSingles, slotIndex);
  const conflict = used.get(key);
  if (!conflict) return null;

  const locked = lockedSet(opts);
  if (locked && !locked.has(conflict.slotIndex)) {
    return null;
  }

  return `"${songName.trim()}" já foi usada em ${conflict.label}. Cada música só pode ser usada uma vez por artista.`;
}

/** Valida duplicatas. Com lockedSlotIndexes, só bloqueia conflito envolvendo etapa já disputada. */
export function findDuplicateSongInSingles(
  singles: ArtistSinglePick[],
  opts?: CopaSingleValidationOpts,
): string | null {
  const locked = lockedSet(opts);
  const seen = new Map<string, number>();
  for (const s of singles) {
    const key = songPickKey(s.songId, s.songName);
    if (!key) continue;
    const prev = seen.get(key);
    if (prev != null) {
      if (!locked || locked.has(prev) || locked.has(s.slotIndex)) {
        return `"${s.songName.trim()}" está em ${SLOT_LABELS[prev]} e ${SLOT_LABELS[s.slotIndex]}. Cada música só pode ser usada uma vez por artista.`;
      }
    }
    seen.set(key, s.slotIndex);
  }
  return null;
}

/**
 * Ao atribuir a um slot editável, remove a mesma música de outro slot ainda editável (move).
 */
export function applyCopaSingleMoveFromEditable(
  existing: ArtistSinglePick[],
  slotIndex: number,
  songName: string,
  songId: string | null,
  lockedSlotIndexes: Set<number>,
): ArtistSinglePick[] {
  const key = songPickKey(songId, songName);
  if (!key) {
    return mergeArtistSingles(existing, [{ slotIndex, songName, songId }]);
  }

  const used = getArtistUsedSongKeys(existing, slotIndex);
  const conflict = used.get(key);
  const updates: ArtistSinglePick[] = [{ slotIndex, songName, songId }];
  if (conflict && !lockedSlotIndexes.has(conflict.slotIndex)) {
    updates.push({
      slotIndex: conflict.slotIndex,
      songName: `Single ${conflict.slotIndex + 1}`,
      songId: null,
    });
  }
  return mergeArtistSingles(existing, updates);
}

/** Música já usada em slot disputado (para UI de busca). */
export function isSongUsedInLockedSlot(
  singles: ArtistSinglePick[],
  songName: string,
  songId: string | null,
  lockedSlotIndexes: Set<number>,
  excludeSlotIndex?: number,
): boolean {
  const key = songPickKey(songId, songName);
  if (!key) return false;
  const used = getArtistUsedSongKeys(singles, excludeSlotIndex);
  const conflict = used.get(key);
  if (!conflict) return false;
  return lockedSlotIndexes.has(conflict.slotIndex);
}

export function mergeArtistSingles(
  existing: ArtistSinglePick[],
  updates: ArtistSinglePick[],
): ArtistSinglePick[] {
  const bySlot = new Map<number, ArtistSinglePick>();
  for (const s of existing) bySlot.set(s.slotIndex, s);
  for (const u of updates) {
    bySlot.set(u.slotIndex, {
      slotIndex: u.slotIndex,
      songName: u.songName.trim(),
      songId: u.songId ?? null,
    });
  }
  return Array.from({ length: COPA_SINGLES_COUNT }, (_, i) =>
    bySlot.get(i) ?? { slotIndex: i, songName: `Single ${i + 1}`, songId: null },
  );
}

/** Fases eliminatórias em ordem (slot de música de cada uma). */
export const KNOCKOUT_PHASE_SLOTS = [
  { phase: "R32", slotIndex: 3, label: "1/16 de Final" },
  { phase: "R16", slotIndex: 4, label: "Oitavas de Final" },
  { phase: "QF", slotIndex: 5, label: "Quartas de Final" },
  { phase: "SF", slotIndex: 6, label: "Semi-Final" },
  { phase: "FINAL", slotIndex: 7, label: "Final / 3º Lugar" },
] as const;

/**
 * Oitavas (O1–O8) a partir dos vencedores do 1/16 de final (J1–J16 = matchIndex 0–15).
 * O1: J1×J3, O2: J2×J4, … — quartas/semis/final pareiam vencedores consecutivos.
 */
export const R16_FROM_R32_PAIRING: ReadonlyArray<readonly [number, number]> = [
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [8, 10],
  [9, 11],
  [12, 14],
  [13, 15],
];

export function knockoutPendingMatchLabels(phase: string): string[] {
  switch (phase) {
    case "R16":
      return R16_FROM_R32_PAIRING.map(
        ([a, b], i) => `O${i + 1}: Vencedor J${a + 1} × Vencedor J${b + 1}`,
      );
    case "QF":
      return Array.from({ length: 4 }, (_, i) => `Q${i + 1}: Vencedor O${i * 2 + 1} × Vencedor O${i * 2 + 2}`);
    case "SF":
      return ["S1: Vencedor Q1 × Vencedor Q2", "S2: Vencedor Q3 × Vencedor Q4"];
    case "FINAL":
      return ["Final: Vencedor S1 × Vencedor S2"];
    case "THIRD_PLACE":
      return ["3º lugar: Perdedor S1 × Perdedor S2"];
    default:
      return [];
  }
}

export type CopaSinglesEditWindow = {
  open: boolean;
  completedPhase: string | null;
  completedLabel: string | null;
  nextPhase: string | null;
  nextLabel: string | null;
  editableSlots: number[];
  /** Quando definido, só estes artistas (classificados) podem editar os slots liberados. */
  competingArtistIds?: string[];
  message: string;
};

function fixturesOfPhase(
  all: Array<{ phase: string; status: string; matchIndex?: number }>,
  phase: string,
) {
  return all.filter((f) => f.phase === phase);
}

function phaseIsComplete(all: Array<{ phase: string; status: string; matchIndex?: number }>, phase: string) {
  const fs = fixturesOfPhase(all, phase);
  return fs.length > 0 && fs.every((f) => f.status === "DONE");
}

function phaseHasStarted(all: Array<{ phase: string; status: string; matchIndex?: number }>, phase: string) {
  return fixturesOfPhase(all, phase).some((f) => f.status === "LIVE" || f.status === "DONE");
}

/**
 * Janelas de edição de músicas. Slots em jogo (LIVE/DONE) ficam bloqueados por artista
 * via getLockedSingleSlots — a janela global não fecha a edição inteira durante o torneio.
 */
export function getCopaSinglesEditWindow(
  copaStatus: string,
  allFixtures: Array<{ phase: string; status: string; matchIndex?: number }>,
): CopaSinglesEditWindow {
  const closed = (message: string): CopaSinglesEditWindow => ({
    open: false,
    completedPhase: null,
    completedLabel: null,
    nextPhase: null,
    nextLabel: null,
    editableSlots: [],
    message,
  });

  const allSlots = Array.from({ length: COPA_SINGLES_COUNT }, (_, i) => i);

  if (copaStatus === "REGISTRATION") {
    return {
      open: true,
      completedPhase: null,
      completedLabel: null,
      nextPhase: null,
      nextLabel: null,
      editableSlots: allSlots,
      message: "Inscrições abertas — defina as 8 músicas de cada artista.",
    };
  }

  if (copaStatus === "FINISHED") {
    return closed("Copa encerrada — músicas não podem mais ser alteradas.");
  }

  // Após R32 encerrado → antes das oitavas iniciarem (R16 só é gerada nesse momento)
  if (phaseIsComplete(allFixtures, "R32") && !phaseHasStarted(allFixtures, "R16")) {
    return {
      open: true,
      completedPhase: "R32",
      completedLabel: "1/16 de Final",
      nextPhase: "R16",
      nextLabel: "Oitavas de Final",
      editableSlots: KNOCKOUT_PHASE_SLOTS.filter((p) => p.slotIndex >= 4).map((p) => p.slotIndex),
      message:
        "1/16 de Final encerrado. Classificados podem ajustar as músicas das oitavas e fases seguintes em Meu Time.",
    };
  }

  // Demais janelas entre fases (oitavas→quartas, etc.)
  for (let i = 1; i < KNOCKOUT_PHASE_SLOTS.length - 1; i++) {
    const cur = KNOCKOUT_PHASE_SLOTS[i];
    const nxt = KNOCKOUT_PHASE_SLOTS[i + 1];
    if (
      phaseIsComplete(allFixtures, cur.phase) &&
      fixturesOfPhase(allFixtures, nxt.phase).length > 0 &&
      !phaseHasStarted(allFixtures, nxt.phase)
    ) {
      const editableSlots = [...new Set(KNOCKOUT_PHASE_SLOTS.slice(i + 1).map((p) => p.slotIndex))];
      return {
        open: true,
        completedPhase: cur.phase,
        completedLabel: cur.label,
        nextPhase: nxt.phase,
        nextLabel: nxt.label,
        editableSlots,
        message: `${cur.label} encerrada. Edite as músicas antes de ${nxt.label.toLowerCase()}.`,
      };
    }
  }

  if (phaseIsComplete(allFixtures, "SF")) {
    const finalFixtures = [
      ...fixturesOfPhase(allFixtures, "FINAL"),
      ...fixturesOfPhase(allFixtures, "THIRD_PLACE"),
    ];
    if (finalFixtures.length > 0 && !finalFixtures.some((f) => f.status === "LIVE" || f.status === "DONE")) {
      return {
        open: true,
        completedPhase: "SF",
        completedLabel: "Semi-Final",
        nextPhase: "FINAL",
        nextLabel: "Final / 3º Lugar",
        editableSlots: [7],
        message: "Semifinais encerradas. Ajuste a música da final antes dos jogos.",
      };
    }
  }

  // Durante grupos ou mata-mata: edição aberta nos slots não bloqueados (Em jogo / Disputado).
  if (copaStatus === "GROUP_STAGE" || copaStatus === "KNOCKOUT") {
    const r32Live = phaseHasStarted(allFixtures, "R32") && !phaseIsComplete(allFixtures, "R32");
    return {
      open: true,
      completedPhase: null,
      completedLabel: null,
      nextPhase: null,
      nextLabel: null,
      editableSlots: allSlots,
      message: r32Live
        ? "Edite músicas das próximas fases. Slots em jogo ou já disputados estão bloqueados."
        : "Edite as músicas liberadas. Slots em jogo ou já disputados estão bloqueados.",
    };
  }

  return closed("Edição indisponível no momento.");
}

export function isSingleSlotEditableInWindow(
  slotIndex: number,
  window: CopaSinglesEditWindow,
  locked: LockedSingleSlot[],
  artistId?: string,
): boolean {
  if (!window.open) return false;
  if (!window.editableSlots.includes(slotIndex)) return false;
  if (window.competingArtistIds?.length && artistId && !window.competingArtistIds.includes(artistId)) {
    return false;
  }
  return isSingleSlotEditable(slotIndex, locked);
}

export type StandingRow = {
  artistId: string;
  P: number;
  W: number;
  D: number;
  L: number;
  GF: number;
  GA: number;
  GD: number;
  /** Votos recebidos/sofridos/saldo — usados nos critérios de desempate (regulamento §6). */
  VF: number;
  VA: number;
  VD: number;
  Pts: number;
};

// Regulamento §5: "O artista cuja música receber mais votos vence a partida" — o
// resultado (V/E/D) é decidido pelos votos brutos, não pelos "gols" (votos ÷ 2,
// que são só a exibição do placar). Isso evita empates espúrios quando os votos
// diferem por uma unidade ímpar (ex.: 5×4 vira 2×2 em gols mas A venceu nos votos).
export function computeStandings(
  fixtures: Array<{ artistAId: string; artistBId: string; status: string; votes: CopaVote[] }>,
  artistIds: string[],
): StandingRow[] {
  const t: Record<string, StandingRow> = {};
  artistIds.forEach((id) => {
    t[id] = { artistId: id, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, VF: 0, VA: 0, VD: 0, Pts: 0 };
  });

  // Confronto direto (regulamento §6, critério 2): resultado entre cada par de artistas.
  const h2h = new Map<string, string>(); // `${idA}:${idB}` -> id do vencedor, ou "DRAW"

  for (const f of fixtures) {
    if (f.status !== "DONE") continue;
    const votesA = f.votes.filter((v) => v.side === "A").length;
    const votesB = f.votes.filter((v) => v.side === "B").length;
    const g1 = Math.floor(votesA / 2);
    const g2 = Math.floor(votesB / 2);
    const ra = t[f.artistAId];
    const rb = t[f.artistBId];
    if (!ra || !rb) continue;
    ra.P++; rb.P++;
    ra.GF += g1; ra.GA += g2;
    rb.GF += g2; rb.GA += g1;
    ra.VF += votesA; ra.VA += votesB;
    rb.VF += votesB; rb.VA += votesA;

    const winner: string | "DRAW" =
      votesA > votesB ? f.artistAId : votesB > votesA ? f.artistBId : "DRAW";
    if (winner === f.artistAId) { ra.W++; ra.Pts += 3; rb.L++; }
    else if (winner === f.artistBId) { rb.W++; rb.Pts += 3; ra.L++; }
    else { ra.D++; ra.Pts++; rb.D++; rb.Pts++; }

    h2h.set(`${f.artistAId}:${f.artistBId}`, winner);
    h2h.set(`${f.artistBId}:${f.artistAId}`, winner);
  }

  Object.values(t).forEach((r) => { r.GD = r.GF - r.GA; r.VD = r.VF - r.VA; });

  // Regulamento §6: pontos → confronto direto → saldo de votos → votos recebidos
  // → número de vitórias → sorteio. O confronto direto só decide empates diretos
  // entre dois artistas; com 3+ artistas empatados, passa direto para os critérios
  // seguintes (convenção padrão de tabelas de futebol).
  return Object.values(t).sort((a, b) => {
    if (b.Pts !== a.Pts) return b.Pts - a.Pts;
    const h2hResult = h2h.get(`${a.artistId}:${b.artistId}`);
    if (h2hResult && h2hResult !== "DRAW") return h2hResult === a.artistId ? -1 : 1;
    if (b.VD !== a.VD) return b.VD - a.VD;
    if (b.VF !== a.VF) return b.VF - a.VF;
    if (b.W !== a.W) return b.W - a.W;
    return 0; // Sorteio — sem critério objetivo restante.
  });
}

export function getVoteCounts(fixture: { votes: CopaVote[] }) {
  const votesA = fixture.votes.filter((v) => v.side === "A").length;
  const votesB = fixture.votes.filter((v) => v.side === "B").length;
  return {
    votesA,
    votesB,
    goalsA: Math.floor(votesA / 2),
    goalsB: Math.floor(votesB / 2),
  };
}

// ── Desempate das fases eliminatórias ─────────────────────────────────────────
// Um jogo de mata-mata nunca pode empatar. A decisão segue, em ordem:
//   1) GOALS      — mais gols (votos ÷ 2), o tempo normal.
//   2) VOTES      — empatou em gols, vence quem tem mais votos (o voto "extra"
//                   que não fechou um gol decide a prorrogação).
//   3) GLOBAL_100 — empatou também em votos: vai aos pênaltis, vence a música
//                   com mais pontos totais no Global 100.
//   4) COIN       — fallback determinístico (praticamente impossível: gols,
//                   votos e pontos idênticos). Mantém o lado A para não travar.
export type KnockoutTiebreak = "GOALS" | "VOTES" | "GLOBAL_100" | "COIN";

export function resolveKnockoutWinner(input: {
  votesA: number;
  votesB: number;
  globalPointsA: number;
  globalPointsB: number;
}): { winner: "A" | "B"; decidedBy: KnockoutTiebreak } {
  const goalsA = Math.floor(input.votesA / 2);
  const goalsB = Math.floor(input.votesB / 2);
  if (goalsA !== goalsB) return { winner: goalsA > goalsB ? "A" : "B", decidedBy: "GOALS" };
  if (input.votesA !== input.votesB) return { winner: input.votesA > input.votesB ? "A" : "B", decidedBy: "VOTES" };
  if (input.globalPointsA !== input.globalPointsB)
    return { winner: input.globalPointsA > input.globalPointsB ? "A" : "B", decidedBy: "GLOBAL_100" };
  return { winner: "A", decidedBy: "COIN" };
}

// Rótulos dos 12 dias da Copa, indexados por batchOrder (0..11).
export const COPA_DAY_LABELS = [
  "Grupos · Rodada 1 (A–H)",
  "Grupos · Rodada 1 (I–P)",
  "Grupos · Rodada 2 (A–H)",
  "Grupos · Rodada 2 (I–P)",
  "Grupos · Rodada 3 (A–H)",
  "Grupos · Rodada 3 (I–P)",
  "1/16 de Final · 1ª rodada (8 jogos)",
  "1/16 de Final · 2ª rodada (8 jogos)",
  "Oitavas de Final (8 jogos)",
  "Quartas de Final",
  "Semifinais",
  "Final + 3º Lugar",
];

export const COPA_LAST_BATCH_ORDER = COPA_DAY_LABELS.length - 1; // 11

export type FixtureBatchInput = {
  phase: string;
  round: number | null;
  groupLetter: string | null;
  matchIndex: number;
};

// Ordem do "lote do dia" (Avançar Dia / cron). R32: 16 jogos em 2 dias; oitavas: 8 jogos.
export function fixtureBatchOrder(f: FixtureBatchInput): number {
  if (f.phase === "GROUP") {
    const half = COPA_GROUP_LETTERS.indexOf(f.groupLetter ?? "") < 8 ? 0 : 1;
    return ((f.round ?? 1) - 1) * 2 + half; // 0..5
  }
  const mi = f.matchIndex ?? 0;
  if (f.phase === "R32") return mi < 8 ? 6 : 7;
  if (f.phase === "R16") return 8;
  if (f.phase === "QF") return 9;
  if (f.phase === "SF") return 10;
  if (f.phase === "FINAL" || f.phase === "THIRD_PLACE") return 11;
  return 99;
}

export function getArtistColor(spotifyId: string | null | undefined): string {
  if (!spotifyId) return "#FA243C";
  const hue = Math.abs(
    spotifyId.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0),
  ) % 360;
  return `hsl(${hue},65%,55%)`;
}

export function getArtistInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Resolve capas de álbum a partir dos songId dos singles da Copa. */
export async function resolveSongCoverUrls(
  songIds: (string | null | undefined)[],
): Promise<Map<string, string | null>> {
  const ids = [...new Set(songIds.filter((id): id is string => Boolean(id)))];
  const out = new Map<string, string | null>();
  if (ids.length === 0) return out;

  const songs = await prisma.song.findMany({
    where: { id: { in: ids } },
    select: { id: true, spotifyId: true, albumRef: { select: { coverUrl: true } } },
  });

  const needSpotify: string[] = [];
  for (const s of songs) {
    const cover = s.albumRef?.coverUrl?.trim() || null;
    out.set(s.id, cover);
    if (!cover && s.spotifyId) needSpotify.push(s.spotifyId);
  }

  if (needSpotify.length > 0) {
    const spotifyCovers = await fetchSpotifyTrackCovers(needSpotify);
    for (const s of songs) {
      if (!out.get(s.id) && s.spotifyId) {
        out.set(s.id, spotifyCovers.get(s.spotifyId) ?? null);
      }
    }
  }

  return out;
}

export function pickSingleCover(
  songId: string | null | undefined,
  covers: Map<string, string | null>,
): string | null {
  if (!songId) return null;
  return covers.get(songId) ?? null;
}

// ── Serializable types for API responses ─────────────────────────────────────

export type CopaArtistData = {
  id: string;
  copaId: string;
  ownerId: string;
  ownerName: string;
  ownerHandle: string;
  ownerAvatarColor: string;
  groupLetter: string;
  slotInGroup: number;
  artistSpotifyId: string | null;
  artistName: string;
  artistImage: string | null;
  artistColor: string;
  artistInitials: string;
  singles: { slotIndex: number; songId: string | null; songName: string }[];
};

export type CopaFixtureData = {
  id: string;
  copaId: string;
  phase: string;
  groupLetter: string | null;
  round: number | null;
  matchIndex: number;
  artistA: CopaArtistData;
  artistB: CopaArtistData;
  singleAIdx: number;
  singleBIdx: number;
  singleAName: string;
  singleBName: string;
  votesA: number;
  votesB: number;
  goalsA: number;
  goalsB: number;
  status: string;
  myVote: "A" | "B" | null;
};

export type CopaEditionData = {
  id: string;
  name: string;
  year: number;
  status: string;
  maxParticipants: number;
  artistsPerUser: number;
  participants: { userId: string; name: string; handle: string; avatarColor: string }[];
};
