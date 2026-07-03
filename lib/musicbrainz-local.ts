import { Pool, type PoolClient } from "pg";
import { parseMusicBrainzDate } from "@/lib/musicbrainz";

export type MusicBrainzLocalConfig = {
  connectionString?: string;
};

export type ResolveRecordingMbidInput = {
  title: string;
  artist: string;
  spotifyId?: string | null;
  isrc?: string | null;
  recordingMbid?: string | null;
};

export type ResolveRecordingMbidResult = {
  mbid: string;
  source: "cache" | "isrc" | "spotify" | "search";
  recordingName?: string;
};

let pool: Pool | null = null;

function mbConnectionString(): string {
  return (
    process.env.MUSICBRAINZ_DATABASE_URL?.trim() ||
    "postgresql://musicbrainz:musicbrainz@127.0.0.1:5432/musicbrainz_db"
  );
}

export function getMusicBrainzPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: mbConnectionString() });
  }
  return pool;
}

export async function closeMusicBrainzPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

async function queryOne<T>(
  client: Pool | PoolClient,
  sql: string,
  params: unknown[],
): Promise<T | null> {
  const { rows } = await client.query<T>(sql, params);
  return rows[0] ?? null;
}

function normalizeIsrc(value: string): string {
  return value.trim().toUpperCase();
}

function spotifyUrls(trackId: string): string[] {
  const id = trackId.trim();
  if (!id) return [];
  return [`https://open.spotify.com/track/${id}`, `https://open.spotify.com/track/${id}/`];
}

export async function findRecordingMbidByIsrc(
  isrc: string,
  client: Pool | PoolClient = getMusicBrainzPool(),
): Promise<ResolveRecordingMbidResult | null> {
  const code = normalizeIsrc(isrc);
  if (!code) return null;

  const row = await queryOne<{ gid: string; name: string }>(
    client,
    `
      SELECT r.gid::text AS gid, r.name
      FROM musicbrainz.isrc i
      JOIN musicbrainz.recording r ON r.id = i.recording
      WHERE i.isrc = $1
      ORDER BY r.id
      LIMIT 1
    `,
    [code],
  );

  if (!row?.gid) return null;
  return { mbid: row.gid, source: "isrc", recordingName: row.name };
}

export async function findRecordingMbidBySpotifyTrackId(
  spotifyTrackId: string,
  client: Pool | PoolClient = getMusicBrainzPool(),
): Promise<ResolveRecordingMbidResult | null> {
  const urls = spotifyUrls(spotifyTrackId);
  if (!urls.length) return null;

  const row = await queryOne<{ gid: string; name: string }>(
    client,
    `
      SELECT r.gid::text AS gid, r.name
      FROM musicbrainz.url u
      JOIN musicbrainz.l_recording_url lru ON lru.entity1 = u.id
      JOIN musicbrainz.recording r ON r.id = lru.entity0
      WHERE u.url = ANY($1::text[])
      ORDER BY r.id
      LIMIT 1
    `,
    [urls],
  );

  if (!row?.gid) return null;
  return { mbid: row.gid, source: "spotify", recordingName: row.name };
}

export async function findRecordingMbidByTitleArtist(
  title: string,
  artist: string,
  client: Pool | PoolClient = getMusicBrainzPool(),
): Promise<ResolveRecordingMbidResult | null> {
  const t = title.trim();
  const a = artist.trim();
  if (!t || !a) return null;

  const row = await queryOne<{ gid: string; name: string }>(
    client,
    `
      SELECT r.gid::text AS gid, r.name
      FROM musicbrainz.recording r
      JOIN musicbrainz.artist_credit ac ON ac.id = r.artist_credit
      JOIN musicbrainz.artist_credit_name acn ON acn.artist_credit = ac.id
      JOIN musicbrainz.artist ar ON ar.id = acn.artist
      WHERE lower(r.name) = lower($1)
        AND lower(ar.name) = lower($2)
      ORDER BY acn.position, r.id
      LIMIT 1
    `,
    [t, a],
  );

  if (!row?.gid) return null;
  return { mbid: row.gid, source: "search", recordingName: row.name };
}

/** Mesma ordem do WS: MBID cache → ISRC → Spotify URL → título+artista. */
export async function resolveRecordingMbidFromLocalDb(
  input: ResolveRecordingMbidInput,
  client: Pool | PoolClient = getMusicBrainzPool(),
): Promise<ResolveRecordingMbidResult | null> {
  const cached = input.recordingMbid?.trim();
  if (cached) {
    const row = await queryOne<{ gid: string; name: string }>(
      client,
      `
        SELECT gid::text AS gid, name
        FROM musicbrainz.recording
        WHERE gid = $1::uuid
        LIMIT 1
      `,
      [cached],
    );
    if (row?.gid) {
      return { mbid: row.gid, source: "cache", recordingName: row.name };
    }
  }

  if (input.isrc) {
    const byIsrc = await findRecordingMbidByIsrc(input.isrc, client);
    if (byIsrc) return byIsrc;
  }

  if (input.spotifyId) {
    const bySpotify = await findRecordingMbidBySpotifyTrackId(input.spotifyId, client);
    if (bySpotify) return bySpotify;
  }

  return findRecordingMbidByTitleArtist(input.title, input.artist, client);
}

