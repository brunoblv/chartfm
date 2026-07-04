import { broadcastAdminAnnouncement } from "@/lib/admin-broadcast";
import { notifyCopaIncompleteSingles } from "@/lib/copa-incomplete-singles";
import type { AnnouncementTemplateId } from "@/lib/admin-announcement-templates";

export type AnnouncementDispatchInput = {
  text: string;
  targetUrl: string | null;
  notifyType: string;
  feedKind: string;
  targeted?: boolean;
  templateId?: AnnouncementTemplateId | string | null;
  contextKey?: string | null;
};

/** Envia aviso global (feed + sino) ou direcionado (só sino), conforme o modelo. */
export async function dispatchAnnouncement(input: AnnouncementDispatchInput): Promise<number> {
  if (input.targeted && input.templateId === "copa_incomplete_singles" && input.contextKey) {
    const result = await notifyCopaIncompleteSingles(
      input.contextKey,
      input.text,
      input.targetUrl ?? "/copa/meu-time",
    );
    return result.sent;
  }

  return broadcastAdminAnnouncement({
    text: input.text,
    targetUrl: input.targetUrl,
    notifyType: input.notifyType,
    feedKind: input.feedKind,
  });
}
