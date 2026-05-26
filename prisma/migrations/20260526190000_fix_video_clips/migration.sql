-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "song_video_clips" (
    "id" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "song_video_clips_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "song_video_clip_votes" (
    "id" TEXT NOT NULL,
    "clip_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "song_video_clip_votes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_song_video_clip_choices" (
    "user_id" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "clip_id" TEXT NOT NULL,
    CONSTRAINT "user_song_video_clip_choices_pkey" PRIMARY KEY ("user_id", "song_id")
);

-- Drop old table if it still exists (FKs may have already been removed)
DO $$ BEGIN
  ALTER TABLE IF EXISTS "user_song_video_clips" DROP CONSTRAINT IF EXISTS "user_song_video_clips_user_id_fkey";
  ALTER TABLE IF EXISTS "user_song_video_clips" DROP CONSTRAINT IF EXISTS "user_song_video_clips_song_id_fkey";
EXCEPTION WHEN others THEN NULL;
END $$;

DROP INDEX IF EXISTS "user_song_video_clips_user_id_song_id_key";
DROP INDEX IF EXISTS "idx_user_song_video_clips_user_id";
DROP INDEX IF EXISTS "idx_user_song_video_clips_song_id";
DROP TABLE IF EXISTS "user_song_video_clips";

-- Add indexes to song_video_clips (idempotent)
CREATE INDEX IF NOT EXISTS "idx_song_video_clips_song_id" ON "song_video_clips"("song_id");
CREATE INDEX IF NOT EXISTS "idx_song_video_clips_uploaded_by" ON "song_video_clips"("uploaded_by");

-- Add foreign keys to song_video_clips (skip if already exist)
DO $$ BEGIN
  ALTER TABLE "song_video_clips" ADD CONSTRAINT "song_video_clips_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "song_video_clips" ADD CONSTRAINT "song_video_clips_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add unique index + foreign keys to song_video_clip_votes (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "song_video_clip_votes_clip_id_user_id_key" ON "song_video_clip_votes"("clip_id", "user_id");
DO $$ BEGIN
  ALTER TABLE "song_video_clip_votes" ADD CONSTRAINT "song_video_clip_votes_clip_id_fkey" FOREIGN KEY ("clip_id") REFERENCES "song_video_clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "song_video_clip_votes" ADD CONSTRAINT "song_video_clip_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add foreign keys to user_song_video_clip_choices (idempotent)
DO $$ BEGIN
  ALTER TABLE "user_song_video_clip_choices" ADD CONSTRAINT "user_song_video_clip_choices_clip_id_fkey" FOREIGN KEY ("clip_id") REFERENCES "song_video_clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "user_song_video_clip_choices" ADD CONSTRAINT "user_song_video_clip_choices_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "user_song_video_clip_choices" ADD CONSTRAINT "user_song_video_clip_choices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
