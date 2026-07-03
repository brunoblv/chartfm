import type { AlbumClubPhase, CopaStatus, PushPhase } from "@prisma/client";
import { broadcastGameAnnouncement } from "@/lib/game-broadcast";

const PUSH_PHASE_TEXT: Partial<Record<PushPhase, string>> = {
  LISTENING: "entrou na fase de escuta e avaliação! Ouça as indicações e avalie.",
  RESULT: "chegou ao resultado! Confira o ranking final.",
};

const COPA_STATUS_TEXT: Record<Exclude<CopaStatus, "REGISTRATION">, string> = {
  GROUP_STAGE: "iniciou a fase de grupos! Acompanhe os jogos ao vivo.",
  KNOCKOUT: "entrou no mata-mata! Vote nos confrontos decisivos.",
  FINISHED: "chegou ao fim! Confira o campeão.",
};

const CLUBE_PHASE_TEXT: Partial<Record<AlbumClubPhase, string>> = {
  POLL: "A enquete está aberta! Vote nos álbuns indicados.",
  RESULT: "O resultado foi publicado! Confira os escolhidos.",
  LISTENING: "Entrou no período de escuta!",
  COMPLETED: "A rodada encerrou!",
};

function clubeLabel(number: number, theme: string) {
  return `Clube do Álbum #${number} (${theme})`;
}

export async function announcePushRegistrationOpen(round: {
  id: string;
  title: string | null;
  number: number;
}): Promise<number> {
  const name = round.title ?? `Push #${round.number}`;
  const text = `O ${name} abriu as inscrições! Indique sua música e participe.`;
  return broadcastGameAnnouncement(
    "push_registration",
    `/push?round=${round.id}&event=registration`,
    text,
    "push_registration",
    "/push",
  );
}

export async function announcePushPhaseChange(round: {
  id: string;
  title: string | null;
  number: number;
  phase: PushPhase;
}): Promise<number> {
  const announcement = PUSH_PHASE_TEXT[round.phase];
  if (!announcement) return 0;

  const name = round.title ?? `Push #${round.number}`;
  const text = `O ${name} ${announcement}`;
  return broadcastGameAnnouncement(
    "push_phase",
    `/push?round=${round.id}&phase=${round.phase}`,
    text,
    "push_round",
    "/push",
  );
}

export async function announceCopaRegistrationOpen(copa: { id: string; name: string }): Promise<number> {
  const text = `A ${copa.name} abriu as inscrições! Monte seu time e participe.`;
  return broadcastGameAnnouncement(
    "copa_registration",
    `/copa?copa=${copa.id}&event=registration`,
    text,
    "copa_registration",
    "/copa",
  );
}

export async function announceCopaStatusChange(copa: { id: string; name: string }, status: CopaStatus): Promise<number> {
  if (status === "REGISTRATION") return 0;

  const text = `A ${copa.name} ${COPA_STATUS_TEXT[status]}`;
  return broadcastGameAnnouncement(
    "copa_status",
    `/copa?copa=${copa.id}&status=${status}`,
    text,
    "copa_status",
    "/copa",
  );
}

export async function announceClubeRegistrationOpen(round: {
  id: string;
  number: number;
  theme: string;
}): Promise<number> {
  const label = clubeLabel(round.number, round.theme);
  const text = `O ${label} abriu as inscrições! Indique seus álbuns.`;
  return broadcastGameAnnouncement(
    "clube_registration",
    `/criticsfm?round=${round.id}&event=registration`,
    text,
    "clube_registration",
    "/criticsfm",
  );
}

export async function announceClubePhaseChange(
  round: { id: string; number: number; theme: string },
  phase: AlbumClubPhase,
): Promise<number> {
  const announcement = CLUBE_PHASE_TEXT[phase];
  if (!announcement) return 0;

  const label = clubeLabel(round.number, round.theme);
  const text = `${label}: ${announcement}`;
  return broadcastGameAnnouncement(
    "clube_phase",
    `/criticsfm?round=${round.id}&phase=${phase}`,
    text,
    "clube_phase",
    "/criticsfm",
  );
}
