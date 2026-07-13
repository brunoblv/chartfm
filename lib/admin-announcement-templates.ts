import type { AlbumClubPhase, CopaStatus, PushPhase } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCopaIncompleteSinglesRecipients } from "@/lib/copa-incomplete-singles";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import {
  buildWeekLabelFromDate,
  getRankingWeekReference,
  getWeeklySnapshotReferenceDate,
} from "@/lib/chart-week";

export type AnnouncementTemplateId =
  | "global_100"
  | "global_airplay"
  | "global_albums"
  | "push_registration"
  | "push_listening"
  | "push_result"
  | "copa_registration"
  | "copa_group_stage"
  | "copa_knockout"
  | "copa_vote"
  | "copa_incomplete_singles"
  | "clube_registration"
  | "clube_poll"
  | "clube_listening"
  | "clube_result"
  | "custom";

export type ResolvedAnnouncement = {
  text: string;
  targetUrl: string | null;
  notifyType: string;
  feedKind: string;
  /** Só notifica um subconjunto de usuários — não publica no feed global. */
  targeted?: boolean;
};

export type AnnouncementTemplateMeta = {
  id: AnnouncementTemplateId;
  label: string;
  category: "global" | "push" | "copa" | "clube" | "custom";
  description: string;
  needsContext?: "push" | "copa" | "clube";
  targeted?: boolean;
};

export const ANNOUNCEMENT_TEMPLATES: AnnouncementTemplateMeta[] = [
  {
    id: "global_100",
    label: "Global 100 publicado",
    category: "global",
    description: "Avisa que a Parada Global da semana saiu.",
  },
  {
    id: "global_airplay",
    label: "Global Air Play publicado",
    category: "global",
    description: "Top de reproduções da semana no Last.fm.",
  },
  {
    id: "global_albums",
    label: "Global Álbuns publicado",
    category: "global",
    description: "Ranking semanal de álbuns mais ouvidos.",
  },
  {
    id: "push_registration",
    label: "Push — inscrições abertas",
    category: "push",
    description: "Convida a indicar música no Push.",
    needsContext: "push",
  },
  {
    id: "push_listening",
    label: "Push — fase de escuta",
    category: "push",
    description: "Convida a ouvir e avaliar as indicações.",
    needsContext: "push",
  },
  {
    id: "push_result",
    label: "Push — resultado",
    category: "push",
    description: "Anuncia o ranking final do Push.",
    needsContext: "push",
  },
  {
    id: "copa_registration",
    label: "Copa — inscrições abertas",
    category: "copa",
    description: "Convida a montar time na Copa.",
    needsContext: "copa",
  },
  {
    id: "copa_group_stage",
    label: "Copa — fase de grupos",
    category: "copa",
    description: "Acompanhe os jogos da fase de grupos.",
    needsContext: "copa",
  },
  {
    id: "copa_knockout",
    label: "Copa — mata-mata",
    category: "copa",
    description: "Vote nos confrontos decisivos.",
    needsContext: "copa",
  },
  {
    id: "copa_vote",
    label: "Copa — lembrete de votação",
    category: "copa",
    description: "Lembrete genérico para votar nos jogos ao vivo.",
    needsContext: "copa",
  },
  {
    id: "copa_incomplete_singles",
    label: "Copa — músicas incompletas",
    category: "copa",
    description: "Avisa só inscritos que ainda não preencheram as 8 músicas de cada artista (sino, sem post no feed).",
    needsContext: "copa",
    targeted: true,
  },
  {
    id: "clube_registration",
    label: "Clube — inscrições abertas",
    category: "clube",
    description: "Convida a indicar álbuns no Clube do Álbum.",
    needsContext: "clube",
  },
  {
    id: "clube_poll",
    label: "Clube — enquete aberta",
    category: "clube",
    description: "Convida a votar na enquete de álbuns.",
    needsContext: "clube",
  },
  {
    id: "clube_listening",
    label: "Clube — período de escuta",
    category: "clube",
    description: "Período de escuta dos álbuns escolhidos.",
    needsContext: "clube",
  },
  {
    id: "clube_result",
    label: "Clube — resultado",
    category: "clube",
    description: "Resultado da rodada publicado.",
    needsContext: "clube",
  },
  {
    id: "custom",
    label: "Mensagem livre",
    category: "custom",
    description: "Texto e link personalizados.",
  },
];

const PUSH_PHASE_LABEL: Partial<Record<PushPhase, string>> = {
  SUBMISSION: "inscrições abertas",
  LISTENING: "fase de escuta",
  RESULT: "resultado",
};

