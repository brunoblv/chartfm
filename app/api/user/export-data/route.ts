import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { buildUserDataExport } from "@/lib/user-data-export";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await buildUserDataExport(prisma, session.user.id);
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const date = new Date().toISOString().slice(0, 10);
  const handle = data.account.handle.replace(/[^a-z0-9_-]/gi, "");
  const filename = `chartfm-dados-${handle}-${date}.json`;
  const body = JSON.stringify(data, null, 2);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
