-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "album_type" AS ENUM ('SINGLE', 'EP', 'ALBUM', 'COMPILATION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable artists
CREATE TABLE IF NOT EXISTS "artists" (
    "id" SERIAL NOT NULL,
    "spotify_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "spotify_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "artists_spotify_id_key" ON "artists"("spotify_id");
CREATE INDEX IF NOT EXISTS "idx_artists_spotify_id" ON "artists"("spotify_id");

-- CreateTable albums
CREATE TABLE IF NOT EXISTS "albums" (
    "id" SERIAL NOT NULL,
    "spotify_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist_spotify_id" TEXT NOT NULL,
    "album_type" "album_type",
    "release_date" DATE,
    "cover_url" TEXT,
    "spotify_url" TEXT,
    "total_tracks" INTEGER,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "albums_spotify_id_key" ON "albums"("spotify_id");
CREATE INDEX IF NOT EXISTS "idx_albums_spotify_id" ON "albums"("spotify_id");
CREATE INDEX IF NOT EXISTS "idx_albums_artist_spotify_id" ON "albums"("artist_spotify_id");

DO $$ BEGIN
  ALTER TABLE "albums" ADD CONSTRAINT "albums_artist_spotify_id_fkey"
    FOREIGN KEY ("artist_spotify_id") REFERENCES "artists"("spotify_id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add Spotify columns to Song
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "spotify_id" TEXT;
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "artist_spotify_id" TEXT;
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "album_spotify_id" TEXT;
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "duration_ms" INTEGER;
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "preview_url" TEXT;
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "spotify_url" TEXT;
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "track_number" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "Song_spotify_id_key" ON "Song"("spotify_id");
CREATE INDEX IF NOT EXISTS "idx_songs_spotify_id" ON "Song"("spotify_id");
CREATE INDEX IF NOT EXISTS "idx_songs_artist_spotify_id" ON "Song"("artist_spotify_id");
CREATE INDEX IF NOT EXISTS "idx_songs_album_spotify_id" ON "Song"("album_spotify_id");

DO $$ BEGIN
  ALTER TABLE "Song" ADD CONSTRAINT "Song_artist_spotify_id_fkey"
    FOREIGN KEY ("artist_spotify_id") REFERENCES "artists"("spotify_id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Song" ADD CONSTRAINT "Song_album_spotify_id_fkey"
    FOREIGN KEY ("album_spotify_id") REFERENCES "albums"("spotify_id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable song_feats
CREATE TABLE IF NOT EXISTS "song_feats" (
    "id" SERIAL NOT NULL,
    "song_spotify_id" TEXT NOT NULL,
    "artist_spotify_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "song_feats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "song_feats_song_spotify_id_artist_spotify_id_key"
    ON "song_feats"("song_spotify_id", "artist_spotify_id");
CREATE INDEX IF NOT EXISTS "idx_song_feats_song_spotify_id" ON "song_feats"("song_spotify_id");
CREATE INDEX IF NOT EXISTS "idx_song_feats_artist_spotify_id" ON "song_feats"("artist_spotify_id");

DO $$ BEGIN
  ALTER TABLE "song_feats" ADD CONSTRAINT "song_feats_song_spotify_id_fkey"
    FOREIGN KEY ("song_spotify_id") REFERENCES "Song"("spotify_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "song_feats" ADD CONSTRAINT "song_feats_artist_spotify_id_fkey"
    FOREIGN KEY ("artist_spotify_id") REFERENCES "artists"("spotify_id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add Spotify columns to ChartEntry
ALTER TABLE "ChartEntry" ADD COLUMN IF NOT EXISTS "song_spotify_id" TEXT;
ALTER TABLE "ChartEntry" ADD COLUMN IF NOT EXISTS "album_spotify_id" TEXT;
ALTER TABLE "ChartEntry" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ChartEntry" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "idx_chart_entries_chart_position" ON "ChartEntry"("chartId", "position");
CREATE INDEX IF NOT EXISTS "idx_chart_entries_song_id" ON "ChartEntry"("songId");
CREATE INDEX IF NOT EXISTS "idx_chart_entries_song_position" ON "ChartEntry"("songId", "position");
CREATE INDEX IF NOT EXISTS "idx_chart_entries_song_spotify_id" ON "ChartEntry"("song_spotify_id");
CREATE INDEX IF NOT EXISTS "idx_chart_entries_album_spotify_id" ON "ChartEntry"("album_spotify_id");

DO $$ BEGIN
  ALTER TABLE "ChartEntry" ADD CONSTRAINT "ChartEntry_song_spotify_id_fkey"
    FOREIGN KEY ("song_spotify_id") REFERENCES "Song"("spotify_id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChartEntry" ADD CONSTRAINT "ChartEntry_album_spotify_id_fkey"
    FOREIGN KEY ("album_spotify_id") REFERENCES "albums"("spotify_id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
