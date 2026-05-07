import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { parseSongSlug } from "@/lib/music-routes";
import { resolveSongIdFromParsed } from "@/lib/resolve-song-id";
import { Shell } from "@/components/layout/Shell";
import { AddSongManual } from "@/components/admin/AddSongManual";
import { SongEditClient } from "./SongEditClient";

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

  const songId = await resolveSongIdFromParsed(parsed);
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
        <AddSongManual />
        <SongEditClient
          initialSong={{
            id: song.id,
            slug,
            title: song.title,
            spotifyId: song.spotifyId ?? "",
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
