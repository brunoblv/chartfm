import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { LogsAdminClient } from "./logs-admin-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const AUDIT_PAGE_SIZE = 40;
const SYSTEM_ERROR_PAGE_SIZE = 40;

export type SourceFilter = "all" | "user" | "system" | "anonymous";
export type StatusFilter = "all" | "ok" | "error";

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    source?: string;
    status?: string;
    auditPage?: string;
    errorPage?: string;
    errorQ?: string;
  }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <Shell title="Admin" subtitle="Acesso"><div>Faça login para acessar.</div></Shell>;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return <Shell title="Admin" subtitle="Acesso"><div>Acesso negado.</div></Shell>;

  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const source: SourceFilter = sp.source === "user" || sp.source === "system" || sp.source === "anonymous" ? sp.source : "all";
  const status: StatusFilter = sp.status === "ok" || sp.status === "error" ? sp.status : "all";
  const pageRaw = parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const skip = (page - 1) * PAGE_SIZE;
  const auditPageRaw = parseInt(sp.auditPage ?? "1", 10);
  const auditPage = Number.isFinite(auditPageRaw) && auditPageRaw > 0 ? auditPageRaw : 1;
  const auditSkip = (auditPage - 1) * AUDIT_PAGE_SIZE;
  const errorQuery = (sp.errorQ ?? "").trim();
  const errorPageRaw = parseInt(sp.errorPage ?? "1", 10);
  const errorPage = Number.isFinite(errorPageRaw) && errorPageRaw > 0 ? errorPageRaw : 1;
  const errorSkip = (errorPage - 1) * SYSTEM_ERROR_PAGE_SIZE;

  const where = {
    ...(query ? { path: { contains: query, mode: "insensitive" as const } } : {}),
    ...(source !== "all" ? { source } : {}),
    ...(status !== "all" ? { ok: status === "ok" } : {}),
  };

  const auditWhere = query
    ? {
        OR: [
          { summary: { contains: query, mode: "insensitive" as const } },
          { userName: { contains: query, mode: "insensitive" as const } },
          { userHandle: { contains: query, mode: "insensitive" as const } },
          { action: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const errorWhere = errorQuery
    ? {
        OR: [
          { scope: { contains: errorQuery, mode: "insensitive" as const } },
          { message: { contains: errorQuery, mode: "insensitive" as const } },
          { path: { contains: errorQuery, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, logs, auditTotal, auditLogs, errorTotal, errorLogs] = await Promise.all([
    prisma.apiRequestLog.count({ where }),
    prisma.apiRequestLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.siteAuditLog.count({ where: auditWhere }),
    prisma.siteAuditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: "desc" },
      skip: auditSkip,
      take: AUDIT_PAGE_SIZE,
    }),
    prisma.systemErrorLog.count({ where: errorWhere }),
    prisma.systemErrorLog.findMany({
      where: errorWhere,
      orderBy: { createdAt: "desc" },
      skip: errorSkip,
      take: SYSTEM_ERROR_PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / AUDIT_PAGE_SIZE));
  const errorTotalPages = Math.max(1, Math.ceil(errorTotal / SYSTEM_ERROR_PAGE_SIZE));

  const rows = logs.map((l) => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    method: l.method,
    path: l.path,
    source: l.source,
    ok: l.ok,
    statusCode: l.statusCode,
    errorMessage: l.errorMessage,
    userName: l.userName,
    userHandle: l.userHandle,
  }));

  const auditRows = auditLogs.map((a) => ({
    id: a.id,
    createdAt: a.createdAt.toISOString(),
    action: a.action,
    summary: a.summary,
    trigger: a.trigger,
    userName: a.userName,
    userHandle: a.userHandle,
    spotifyCalls: a.spotifyCalls,
    entityType: a.entityType,
    entityId: a.entityId,
  }));

  const errorRows = errorLogs.map((e) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    scope: e.scope,
    message: e.message,
    stack: e.stack,
    path: e.path,
  }));

  return (
    <Shell title="Logs de API" subtitle="Auditoria do site: quem fez o quê e quanto consumiu">
      <LogsAdminClient
        auditLogs={auditRows}
        auditPage={auditPage}
        auditTotalPages={auditTotalPages}
        auditTotal={auditTotal}
        logs={rows}
        page={page}
        totalPages={totalPages}
        total={total}
        query={query}
        source={source}
        status={status}
        errorLogs={errorRows}
        errorPage={errorPage}
        errorTotalPages={errorTotalPages}
        errorTotal={errorTotal}
        errorQuery={errorQuery}
      />
    </Shell>
  );
}
