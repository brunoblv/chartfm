import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { parseSongSlug, slugify } from "@/lib/music-routes";
import type { ParsedSongSlug } from "@/lib/music-routes";
import { Shell } from "@/components/layout/Shell";
import { SongEditClient } from "./SongEditClient";

async function resolveSongId(parsed: ParsedSongSlug): Promise<string | null> {
  if (parsed.type === "spotify") {
    const song = await prisma.song.findUnique({ where: { spotifyId: parsed.spotifyId }, select: { id: true } });
    return song?.id ?? null;
  }
  if (parsed.type === "internalId") {
    const song = await prisma.song.findUnique({ where: { id: parsed.songId }, select: { id: true } });
    return song?.id ?? null;
  }
  if (parsed.type === "artistSongIds") {
    const song = await prisma.song.findFirst({
      where: { id: parsed.songId, artistRef: { id: parsed.artistId } },
      select: { id: true },
    });
    if (song?.id) return song.id;
    const fallback = await prisma.song.findUnique({ where: { id: parsed.songId }, select: { id: true } });
    return fallback?.id ?? null;
  }

  const firstArtistWord = parsed.artistSlug.split("-").find((w) => w.length > 0) ?? parsed.artistSlug;
  const candidates = await prisma.song.findMany({
    where: { artist: { contains: firstArtistWord, mode: "insensitive" } },
    select: { id: true, title: true, artist: true },
  });
  const match = candidates.find((s) => slugify(s.title) === parsed.titleSlug && slugify(s.artist) === parsed.artistSlug);
  return match?.id ?? null;
}

export default async function SongEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p>Você precisa entrar para editar músicas.</p>
        </div>
      </Shell>
    );
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p>Acesso permitido somente para DEV e ADMIN.</p>
        </div>
      </Shell>
    );
  }

  const { slug } = await params;
  const parsed = parseSongSlug(slug);
  if (!parsed) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p>Música não encontrada.</p>
        </div>
      </Shell>
    );
  }

  const songId = await resolveSongId(parsed);
  if (!songId) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p>Música não encontrada.</p>
        </div>
      </Shell>
    );
  }

  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: {
      id: true,
      title: true,
      exhibitionName: true,
      artist: true,
      album: true,
      artistSpotifyId: true,
      albumSpotifyId: true,
      spotifyId: true,
    },
  });
  if (!song) {
    return (
      <Shell title="">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p>Música não encontrada.</p>
        </div>
      </Shell>
    );
  }

  let artistSpotifyIdForEdit = song.artistSpotifyId?.trim() ?? "";
  if (!artistSpotifyIdForEdit) {
    const guessed = await prisma.artist.findFirst({
      where: { name: { equals: song.artist, mode: "insensitive" } },
      select: { spotifyId: true },
    });
    artistSpotifyIdForEdit = guessed?.spotifyId ?? "";
  }

  return (
    <Shell title="">
      <div style={{ maxWidth: 760, margin: "32px auto", padding: "0 20px 48px" }}>
        <Link href={`/song/${slug}`} style={{ color: "#86868B", textDecoration: "none", fontSize: 14 }}>
          ← Voltar para a música
        </Link>
        <h1 style={{ fontSize: 30, margin: "12px 0 4px" }}>Editar música</h1>
        <p style={{ color: "#86868B", marginTop: 0 }}>Disponível apenas para perfis DEV e ADMIN.</p>
        <SongEditClient
          initialSong={{
            id: song.id,
            slug,
            title: song.title,
            romanization: song.exhibitionName ?? "",
            artist: song.artist,
            album: song.album ?? "",
            artistSpotifyId: artistSpotifyIdForEdit,
            albumSpotifyId: song.albumSpotifyId ?? "",
          }}
        />
      </div>
    </Shell>
  );
}
