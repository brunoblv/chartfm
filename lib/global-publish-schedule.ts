import { prisma } from "@/lib/prisma";
import { SocialEventType } from "@prisma/client";
import { DEFAULT_GLOBAL_PUBLISH_SLOT, type GlobalPublishSlot } from "@/lib/chart-week";

/**
 * Dia da semana + horário (BRT) configurados em /admin/parada-global para a publicação
 * da Parada Global (mesmo registro usado pela agenda de postagens, evento GLOBAL100_PUBLISHED).
 * O corte de envio das paradas pessoais é sempre 1h antes deste horário (getGlobalSnapshotDeadline).
 */
export async function getGlobalPublishSlot(): Promise<GlobalPublishSlot> {
  const row = await prisma.socialEventSchedule.findUnique({
    where: { eventType: SocialEventType.GLOBAL100_PUBLISHED },
  });
  return row ? { weekday: row.weekday, time: row.time } : DEFAULT_GLOBAL_PUBLISH_SLOT;
}

/** Horário de publicação da próxima Parada Global já formatado, para exibição no admin. */
export function formatGlobalPublishSlot(slot: GlobalPublishSlot): string {
  const WEEKDAY_LABELS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  return `${WEEKDAY_LABELS[slot.weekday] ?? "?"} às ${slot.time}`;
}
