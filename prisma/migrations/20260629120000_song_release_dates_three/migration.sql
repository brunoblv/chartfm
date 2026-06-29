ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "music_video_release_date" DATE;
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "youtube_release_date" DATE;