const SINGLE_PRIMARY_TYPE_ID = 2;

export type MusicBrainzLocalReleaseDates = {
  singleReleaseDate: Date | null;
  musicVideoReleaseDate: Date | null;
};

export type ReleaseDateHint = { title?: string; artist?: string };

type ReleaseRow = {
  release_id: number;
  release_comment: string | null;
  date_year: number | null;
  date_month: number | null;
  date_day: number | null;
  has_music_video_track: boolean;
};

function parseMbDateParts(
  year: number | null | undefined,
  month: number | null | undefined,
  day: number | null | undefined,
): Date | null {
  if (year == null) return null;
  const y = String(year).padStart(4, "0");
  const m = month != null ? String(month).padStart(2, "0") : null;
  const d = day != null ? String(day).padStart(2, "0") : null;
  if (m && d) return parseMusicBrainzDate(`${y}-${m}-${d}`);
  if (m) return parseMusicBrainzDate(`${y}-${m}`);
  return parseMusicBrainzDate(y);
}

function earliestDate(dates: Date[]): Date | null {
  if (!dates.length) return null;
  return dates.reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
}

type ReleaseDisambiguationKind = "audio-single" | "music-video" | "ignore";

function isLyricVideoText(...parts: Array<string | null | undefined>): boolean {
  const text = parts.filter(Boolean).join(" ").toLowerCase();
  return text.includes("lyric video") || text.includes("lyric-video");
}

function releaseKind(row: Pick<ReleaseRow, "release_comment" | "has_music_video_track">): ReleaseDisambiguationKind {
  const d = row.release_comment?.trim().toLowerCase() ?? "";
  if (isLyricVideoText(d)) return "ignore";
  if (d.includes("music video") || d.includes("music-video")) return "music-video";
  if (row.has_music_video_track) return "music-video";
  return "audio-single";
}

function resolveReleaseDates(rows: ReleaseRow[]): MusicBrainzLocalReleaseDates {
  const byRelease = new Map<number, ReleaseRow & { dates: Date[] }>();

  for (const row of rows) {
    const date = parseMbDateParts(row.date_year, row.date_month, row.date_day);
    let entry = byRelease.get(row.release_id);
    if (!entry) {
      entry = { ...row, dates: [] };
      byRelease.set(row.release_id, entry);
    }
    if (date) entry.dates.push(date);
  }

  const single: Date[] = [];
  const musicVideo: Date[] = [];

  for (const rel of byRelease.values()) {
    if (!rel.dates.length) continue;
    const kind = releaseKind(rel);
    if (kind === "ignore") continue;
    if (kind === "music-video") musicVideo.push(...rel.dates);
    else single.push(...rel.dates);
  }

  return {
    singleReleaseDate: earliestDate(single),
    musicVideoReleaseDate: earliestDate(musicVideo),
  };
}

function sqlNormalizeText(columnOrParam: string): string {
  return `translate(lower(${columnOrParam}), E'‐‑‒–—−', '------')`;
}

async function findSingleReleaseGroupIdsByTitleArtist(
  title: string,
  artist: string,
  client: Pool | PoolClient,
): Promise<number[]> {
  const t = title.trim();
  const a = artist.trim();
  if (!t || !a) return [];

  const titleMatch = `${sqlNormalizeText("rg.name")} = ${sqlNormalizeText("$1")}`;
  const artistMatch = `${sqlNormalizeText("ar.name")} = ${sqlNormalizeText("$2")}`;

  const { rows } = await client.query<{ id: number }>(
    `
      SELECT DISTINCT rg.id
      FROM musicbrainz.release_group rg
      JOIN musicbrainz.artist_credit ac ON ac.id = rg.artist_credit
      JOIN musicbrainz.artist_credit_name acn ON acn.artist_credit = ac.id
      JOIN musicbrainz.artist ar ON ar.id = acn.artist
      WHERE rg.type = $3
        AND ${titleMatch}
        AND ${artistMatch}
      ORDER BY rg.id
      LIMIT 5
    `,
    [t, a, SINGLE_PRIMARY_TYPE_ID],
  );
  if (rows.length) return rows.map((r) => r.id);

  const trackTitleMatch = `${sqlNormalizeText("rec.name")} = ${sqlNormalizeText("$1")}`;
  const byTrack = await client.query<{ id: number }>(
    `
      SELECT DISTINCT rg.id
      FROM musicbrainz.release_group rg
      JOIN musicbrainz.artist_credit ac ON ac.id = rg.artist_credit
      JOIN musicbrainz.artist_credit_name acn ON acn.artist_credit = ac.id
      JOIN musicbrainz.artist ar ON ar.id = acn.artist
      JOIN musicbrainz.release rel ON rel.release_group = rg.id
      JOIN musicbrainz.medium m ON m.release = rel.id
      JOIN musicbrainz.track tr ON tr.medium = m.id
      JOIN musicbrainz.recording rec ON rec.id = tr.recording
      WHERE rg.type = $3
        AND ${artistMatch}
        AND ${trackTitleMatch}
      ORDER BY rg.id
      LIMIT 5
    `,
    [t, a, SINGLE_PRIMARY_TYPE_ID],
  );
  return byTrack.rows.map((r) => r.id);
}

