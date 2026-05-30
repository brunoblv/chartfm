import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { createClubeRound, getClubeAdminData, type ClubeRoundSchedulePatch } from "@/lib/clube-album";
import { buildScheduleFromWednesday, parseDateInput, schedulePreview } from "@/lib/clube-schedule";

export async function GET() {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const data = await getClubeAdminData();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = (await req.json()) as {
    theme?: string;
    wednesdayDate?: string;
    schedule?: ClubeRoundSchedulePatch;
    preview?: boolean;
  };

  if (body.preview && body.wednesdayDate) {
    const wednesday = parseDateInput(body.wednesdayDate);
    if (!wednesday) return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    const schedule = buildScheduleFromWednesday(wednesday);
    return NextResponse.json({
      dateRange: schedule.dateRange,
      preview: schedulePreview(schedule),
      iso: {
        nominationsOpenAt: schedule.nominationsOpenAt.toISOString(),
        nominationsCloseAt: schedule.nominationsCloseAt.toISOString(),
        pollCloseAt: schedule.pollCloseAt.toISOString(),
        listeningCloseAt: schedule.listeningCloseAt.toISOString(),
      },
    });
  }

  const result = await createClubeRound(body.theme ?? "", {
    wednesdayDate: body.wednesdayDate,
    schedule: body.schedule,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.id });
}
