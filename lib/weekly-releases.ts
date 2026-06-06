import { prisma } from "@/lib/prisma";

export type WeeklyReleaseAlbumInfo = {
  albumId: number;
  title: string;
  artist: string;
  year: string;
  coverUrl: string | null;
  spotifyUrl: string | null;
  order: number;
};

export type WeeklyReleaseData = {
  id: string;
  weekLabel: string;
  albums: WeeklyReleaseAlbumInfo[];
};

export type WeeklyReleaseAdminItem = {
  id: string;
  weekLabel: string;
  active: boolean;
  albumCount: number;
  createdAt: string;
  albums: WeeklyReleaseAlbumInfo[];
};

const albumSelect = {
  id: true,
  title: true,
  exhibitionName: true,
  coverUrl: true,
  spotifyUrl: true,
  releaseDate: true,
  artist: { select: { name: true, exhibitionName: true } },
} as const;

function mapAlbum(
  row: {
    album: {
      id: number;
      title: string;
      exhibitionName: string | null;
      coverUrl: string | null;
      spotifyUrl: string | null;
      releaseDate: Date | null;
      artist: { name: string; exhibitionName: string | null };
    };
    order: number;
  },
): WeeklyReleaseAlbumInfo {
  return {
    albumId: row.album.id,
    title: row.album.exhibitionName ?? row.album.title,
    artist: row.album.artist.exhibitionName ?? row.album.artist.name,
    year: row.album.releaseDate?.getFullYear().toString() ?? "—",
    coverUrl: row.album.coverUrl,
    spotifyUrl: row.album.spotifyUrl,
    order: row.order,
  };
}

export async function getActiveWeeklyRelease(): Promise<WeeklyReleaseData | null> {
  const release = await prisma.weeklyRelease.findFirst({
    where: { active: true },
    include: {
      albums: {
        orderBy: { order: "asc" },
        include: { album: { select: albumSelect } },
      },
    },
  });
  if (!release) return null;
  return {
    id: release.id,
    weekLabel: release.weekLabel,
    albums: release.albums.map(mapAlbum),
  };
}

export async function getWeeklyReleaseHistory(): Promise<WeeklyReleaseData[]> {
  const releases = await prisma.weeklyRelease.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      albums: {
        orderBy: { order: "asc" },
        include: { album: { select: albumSelect } },
      },
    },
  });
  return releases.map((r) => ({
    id: r.id,
    weekLabel: r.weekLabel,
    albums: r.albums.map(mapAlbum),
  }));
}

export async function getWeeklyReleaseAdminData(): Promise<WeeklyReleaseAdminItem[]> {
  const releases = await prisma.weeklyRelease.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      albums: {
        orderBy: { order: "asc" },
        include: { album: { select: albumSelect } },
      },
    },
  });
  return releases.map((r) => ({
    id: r.id,
    weekLabel: r.weekLabel,
    active: r.active,
    albumCount: r.albums.length,
    createdAt: r.createdAt.toISOString(),
    albums: r.albums.map(mapAlbum),
  }));
}

export async function createWeeklyRelease(
  weekLabel: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!weekLabel.trim()) return { ok: false, error: "week_label_required" };
  const release = await prisma.weeklyRelease.create({
    data: { weekLabel: weekLabel.trim(), active: false },
  });
  return { ok: true, id: release.id };
}

export async function updateWeeklyReleaseLabel(
  id: string,
  weekLabel: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!weekLabel.trim()) return { ok: false, error: "week_label_required" };
  await prisma.weeklyRelease.update({ where: { id }, data: { weekLabel: weekLabel.trim() } });
  return { ok: true };
}

export async function activateWeeklyRelease(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await prisma.$transaction([
    prisma.weeklyRelease.updateMany({ where: { active: true }, data: { active: false } }),
    prisma.weeklyRelease.update({ where: { id }, data: { active: true } }),
  ]);
  return { ok: true };
}

export async function deactivateWeeklyRelease(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await prisma.weeklyRelease.update({ where: { id }, data: { active: false } });
  return { ok: true };
}

export async function deleteWeeklyRelease(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await prisma.weeklyRelease.delete({ where: { id } });
  return { ok: true };
}

export async function addAlbumToRelease(
  releaseId: string,
  albumId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.weeklyReleaseAlbum.count({
    where: { weeklyReleaseId: releaseId },
  });
  try {
    await prisma.weeklyReleaseAlbum.create({
      data: { weeklyReleaseId: releaseId, albumId, order: existing },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "album_already_added" };
  }
}

export async function removeAlbumFromRelease(
  releaseId: string,
  albumId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await prisma.weeklyReleaseAlbum.deleteMany({
    where: { weeklyReleaseId: releaseId, albumId },
  });
  return { ok: true };
}

export async function reorderReleaseAlbums(
  releaseId: string,
  albumIds: number[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  await prisma.$transaction(
    albumIds.map((albumId, i) =>
      prisma.weeklyReleaseAlbum.updateMany({
        where: { weeklyReleaseId: releaseId, albumId },
        data: { order: i },
      }),
    ),
  );
  return { ok: true };
}