const COPA_STATUS_LABEL: Record<CopaStatus, string> = {
  REGISTRATION: "inscrições",
  GROUP_STAGE: "fase de grupos",
  KNOCKOUT: "mata-mata",
  FINISHED: "encerrada",
};

const CLUBE_PHASE_LABEL: Record<AlbumClubPhase, string> = {
  NOMINATIONS: "inscrições",
  POLL: "enquete",
  RESULT: "resultado",
  LISTENING: "escuta",
  COMPLETED: "encerrada",
};

export type AnnouncementContext = {
  globals: {
    weekIndex: number;
    weekLabel: string;
    hasGlobal100: boolean;
    hasAirplay: boolean;
    hasAlbums: boolean;
  };
  pushRounds: Array<{
    id: string;
    number: number;
    title: string | null;
    phase: PushPhase;
    phaseLabel: string;
    label: string;
  }>;
  copas: Array<{
    id: string;
    name: string;
    status: CopaStatus;
    statusLabel: string;
    incompleteSinglesCount: number;
  }>;
  clubeRounds: Array<{
    id: string;
    number: number;
    theme: string;
    phase: AlbumClubPhase;
    phaseLabel: string;
    label: string;
  }>;
};

export async function getAnnouncementContext(): Promise<AnnouncementContext> {
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const publishSlot = await getGlobalPublishSlot();
  const rankingWeek = getRankingWeekReference(nowBRT, publishSlot);
  const weekIndex = rankingWeek.weekIndex;
  const weekRefDate = getWeeklySnapshotReferenceDate(weekIndex, publishSlot);
  const weekLabel = buildWeekLabelFromDate(weekRefDate);

  const [globalSnap, airplaySnap, albumsSnap, pushRounds, copas, clubeRounds] = await Promise.all([
    prisma.globalSnapshot.findUnique({ where: { weekIndex }, select: { id: true } }),
    prisma.globalAirplaySnapshot.findUnique({ where: { weekIndex }, select: { id: true } }),
    prisma.globalAlbumsSnapshot.findUnique({ where: { weekIndex }, select: { id: true } }),
    prisma.pushRound.findMany({
      orderBy: { number: "desc" },
      take: 6,
      select: { id: true, number: true, title: true, phase: true },
    }),
    prisma.copaEdition.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, status: true },
    }),
    prisma.albumClubRound.findMany({
      orderBy: { number: "desc" },
      take: 6,
      select: { id: true, number: true, theme: true, phase: true },
    }),
  ]);

  return {
    globals: {
      weekIndex,
      weekLabel,
      hasGlobal100: !!globalSnap,
      hasAirplay: !!airplaySnap,
      hasAlbums: !!albumsSnap,
    },
    pushRounds: pushRounds.map((r) => ({
      ...r,
      label: r.title ?? `Push #${r.number}`,
      phaseLabel: PUSH_PHASE_LABEL[r.phase] ?? r.phase,
    })),
    copas: await Promise.all(
      copas.map(async (c) => ({
        ...c,
        statusLabel: COPA_STATUS_LABEL[c.status],
        incompleteSinglesCount: (await getCopaIncompleteSinglesRecipients(c.id)).length,
      })),
    ),
    clubeRounds: clubeRounds.map((r) => ({
      ...r,
      label: `Clube #${r.number} (${r.theme})`,
      phaseLabel: CLUBE_PHASE_LABEL[r.phase],
    })),
  };
}

function pushName(title: string | null, number: number) {
  return title ?? `Push #${number}`;
}

function clubeName(number: number, theme: string) {
  return `Clube do Álbum #${number} (${theme})`;
}

