import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBruno } from "@/lib/require-bruno";
import { getTiktokBotAdminData, TIKTOK_NICHES } from "@/lib/tiktok-bot";

// Painel do TikTok Growth Bot — exclusivo do @bruno.

// GET /api/admin/tiktok-bot — dados do painel
export async function GET() {
  if (!(await requireBruno())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  return NextResponse.json(await getTiktokBotAdminData());
}

// PATCH /api/admin/tiktok-bot — atualiza configurações do bot
export async function PATCH(req: Request) {
  if (!(await requireBruno())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body.shareIntervalMinutes === "number" && body.shareIntervalMinutes >= 5) {
    data.shareIntervalMinutes = Math.floor(body.shareIntervalMinutes);
  }
  if (typeof body.profilesPerPost === "number" && body.profilesPerPost >= 1 && body.profilesPerPost <= 20) {
    data.profilesPerPost = Math.floor(body.profilesPerPost);
  }
  if (typeof body.welcomeMessage === "string" && body.welcomeMessage.trim()) {
    data.welcomeMessage = body.welcomeMessage.trim();
  }
  if (Array.isArray(body.adminTelegramIds)) {
    data.adminTelegramIds = body.adminTelegramIds
      .map((v) => String(v).trim())
      .filter((v) => /^\d{3,20}$/.test(v));
  }
  if ("nicheFilter" in body) {
    const v = body.nicheFilter;
    data.nicheFilter = typeof v === "string" && TIKTOK_NICHES.some((n) => n.key === v) ? v : null;
  }
  if (typeof body.followFridayEnabled === "boolean") data.followFridayEnabled = body.followFridayEnabled;
  if (typeof body.followFridayCount === "number" && body.followFridayCount >= 5 && body.followFridayCount <= 50) {
    data.followFridayCount = Math.floor(body.followFridayCount);
  }
  if (typeof body.surveyEnabled === "boolean") data.surveyEnabled = body.surveyEnabled;
  if (typeof body.confirmationEnabled === "boolean") data.confirmationEnabled = body.confirmationEnabled;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nada para atualizar" }, { status: 400 });
  }

  await prisma.tiktokBotSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });
  return NextResponse.json({ ok: true });
}
