import { getWikipediaSongInfo } from "@/lib/wikipedia";
import {
  findRecordingMbidBySpotifyTrackId,
  getMusicBrainzReleaseDates,
  searchRecordingMbid,
} from "@/lib/musicbrainz";

/**
 * Núcleo compartilhado do backfill de datas de single/clipe — usado tanto pelo
 * botão manual em lote (app/api/admin/edicao-de-dados/backfill-dates/route.ts)
 * quanto pelo cron noturno (lib/catalog-nightly-backfill.ts). Antes cada um
 * tinha sua própria cópia da mesma lógica; agora as duas chamam esta função e
 * só decidem o que fazer com o resultado (persistir, formatar log, contar).
 *
 * Ordem das fontes: Wikipedia primeiro — quando diverge do que já está salvo,
 * a da Wikipedia VALE E SOBRESCREVE (fonte mais confiável para essas datas).
 * MusicBrainz só entra para o que ainda faltar depois da Wikipedia.
 */

export type SongReleaseDatesInput = {
  title: string;
  artist: string;
  spotifyId: string | null;
  recordingMbid: string | null;
  singleReleaseDate: Date | null;
  musicVideoReleaseDate: Date | null;
};

export type SongReleaseDatesResolved = {
  /** Só os campos que mudaram — pronto pra espalhar num `data` do Prisma. */
  changes: {
    singleReleaseDate?: Date;
    musicVideoReleaseDate?: Date;
    recordingMbid?: string;
  };
  /** De onde veio cada data alterada, para log/UI. */
  sources: {
    singleReleaseDate?: "wikipedia" | "musicbrainz";
    musicVideoReleaseDate?: "wikipedia" | "musicbrainz";
  };
  changedAnything: boolean;
};

function sameDay(a: Date | null, b: Date): boolean {
  return a != null && a.getTime() === b.getTime();
}

export async function resolveSongReleaseDates(song: SongReleaseDatesInput): Promise<SongReleaseDatesResolved> {
  const changes: SongReleaseDatesResolved["changes"] = {};
  const sources: SongReleaseDatesResolved["sources"] = {};
  let single = song.singleReleaseDate;
  let mv = song.musicVideoReleaseDate;

  // 1) Wikipedia — quando divergente, a data da Wikipedia vale e sobrescreve.
  const wiki = await getWikipediaSongInfo(song.title, song.artist).catch(() => null);
  if (wiki?.singleReleaseDate && !sameDay(single, wiki.singleReleaseDate)) {
    changes.singleReleaseDate = wiki.singleReleaseDate;
    sources.singleReleaseDate = "wikipedia";
    single = wiki.singleReleaseDate;
  }
  if (wiki?.musicVideoReleaseDate && !sameDay(mv, wiki.musicVideoReleaseDate)) {
    changes.musicVideoReleaseDate = wiki.musicVideoReleaseDate;
    sources.musicVideoReleaseDate = "wikipedia";
    mv = wiki.musicVideoReleaseDate;
  }

  // 2) MusicBrainz — só para o que ainda estiver faltando.
  if (!single || !mv) {
    let mbid = song.recordingMbid?.trim() || null;
    if (!mbid && song.spotifyId) mbid = await findRecordingMbidBySpotifyTrackId(song.spotifyId).catch(() => null);
    if (!mbid) mbid = await searchRecordingMbid(song.title, song.artist).catch(() => null);

    if (mbid) {
      if (!song.recordingMbid?.trim()) changes.recordingMbid = mbid;
      const dates = await getMusicBrainzReleaseDates(mbid, { title: song.title, artist: song.artist }).catch(() => ({
        singleReleaseDate: null,
        musicVideoReleaseDate: null,
      }));
      if (!single && dates.singleReleaseDate) {
        changes.singleReleaseDate = dates.singleReleaseDate;
        sources.singleReleaseDate = "musicbrainz";
      }
      if (!mv && dates.musicVideoReleaseDate) {
        changes.musicVideoReleaseDate = dates.musicVideoReleaseDate;
        sources.musicVideoReleaseDate = "musicbrainz";
      }
    }
  }

  return { changes, sources, changedAnything: Object.keys(changes).length > 0 };
}
