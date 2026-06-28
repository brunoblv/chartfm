import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { buildAlbumPath, buildArtistPath, buildSongPath } from "@/lib/music-routes";

export const adminEntityLinkStyle: CSSProperties = {
  color: "#FA243C",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 13,
};

export const adminEntityNameLinkStyle: CSSProperties = {
  color: "inherit",
  textDecoration: "none",
  fontWeight: "inherit",
};

type SongLike = {
  id: string;
  title: string;
  artist: string;
  spotifyId?: string | null;
  artistId?: number | string | null;
};

type ArtistLike = {
  id: number;
  name: string;
  spotifyId?: string | null;
};

type AlbumLike = {
  id: number;
  title: string;
  artist: { id: number; name: string };
};

export function songPagePath(song: SongLike) {
  return buildSongPath({
    id: song.id,
    title: song.title,
    artist: song.artist,
    artistId: song.artistId,
    spotifyId: song.spotifyId,
  });
}

export function artistPagePath(artist: ArtistLike) {
  return buildArtistPath(artist.name, artist.spotifyId, artist.id);
}

export function albumPagePath(album: AlbumLike) {
  return buildAlbumPath(album.title, album.artist.name, {
    artistId: album.artist.id,
    albumId: album.id,
  });
}

export function AdminSongLinks({ song }: { song: SongLike }) {
  const path = songPagePath(song);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <Link href={path} style={adminEntityLinkStyle}>
        Ver
      </Link>
      <Link href={`${path}/edit`} style={adminEntityLinkStyle}>
        Editar
      </Link>
    </span>
  );
}

export function AdminSongNameLink({ song, children }: { song: SongLike; children?: ReactNode }) {
  return (
    <Link href={songPagePath(song)} style={adminEntityNameLinkStyle}>
      {children ?? song.title}
    </Link>
  );
}

export function AdminArtistLinks({ artist }: { artist: ArtistLike }) {
  const path = artistPagePath(artist);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <Link href={path} style={adminEntityLinkStyle}>
        Ver
      </Link>
      <Link href={`/artist/${artist.id}/edit`} style={adminEntityLinkStyle}>
        Editar
      </Link>
    </span>
  );
}

export function AdminArtistNameLink({ artist, children }: { artist: ArtistLike; children?: ReactNode }) {
  return (
    <Link href={artistPagePath(artist)} style={adminEntityNameLinkStyle}>
      {children ?? artist.name}
    </Link>
  );
}

export function AdminAlbumLinks({ album }: { album: AlbumLike }) {
  const path = albumPagePath(album);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <Link href={path} style={adminEntityLinkStyle}>
        Ver
      </Link>
      <Link href={`/album/${album.artist.id}_${album.id}/edit`} style={adminEntityLinkStyle}>
        Editar
      </Link>
    </span>
  );
}

export function AdminAlbumNameLink({ album, children }: { album: AlbumLike; children?: ReactNode }) {
  return (
    <Link href={albumPagePath(album)} style={adminEntityNameLinkStyle}>
      {children ?? album.title}
    </Link>
  );
}