async function fetchSingleReleaseRows(
  recordingGid: string,
  hint: ReleaseDateHint | undefined,
  client: Pool | PoolClient,
): Promise<ReleaseRow[]> {
  const rec = await queryOne<{ id: number }>(
    client,
    `SELECT id FROM musicbrainz.recording WHERE gid = $1::uuid LIMIT 1`,
    [recordingGid],
  );
  if (!rec) return [];

  const extraGroupIds = hint?.title && hint?.artist
    ? await findSingleReleaseGroupIdsByTitleArtist(hint.title, hint.artist, client)
    : [];

  const { rows } = await client.query<ReleaseRow>(
    `
      WITH rec AS (
        SELECT id FROM musicbrainz.recording WHERE gid = $1::uuid
      ),
      single_rg AS (
        SELECT DISTINCT rg.id
        FROM rec
        JOIN musicbrainz.l_recording_release_group lrrg ON lrrg.entity0 = rec.id
        JOIN musicbrainz.release_group rg ON rg.id = lrrg.entity1
        WHERE rg.type = $2
        UNION
        SELECT DISTINCT rg.id
        FROM rec
        JOIN musicbrainz.track t ON t.recording = rec.id
        JOIN musicbrainz.medium m ON m.id = t.medium
        JOIN musicbrainz.release rel ON rel.id = m.release
        JOIN musicbrainz.release_group rg ON rg.id = rel.release_group
        WHERE rg.type = $2
        UNION
        SELECT DISTINCT rel.release_group AS id
        FROM rec
        JOIN musicbrainz.l_recording_release lrr ON lrr.entity0 = rec.id
        JOIN musicbrainz.release rel ON rel.id = lrr.entity1
        JOIN musicbrainz.release_group rg ON rg.id = rel.release_group
        WHERE rg.type = $2
        UNION
        SELECT unnest($3::int[]) AS id
      ),
      target_releases AS (
        SELECT DISTINCT rel.id, rel.comment AS release_comment
        FROM single_rg
        JOIN musicbrainz.release rel ON rel.release_group = single_rg.id
      ),
      release_dates AS (
        SELECT tr.id AS release_id, tr.release_comment,
               rc.date_year, rc.date_month, rc.date_day
        FROM target_releases tr
        JOIN musicbrainz.release_country rc ON rc.release = tr.id
        WHERE rc.date_year IS NOT NULL
        UNION ALL
        SELECT tr.id, tr.release_comment,
               ruc.date_year, ruc.date_month, ruc.date_day
        FROM target_releases tr
        JOIN musicbrainz.release_unknown_country ruc ON ruc.release = tr.id
        WHERE ruc.date_year IS NOT NULL
      ),
      video_flags AS (
        SELECT tr.id AS release_id,
          BOOL_OR(
            rec_t.video = true
            AND NOT (
              lower(rec_t.name) LIKE '%lyric video%'
              OR lower(rec_t.comment) LIKE '%lyric video%'
              OR lower(t.name) LIKE '%lyric video%'
            )
          ) AS has_music_video_track
        FROM target_releases tr
        JOIN musicbrainz.medium m ON m.release = tr.id
        JOIN musicbrainz.track t ON t.medium = m.id
        JOIN musicbrainz.recording rec_t ON rec_t.id = t.recording
        GROUP BY tr.id
      )
      SELECT rd.release_id,
             rd.release_comment,
             rd.date_year,
             rd.date_month,
             rd.date_day,
             COALESCE(vf.has_music_video_track, false) AS has_music_video_track
      FROM release_dates rd
      LEFT JOIN video_flags vf ON vf.release_id = rd.release_id
    `,
    [recordingGid, SINGLE_PRIMARY_TYPE_ID, extraGroupIds],
  );

  return rows;
}

/** Datas de single e videoclipe via Postgres local (mesma lógica do WS). */
export async function getMusicBrainzReleaseDatesFromLocalDb(
  mbid: string,
  hint?: ReleaseDateHint,
  client: Pool | PoolClient = getMusicBrainzPool(),
): Promise<MusicBrainzLocalReleaseDates> {
  const id = mbid.trim();
  const empty: MusicBrainzLocalReleaseDates = {
    singleReleaseDate: null,
    musicVideoReleaseDate: null,
  };
  if (!id) return empty;

  const rows = await fetchSingleReleaseRows(id, hint, client);
  if (!rows.length) return empty;
  return resolveReleaseDates(rows);
}
