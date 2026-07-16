import { NextResponse } from "next/server";
import { requireBruno } from "@/lib/require-bruno";
import {
  getTiktokBotInfo,
  runFollowFriday,
  runTiktokAccountCheck,
  runTiktokShareRound,
  sendTiktokBotBroadcast,
  setTiktokBotWebhook,
} from "@/lib/tiktok-bot";

// POST /api/admin/tiktok-bot/actions — ações do painel (só @bruno).
// Body: { action: "run-share" | "set-webhook" | "bot-info" | "broadcast", ... }
export async function POST(req: Request) {
  if (!(await requireBruno())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action as string | undefined;

  switch (action) {
    case "run-share": {
      const result = await runTiktokShareRound({ force: true });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    case "run-follow-friday": {
      const result = await runFollowFriday();
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    case "run-account-check": {
      const result = await runTiktokAccountCheck();
      return NextResponse.json(result);
    }
    case "set-webhook": {
      const base =
        (typeof body?.baseUrl === "string" && body.baseUrl.trim()) ||
        process.env.TELEGRAM_PUBLIC_BASE_URL?.trim() ||
        "https://chartfm.com.br";
      const result = await setTiktokBotWebhook(base);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    case "bot-info": {
      const result = await getTiktokBotInfo();
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    case "broadcast": {
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      if (!text) return NextResponse.json({ error: "texto vazio" }, { status: 400 });
      const sent = await sendTiktokBotBroadcast(text);
      return NextResponse.json({ ok: true, sent });
    }
    default:
      return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
  }
}
