import { prisma } from "@/lib/prisma";
import { SocialEventType } from "@prisma/client";
import type { GlobalPublishSlot } from "@/lib/chart-week";

/** América/São_Paulo é UTC-3 fixo (sem horário de verão desde 2019). */
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

export type WeeklyPollSlot = GlobalPublishSlot;

/** Padrão pedido: segunda 0h → quarta 7h (BRT). */
export const DEFAULT_WEEKLY_POLL_OPEN_SLOT: WeeklyPollSlot = { weekday: 1, time: "00:00" };
export const DEFAULT_WEEKLY_POLL_CLOSE_SLOT: WeeklyPollSlot = { weekday: 3, time: "07:00" };

const WEEKDAY_LABELS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export async function getWeeklyPollOpenSlot(): Promise<WeeklyPollSlot> {
  const row = await prisma.socialEventSchedule.findUnique({
    where: { eventType: SocialEventType.WEEKLY_POLL_OPEN },
  });
  return row ? { weekday: row.weekday, time: row.time } : DEFAULT_WEEKLY_POLL_OPEN_SLOT;
}

export async function getWeeklyPollCloseSlot(): Promise<WeeklyPollSlot> {
  const row = await prisma.socialEventSchedule.findUnique({
    where: { eventType: SocialEventType.WEEKLY_POLL_CLOSE },
  });
  return row ? { weekday: row.weekday, time: row.time } : DEFAULT_WEEKLY_POLL_CLOSE_SLOT;
}

export async function getWeeklyPollSchedule(): Promise<{ open: WeeklyPollSlot; close: WeeklyPollSlot }> {
  const [open, close] = await Promise.all([getWeeklyPollOpenSlot(), getWeeklyPollCloseSlot()]);
  return { open, close };
}

/**
 * Instant UTC do horário configurado no ciclo da enquete cujo domingo-alvo é o mais
 * recente em BRT. Abertura/fechamento caem na semana seguinte a esse domingo
 * (ex.: domingo 24 → abertura na segunda 25, fechamento na quarta 27).
 */
export function getWeeklyPollActionInstant(nowUtc: Date, slot: WeeklyPollSlot): Date {
  const brt = new Date(nowUtc.getTime() - BRT_OFFSET_MS);
  const daysBackToSunday = brt.getUTCDay(); // 0=domingo
  const sundayDay = brt.getUTCDate() - daysBackToSunday;
  // Segunda imediatamente após o domingo-alvo
  const mondayAfterSunday = sundayDay + 1;
  const daysFromMondayToSlot = (slot.weekday + 6) % 7;
  const [hh, mm] = slot.time.split(":").map(Number);
  return new Date(
    Date.UTC(
      brt.getUTCFullYear(),
      brt.getUTCMonth(),
      mondayAfterSunday + daysFromMondayToSlot,
      hh,
      mm,
      0,
      0,
    ) + BRT_OFFSET_MS,
  );
}

/** True quando o horário de ação do ciclo atual (relativo ao domingo-alvo) já chegou. */
export function hasWeeklyPollActionPassed(nowUtc: Date, slot: WeeklyPollSlot): boolean {
  return nowUtc.getTime() >= getWeeklyPollActionInstant(nowUtc, slot).getTime();
}

export function formatWeeklyPollSlot(slot: WeeklyPollSlot): string {
  const day = WEEKDAY_LABELS_PT[slot.weekday] ?? "?";
  if (slot.time === "00:00") return `${day} à meia-noite`;
  return `${day} às ${slot.time}`;
}