export async function resolveAnnouncementTemplate(
  templateId: AnnouncementTemplateId,
  contextKey: string | null | undefined,
  custom?: { text?: string; targetUrl?: string | null },
): Promise<ResolvedAnnouncement | { error: string }> {
  const ctx = await getAnnouncementContext();

  switch (templateId) {
    case "global_100":
      return {
        text: `A Parada Global (${ctx.globals.weekLabel}) foi publicada! Confira os resultados.`,
        targetUrl: "/global/100",
        notifyType: "global_chart",
        feedKind: "global_chart",
      };
    case "global_airplay":
      return {
        text: `O Global 100 Air Play (${ctx.globals.weekLabel}) foi publicado! Veja o top de reproduções da semana.`,
        targetUrl: "/global/airplay",
        notifyType: "global_airplay",
        feedKind: "global_airplay",
      };
    case "global_albums":
      return {
        text: `O Global Álbuns (${ctx.globals.weekLabel}) foi publicado! Descubra os álbuns mais ouvidos da semana.`,
        targetUrl: "/global/albums",
        notifyType: "global_albums",
        feedKind: "global_albums",
      };
    case "custom": {
      const text = custom?.text?.trim();
      if (!text) return { error: "Informe o texto do aviso." };
      return {
        text,
        targetUrl: custom?.targetUrl?.trim() || null,
        notifyType: "admin_announcement",
        feedKind: "admin_announcement",
      };
    }
    default:
      break;
  }

  if (!contextKey) {
    return { error: "Selecione o jogo ou rodada para este modelo." };
  }

  if (templateId.startsWith("push_")) {
    const round = ctx.pushRounds.find((r) => r.id === contextKey);
    if (!round) return { error: "Rodada Push não encontrada." };
    const name = pushName(round.title, round.number);

    if (templateId === "push_registration") {
      return {
        text: `O ${name} abriu as inscrições! Indique sua música e participe.`,
        targetUrl: "/push",
        notifyType: "push_registration",
        feedKind: "push_registration",
      };
    }
    if (templateId === "push_listening") {
      return {
        text: `O ${name} entrou na fase de escuta e avaliação! Ouça as indicações e avalie.`,
        targetUrl: "/push",
        notifyType: "push_phase",
        feedKind: "push_round",
      };
    }
    if (templateId === "push_result") {
      return {
        text: `O ${name} chegou ao resultado! Confira o ranking final.`,
        targetUrl: "/push",
        notifyType: "push_phase",
        feedKind: "push_round",
      };
    }
  }

  if (templateId.startsWith("copa_")) {
    const copa = ctx.copas.find((c) => c.id === contextKey);
    if (!copa) return { error: "Copa não encontrada." };

    if (templateId === "copa_registration") {
      return {
        text: `A ${copa.name} abriu as inscrições! Monte seu time e participe.`,
        targetUrl: "/copa",
        notifyType: "copa_registration",
        feedKind: "copa_registration",
      };
    }
    if (templateId === "copa_group_stage") {
      return {
        text: `A ${copa.name} iniciou a fase de grupos! Acompanhe os jogos ao vivo.`,
        targetUrl: "/copa",
        notifyType: "copa_status",
        feedKind: "copa_status",
      };
    }
    if (templateId === "copa_knockout") {
      return {
        text: `A ${copa.name} entrou no mata-mata! Vote nos confrontos decisivos.`,
        targetUrl: "/copa",
        notifyType: "copa_status",
        feedKind: "copa_status",
      };
    }
    if (templateId === "copa_vote") {
      return {
        text: `Jogos da ${copa.name} estão abertos para votação! Entre e vote agora.`,
        targetUrl: "/copa",
        notifyType: "copa_fixture",
        feedKind: "copa_fixture",
      };
    }
    if (templateId === "copa_incomplete_singles") {
      return {
        text: `Faltam músicas no seu time da ${copa.name}! Acesse Meu Time e complete as 8 músicas de cada artista.`,
        targetUrl: "/copa/meu-time",
        notifyType: "copa_singles_reminder",
        feedKind: "copa_singles_reminder",
        targeted: true,
      };
    }
  }

  if (templateId.startsWith("clube_")) {
    const round = ctx.clubeRounds.find((r) => r.id === contextKey);
    if (!round) return { error: "Rodada do Clube não encontrada." };
    const label = clubeName(round.number, round.theme);

    if (templateId === "clube_registration") {
      return {
        text: `O ${label} abriu as inscrições! Indique seus álbuns.`,
        targetUrl: "/criticsfm",
        notifyType: "clube_registration",
        feedKind: "clube_registration",
      };
    }
    if (templateId === "clube_poll") {
      return {
        text: `${label}: a enquete está aberta! Vote nos álbuns indicados.`,
        targetUrl: "/criticsfm",
        notifyType: "clube_phase",
        feedKind: "clube_phase",
      };
    }
    if (templateId === "clube_listening") {
      return {
        text: `${label} entrou no período de escuta! Ouça os álbuns escolhidos.`,
        targetUrl: "/criticsfm",
        notifyType: "clube_phase",
        feedKind: "clube_phase",
      };
    }
    if (templateId === "clube_result") {
      return {
        text: `${label}: o resultado foi publicado! Confira os escolhidos.`,
        targetUrl: "/criticsfm",
        notifyType: "clube_phase",
        feedKind: "clube_phase",
      };
    }
  }

  return { error: "Modelo de aviso inválido." };
}
