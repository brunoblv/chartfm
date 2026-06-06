import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import {
  createWeeklyRelease,
  getWeeklyReleaseAdminData,
} from "@/lib/weekly-releases";

export async function GET() {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const releases = await getWeeklyReleaseAdminData();
  return NextResponse.json({ releases });
}

export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as { weekLabel?: string };
  const result = await createWeeklyRelease(body.weekLabel ?? "");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.id });
}
