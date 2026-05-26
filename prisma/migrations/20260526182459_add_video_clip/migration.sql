-- AlterEnum
ALTER TYPE "ChartType" ADD VALUE 'VIDEO_CLIP';

-- CreateTable
CREATE TABLE "user_song_video_clips" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_song_video_clips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_user_song_video_clips_user_id" ON "user_song_video_clips"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_song_video_clips_song_id" ON "user_song_video_clips"("song_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_song_video_clips_user_id_song_id_key" ON "user_song_video_clips"("user_id", "song_id");

-- AddForeignKey
ALTER TABLE "user_song_video_clips" ADD CONSTRAINT "user_song_video_clips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_song_video_clips" ADD CONSTRAINT "user_song_video_clips_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
