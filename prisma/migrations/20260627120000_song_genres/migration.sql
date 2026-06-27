-- Tags de gênero por faixa (MusicBrainz / Last.fm / fallback artista)
ALTER TABLE "Song"
ADD COLUMN IF NOT EXISTS "genres" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "genre_source" TEXT,
ADD COLUMN IF NOT EXISTS "recording_mbid" TEXT,
ADD COLUMN IF NOT EXISTS "isrc" TEXT,
ADD COLUMN IF NOT EXISTS "genres_fetched_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "idx_songs_genres_fetched_at" ON "Song" ("genres_fetched_at");
CREATE INDEX IF NOT EXISTS "idx_songs_recording_mbid" ON "Song" ("recording_mbid");
