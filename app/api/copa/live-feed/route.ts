import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCopaLiveFeedFixtures } from "@/lib/copa-live-feed";
import { getServerLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const locale = await getServerLocale();
  const data = await getCopaLiveFeedFixtures(session?.user?.id ?? null, locale);
  return NextResponse.json(data);
}
