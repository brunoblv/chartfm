import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { SocialPostStatus, SocialPublishStatus } from "@prisma/client";
import { publishPost, generateAndPublishDue } from "@/lib/social/scheduler";

/**
 * Ações manuais do admin sobre um SocialPost. Reaproveita os mesmos serviços
 * de publicação das automações (lib/social/scheduler.ts, publishPost) —
 * requisito do spec: "a publicação manual deverá utilizar os mesmos serviços
 * de publicação das automações".
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { action } = body as { action: string };

  const post = await prisma.socialPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });

  switch (action) {
    case "reschedule": {
      const { scheduledAt } = body as { scheduledAt: string };
      const updated = await prisma.socialPost.update({
        where: { id },
        data: { scheduledAt: new Date(scheduledAt), status: SocialPostStatus.SCHEDULED },
      });
      return NextResponse.json({ ok: true, post: updated });
    }
    case "priority": {
      const { priority } = body as { priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW" };
      const updated = await prisma.socialPost.update({ where: { id }, data: { priority } });
      return NextResponse.json({ ok: true, post: updated });
    }
    case "caption": {
      const { platform, caption } = body as { platform: "instagram" | "facebook" | "threads" | "telegram"; caption: string };
      const field = `caption${platform.charAt(0).toUpperCase()}${platform.slice(1)}` as
        | "captionInstagram"
        | "captionFacebook"
        | "captionThreads"
        | "captionTelegram";
      const updated = await prisma.socialPost.update({ where: { id }, data: { [field]: caption } });
      return NextResponse.json({ ok: true, post: updated });
    }
    case "cancel": {
      const updated = await prisma.socialPost.update({ where: { id }, data: { status: SocialPostStatus.CANCELLED } });
      return NextResponse.json({ ok: true, post: updated });
    }
    case "publish-now": {
      await prisma.socialPost.update({ where: { id }, data: { scheduledAt: new Date(), status: SocialPostStatus.SCHEDULED } });
      await generateAndPublishDue(new Date(Date.now() + 1000));
      const fresh = await prisma.socialPost.findUnique({ where: { id }, include: { publications: true } });
      return NextResponse.json({ ok: true, post: fresh });
    }
    case "retry": {
      await prisma.socialPostPublication.updateMany({
        where: { socialPostId: id, status: SocialPublishStatus.FAILED },
        data: { status: SocialPublishStatus.PENDING, error: null },
      });
      await publishPost(id);
      const fresh = await prisma.socialPost.findUnique({ where: { id }, include: { publications: true } });
      return NextResponse.json({ ok: true, post: fresh });
    }
    default:
      return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
  }
}
