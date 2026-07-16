import { NextRequest, NextResponse } from "next/server";
import { handleTiktokBotUpdate, tiktokBotConfigured, tiktokBotWebhookSecret, type TgUpdate } from "@/lib/tiktok-bot";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/tiktok-bot/webhook — recebe updates do Telegram (TikTok Growth Bot).
// Validado pelo header X-Telegram-Bot-Api-Secret-Token (TIKTOK_BOT_WEBHOOK_SECRET).
export async function POST(req: NextRequest) {
  if (!tiktokBotConfigured()) {
    return NextResponse.json({ error: "Bot não configurado" }, { status: 503 });
  }

  const secret = tiktokBotWebhookSecret();
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  if (!update) return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  try {
    await handleTiktokBotUpdate(update);
  } catch (err) {
    // Sempre 200 para o Telegram não reentregar o update em loop.
    console.error("[tiktok-bot/webhook]", err);
  }
  return NextResponse.json({ ok: true });
}
