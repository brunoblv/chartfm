-- CreateTable
CREATE TABLE "parade_video_clip_configs" (
    "id" TEXT NOT NULL,
    "chart_kind" TEXT NOT NULL,
    "week_index" INTEGER NOT NULL,
    "song_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "video_url" TEXT,
    "platform" TEXT,
    "start_seconds" DOUBLE PRECISION,
    "end_seconds" DOUBLE PRECISION,
    "use_auto_chorus" BOOLEAN NOT NULL DEFAULT true,
    "force_debut" BOOLEAN NOT NULL DEFAULT false,
    "skip_auto_video" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parade_video_clip_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_parade_video_clip_configs_chart_week" ON "parade_video_clip_configs"("chart_kind", "week_index");

-- CreateIndex
CREATE INDEX "idx_parade_video_clip_configs_song_id" ON "parade_video_clip_configs"("song_id");

-- CreateIndex
CREATE UNIQUE INDEX "parade_video_clip_configs_chart_week_song_key" ON "parade_video_clip_configs"("chart_kind", "week_index", "song_id");

-- AddForeignKey
ALTER TABLE "parade_video_clip_configs" ADD CONSTRAINT "parade_video_clip_configs_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
