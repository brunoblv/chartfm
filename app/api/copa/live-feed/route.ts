import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCopaLiveFeedFixtures } from "@/lib/copa-live-feed";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const data = await getCopaLiveFeedFixtures(session?.user?.id ?? null);
  return NextResponse.json(data);
}
