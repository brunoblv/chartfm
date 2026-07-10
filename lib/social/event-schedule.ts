import { prisma } from "@/lib/prisma";
import { SocialEventType } from "@prisma/client";

export type EventSlot = { weekday: number; time: string };

/**
 * Valor inicial das paradas oficiais — terça, 9h, todas juntas (as 3 edições
 * são publicadas juntas pelo cron publish-weekly-globals). Editável em
 * /admin/postagens, aba "Agenda das Paradas".
 */
const DEFAULT_SCHEDULE: Partial<Record<SocialEventType, EventSlot>> = {
  [SocialEventType.GLOBAL100_PUBLISHED]: { weekday: 2, time: "09:00" },
  [SocialEventType.AIRPLAY_PUBLISHED]: { weekday: 2, time: "09:00" },
  [SocialEventType.ALBUMS_CHART_PUBLISHED]: { weekday: 2, time: "09:00" },
};

async function ensureDefaultEventSchedules() {
  for (const [eventType, slot] of Object.entries(DEFAULT_SCHEDULE) as [SocialEventType, EventSlot][]) {
    await prisma.socialEventSchedule.upsert({
      where: { eventType },
      create: { eventType, weekday: slot.weekday, time: slot.time },
      update: {},
    });
  }
}

/** Mapa eventType -> {weekday, time} configurado no admin (cria os padrões na primeira vez). */
export async function getEventSchedules(): Promise<Map<SocialEventType, EventSlot>> {
  await ensureDefaultEventSchedules();
  const rows = await prisma.socialEventSchedule.findMany();
  return new Map(rows.map((r) => [r.eventType, { weekday: r.weekday, time: r.time }]));
}
