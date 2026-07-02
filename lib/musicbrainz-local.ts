import { Pool, type PoolClient } from "pg";

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
