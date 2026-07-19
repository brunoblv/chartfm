import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { upsertSongFromSpotify } from "@/lib/mytrl-weekly-chart";
import { prisma } from "@/lib/prisma";
import { cleanArtistForLookup } from "@/lib/crownnote-song-match";
import { runWithSpotifyCrownnotePool } from "@/lib/spotify-user-charts-pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

type Body = {
  songId?: string;
  spotifyId?: string;
  crownnoteArtist?: string;
  crownnoteTitle?: string;
};

export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403, headers: NO_CACHE });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers: NO_CACHE });
  }

  if (body.songId) {
    const song = await prisma.song.findUnique({
      where: { id: body.songId },
      select: {
        id: true,
        title: true,
        artist: true,
        spotifyId: true,
        albumSpotifyId: true,
      },
    });
    if (!song) {
      return NextResponse.json({ error: "Música não encontrada no catálogo." }, { status: 404, headers: NO_CACHE });
    }
    return NextResponse.json(
      {
        ok: true,
        match: {
          songId: song.id,
          title: song.title,
          artist: song.artist,
          spotifyId: song.spotifyId,
          albumSpotifyId: song.albumSpotifyId,
        },
      },
      { headers: NO_CACHE },
    );
  }

  const spotifyId = body.spotifyId?.trim();
  if (!spotifyId) {
    return NextResponse.json({ error: "Informe songId ou spotifyId." }, { status: 400, headers: NO_CACHE });
  }

  const crownnoteArtist = body.crownnoteArtist?.trim() || "Artista";
  const crownnoteTitle = body.crownnoteTitle?.trim() || "Música";

  try {
    const song = await runWithSpotifyCrownnotePool(() =>
      upsertSongFromSpotify(spotifyId, {
        track: crownnoteTitle,
        artist: cleanArtistForLookup(crownnoteArtist),
        album: "",
      }),
    );

    const saved = await prisma.song.findUnique({
      where: { id: song.id },
      select: {
        id: true,
        title: true,
        artist: true,
        spotifyId: true,
        albumSpotifyId: true,
      },
    });

    if (!saved) {
      return NextResponse.json({ error: "Falha ao salvar música." }, { status: 500, headers: NO_CACHE });
    }

    return NextResponse.json(
      {
        ok: true,
        match: {
          songId: saved.id,
          title: saved.title,
          artist: saved.artist,
          spotifyId: saved.spotifyId,
          albumSpotifyId: saved.albumSpotifyId,
        },
      },
      { headers: NO_CACHE },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao resolver faixa do Spotify.";
    return NextResponse.json({ error: message }, { status: 400, headers: NO_CACHE });
  }
}
