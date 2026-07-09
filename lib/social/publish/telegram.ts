import { sendTelegramPhoto, sendTelegramMessage, isTelegramConfigured } from "@/lib/telegram";
import type { PublishResult } from "@/lib/social/publish/shared";

/** Reaproveita o envio já existente do Telegram (lib/telegram.ts) — sem reinventar. */
export async function publishToTelegram(caption: string, targetUrl: string, imagePng: Buffer | null): Promise<PublishResult> {
  if (!isTelegramConfigured()) return { ok: false, error: "Telegram não configurado" };

  const sent = imagePng ? await sendTelegramPhoto(imagePng, caption, targetUrl) : await sendTelegramMessage(caption, targetUrl);
  if (!sent) return { ok: false, error: "Falha ao enviar para o Telegram" };
  // A API sendPhoto/sendMessage do bot não retorna facilmente o message_id ao chamador atual;
  // como o envio foi confirmado (ok=true), registramos sem external id.
  return { ok: true };
}
