/**
 * Auditoria persistente do site — frases em português para /admin/logs.
 * Fire-and-forget: nunca deve derrubar o fluxo principal.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type SiteAuditTrigger = "manual" | "automatic";

export type SiteAuditInput = {
  action: string;
  summary: string;
  trigger?: SiteAuditTrigger;
  userId?: string | null;
  userName?: string | null;
  userHandle?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  spotifyCalls?: number;
  meta?: Prisma.InputJsonValue;
};

export async function recordSiteAudit(input: SiteAuditInput): Promise<void> {
  try {
    await prisma.siteAuditLog.create({
      data: {
        action: input.action,
        summary: input.summary.slice(0, 4000),
        trigger: input.trigger ?? "manual",
        userId: input.userId ?? null,
        userName: input.userName ?? null,
        userHandle: input.userHandle ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        spotifyCalls: input.spotifyCalls ?? 0,
        meta: input.meta ?? undefined,
      },
    });
  } catch (err) {
    console.error("[site-audit] falha ao gravar:", err);
  }
}

function displayWho(opts: {
  userName?: string | null;
  userHandle?: string | null;
}): string {
  const name = (opts.userName ?? "").trim();
  const handle = (opts.userHandle ?? "").trim();
  if (name && handle) return `${name} (@${handle})`;
  if (name) return name;
  if (handle) return `@${handle}`;
  return "Alguém";
}

function consumoSpotify(n: number): string {
  if (n <= 0) return "não consumiu consultas ao Spotify";
  if (n === 1) return "consumiu 1 consulta ao Spotify";
  return `consumiu ${n} consultas ao Spotify`;
}

export function auditParadaCreateSummary(opts: {
  userName?: string | null;
  userHandle?: string | null;
  paradaName: string;
  weekLabel: string;
  entryCount: number;
  spotifyCalls: number;
}): string {
  const who = displayWho(opts);
  const faixas =
    opts.entryCount === 1 ? "1 faixa" : `${opts.entryCount} faixas`;
  return `${who} criou a parada "${opts.paradaName}" (${opts.weekLabel}, ${faixas}) e ${consumoSpotify(opts.spotifyCalls)}.`;
}

export function auditParadaUpdateSummary(opts: {
  userName?: string | null;
  userHandle?: string | null;
  paradaName: string;
  weekLabel: string;
  entryCount: number;
  spotifyCalls: number;
}): string {
  const who = displayWho(opts);
  const faixas =
    opts.entryCount === 1 ? "1 faixa" : `${opts.entryCount} faixas`;
  return `${who} atualizou a parada "${opts.paradaName}" (${opts.weekLabel}, ${faixas}) e ${consumoSpotify(opts.spotifyCalls)}.`;
}

const RETENTION_DAYS = 60;

export async function purgeOldSiteAuditLogs(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.siteAuditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}
