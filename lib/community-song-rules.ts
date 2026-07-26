import type { Prisma } from "@prisma/client";

/**
 * Regras especiais de elegibilidade de músicas por comunidade.
 * Disk MTV: só músicas com clipe oficial entram na parada.
 */

export const DISK_MTV_COMMUNITY_SLUG = "disk-mtv";

/** Comunidades cuja parada oficial exige clipe (MV). */
export function communityRequiresMusicVideo(slug: string): boolean {
  return slug === DISK_MTV_COMMUNITY_SLUG;
}

export type SongMusicVideoEvidence = {
  musicVideoReleaseDate: Date | null;
  youtubeReleaseDate: Date | null;
  /** true se existe SongVideoClip OFFICIAL com youtubeId */
  hasOfficialVideoClip: boolean;
};

/**
 * Evidência de clipe oficial no catálogo:
 * data de MV/YouTube resolvida, ou clipe OFFICIAL cadastrado.
 * Lyric video / visualizer sozinhos não contam.
 */
export function songHasOfficialMusicVideo(song: SongMusicVideoEvidence): boolean {
  return Boolean(
    song.musicVideoReleaseDate ||
      song.youtubeReleaseDate ||
      song.hasOfficialVideoClip,
  );
}

/** Filtro Prisma: Song com evidência de clipe oficial. */
export const songRequiresMusicVideoWhere: Prisma.SongWhereInput = {
  OR: [
    { musicVideoReleaseDate: { not: null } },
    { youtubeReleaseDate: { not: null } },
    {
      videoClips: {
        some: {
          clipType: "OFFICIAL",
          youtubeId: { not: null },
        },
      },
    },
  ],
};
