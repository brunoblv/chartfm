import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isPrivilegedRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getDiskMtvClipPreview } from "@/lib/disk-mtv-clip-preview";
import { isVideoparadaModuleEnabled } from "@/lib/videoparada-dev-only";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensurePrivileged() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

/** Preview da parada Disk MTV sem filtro de clipe (pré-refill). */
export async function GET(req: NextRequest) {
  if (!isVideoparadaModuleEnabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const guard = await ensurePrivileged();
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.status === 401 ? "unauthorized" : "forbidden" },
      { status: guard.status },
    );
  }

  const weekRaw = req.nextUrl.searchParams.get("week");
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const weekIndex =
    weekRaw && /^\d{6}$/.test(weekRaw) ? Number(weekRaw) : undefined;
  const limit =
    limitRaw && /^\d+$/.test(limitRaw) ? Number(limitRaw) : undefined;

  try {
    const preview = await getDiskMtvClipPreview({ weekIndex, limit });
    return NextResponse.json({ ok: true, ...preview });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
