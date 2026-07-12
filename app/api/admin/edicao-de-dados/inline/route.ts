import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { withReleaseDatesNotFoundCleared } from "@/app/admin/dados/lib";

export const runtime = "nodejs";

/**
 * Edição inline da tela /admin/dados: atualiza UM campo por vez (salvo ao sair
 * do campo ou, no caso do álbum, na seleção do resultado de busca). Só campos
 * da whitelist abaixo — trocar o artista de uma música continua no formulário
 * de edição completo.
 */

type Body = {
  kind?: unknown;
  id?: unknown;
  field?: unknown;
  value?: unknown;
};

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** "" → null; "YYYY-MM-DD" → Date UTC; qualquer outra coisa → undefined (inválido). */
function asDateOrNull(value: unknown): Date | null | undefined {
  const raw = asTrimmed(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Aceita array de strings ou texto separado por vírgula; normaliza e deduplica. */
function asTags(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : typeof value === "string"
      ? value.split(",")
      : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const t of raw) {
    const tag = t.trim();
    const key = tag.toLowerCase();
    if (tag && !seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags;
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const kind = body.kind;
  const field = typeof body.field === "string" ? body.field : "";

  try {
    if (kind === "music") {
      const id = asTrimmed(body.id);
      if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

      if (field === "title") {
        const title = asTrimmed(body.value);
        if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
        await prisma.song.update({
          where: { id },
          data: withReleaseDatesNotFoundCleared({ title }),
        });
        return NextResponse.json({ ok: true });
      }
      if (field === "spotifyId") {
        const spotifyId = asTrimmed(body.value);
        await prisma.song.update({
          where: { id },
          data: withReleaseDatesNotFoundCleared({ spotifyId: spotifyId || null }),
        });
        return NextResponse.json({ ok: true });
      }
      if (field === "genres") {
        const genres = asTags(body.value);
        await prisma.song.update({
          where: { id },
          data: { genres, genreSource: genres.length > 0 ? "manual" : null },
        });
        return NextResponse.json({ ok: true, genres });
      }
      if (field === "albumSpotifyId") {
        const albumSpotifyId = asTrimmed(body.value);
        if (!albumSpotifyId) {
          await prisma.song.update({
            where: { id },
            data: withReleaseDatesNotFoundCleared({ albumSpotifyId: null }),
          });
          return NextResponse.json({ ok: true, album: null });
        }
        const album = await prisma.album.findUnique({
          where: { spotifyId: albumSpotifyId },
          select: { spotifyId: true, title: true },
        });
        if (!album) return NextResponse.json({ error: "album_not_found" }, { status: 404 });
        await prisma.song.update({
          where: { id },
          data: withReleaseDatesNotFoundCleared({ albumSpotifyId: album.spotifyId, album: album.title }),
        });
        return NextResponse.json({ ok: true, album });
      }
      if (field === "singleReleaseDate" || field === "musicVideoReleaseDate") {
        const date = asDateOrNull(body.value);
        if (date === undefined) return NextResponse.json({ error: "invalid_date" }, { status: 400 });
        await prisma.song.update({
          where: { id },
          data: withReleaseDatesNotFoundCleared({ [field]: date }),
        });
        return NextResponse.json({ ok: true });
      }
    }

    if (kind === "albums") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

      if (field === "title") {
        const title = asTrimmed(body.value);
        if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
        const album = await prisma.album.update({
          where: { id },
          data: { title },
          select: { spotifyId: true },
        });
        // mantém o campo denormalizado Song.album em dia
        await prisma.song.updateMany({
          where: { albumSpotifyId: album.spotifyId },
          data: { album: title },
        });
        return NextResponse.json({ ok: true });
      }
      if (field === "releaseDate") {
        const date = asDateOrNull(body.value);
        if (date === undefined) return NextResponse.json({ error: "invalid_date" }, { status: 400 });
        await prisma.album.update({ where: { id }, data: { releaseDate: date } });
        return NextResponse.json({ ok: true });
      }
    }

    if (kind === "artists") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

      if (field === "name") {
        const name = asTrimmed(body.value);
        if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
        const artist = await prisma.artist.update({
          where: { id },
          data: { name },
          select: { spotifyId: true },
        });
        // mantém o campo denormalizado Song.artist em dia
        await prisma.song.updateMany({
          where: { artistSpotifyId: artist.spotifyId },
          data: { artist: name },
        });
        return NextResponse.json({ ok: true });
      }
      if (field === "exhibitionName") {
        const exhibitionName = asTrimmed(body.value);
        await prisma.artist.update({ where: { id }, data: { exhibitionName: exhibitionName || null } });
        return NextResponse.json({ ok: true });
      }
      if (field === "genres") {
        const genres = asTags(body.value);
        await prisma.artist.update({ where: { id }, data: { genres } });
        return NextResponse.json({ ok: true, genres });
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "conflict" }, { status: 409 });
    }
    if (msg.includes("No record was found") || msg.includes("Record to update not found")) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ error: "invalid_field" }, { status: 400 });
}
