import type { CopaArtist, CopaFixture, CopaSingle, CopaVote, CopaEdition, CopaParticipant, User } from "@prisma/client";

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

export const SLOT_LABELS = [
  "Grupo · Jogo 1",
  "Grupo · Jogo 2",
  "Grupo · Jogo 3",
  "Oitavas de Final",
  "Quartas de Final",
  "Semi-Final",
  "Final / 3º Lugar",
];

export const PHASE_SLOT_INDEX: Record<string, number> = {
  GROUP_1: 0,
  GROUP_2: 1,
  GROUP_3: 2,
  R16: 3,
  QF: 4,
  SF: 5,
  THIRD_PLACE: 6,
  FINAL: 6,
};

export type StandingRow = {
  artistId: string;
  P: number;
  W: number;
  D: number;
  L: number;
  GF: number;
  GA: number;
  GD: number;
  Pts: number;
};

export function computeStandings(
  fixtures: Array<{ artistAId: string; artistBId: string; status: string; votes: CopaVote[] }>,
  artistIds: string[],
): StandingRow[] {
  const t: Record<string, StandingRow> = {};
  artistIds.forEach((id) => {
    t[id] = { artistId: id, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
  });

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
    if (g1 > g2) { ra.W++; ra.Pts += 3; rb.L++; }
    else if (g2 > g1) { rb.W++; rb.Pts += 3; ra.L++; }
    else { ra.D++; ra.Pts++; rb.D++; rb.Pts++; }
  }

  Object.values(t).forEach((r) => { r.GD = r.GF - r.GA; });
  return Object.values(t).sort(
    (a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF,
  );
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
