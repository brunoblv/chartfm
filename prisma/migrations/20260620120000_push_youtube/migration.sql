-- AlterTable
ALTER TABLE "User" ADD COLUMN "youtube_access_token" TEXT,
ADD COLUMN "youtube_refresh_token" TEXT,
ADD COLUMN "youtube_token_expires_at" TIMESTAMP(3),
ADD COLUMN "youtube_channel_id" TEXT,
ADD COLUMN "youtube_channel_handle" TEXT;

-- AlterTable
ALTER TABLE "push_rounds" ADD COLUMN "youtube_playlist_id" TEXT;
