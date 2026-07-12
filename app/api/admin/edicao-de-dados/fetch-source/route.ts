import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { fetchForAlbum, fetchForArtist, fetchForSong, type FetchResult } from "@/lib/edicao-de-dados-source-fetch";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Botões por fonte da tela /admin/dados: consulta UMA fonte para UM registro
 * e preenche os campos que estão vazios. Devolve o que foi encontrado e o
 * que foi aplicado, para o admin conferir. Lógica de busca compartilhada com
 * o backfill em lote em lib/edicao-de-dados-source-fetch.ts.
 */

type Source = "lastfm" | "spotify" | "musicbrainz" | "wikipedia";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    kind?: unknown;
    id?: unknown;
    source?: unknown;
    force?: unknown;
  };
  const source = body.source as Source;
  if (source !== "lastfm" && source !== "spotify" && source !== "musicbrainz" && source !== "wikipedia") {
    return NextResponse.json({ error: "invalid_source" }, { status: 400 });
  }
  const force = body.force === true;

  try {
    let result: FetchResult | { error: string };
    if (body.kind === "music" && typeof body.id === "string" && body.id.trim()) {
      result = await fetchForSong(body.id.trim(), source, { force });
    } else if (body.kind === "albums" && Number.isInteger(Number(body.id))) {
      result = await fetchForAlbum(Number(body.id), source, { force });
    } else if (body.kind === "artists" && Number.isInteger(Number(body.id))) {
      result = await fetchForArtist(Number(body.id), source, { force });
    } else {
      return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
    }

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch_failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
