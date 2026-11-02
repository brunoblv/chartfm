import { NextResponse } from "next/server";
import { getCriticsFMCatalog } from "@/lib/criticsfm-data";
import { parseCriticsFMQuery, queryCriticsFMAlbums } from "@/lib/criticsfm-query";

export async function GET(request: Request) {
  const query = parseCriticsFMQuery(new URL(request.url).searchParams);
  const page = queryCriticsFMAlbums(await getCriticsFMCatalog(), query);
  return NextResponse.json(page, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
