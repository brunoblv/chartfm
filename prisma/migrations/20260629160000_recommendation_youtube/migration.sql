-- AlterTable
ALTER TABLE "song_recommendations" ALTER COLUMN "song_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "song_recommendations" ADD COLUMN "youtube_id" TEXT;
ALTER TABLE "song_recommendations" ADD COLUMN "yt_title" TEXT;
ALTER TABLE "song_recommendations" ADD COLUMN "yt_channel" TEXT;
