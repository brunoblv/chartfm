-- CreateEnum
CREATE TYPE "entity_page_kind" AS ENUM ('ARTIST', 'ALBUM', 'SONG');

-- CreateTable
CREATE TABLE "daily_chart_song_stats" (
    "id" TEXT NOT NULL,
    "snapshot_day" DATE NOT NULL,
    "current_week_idx" INTEGER NOT NULL,
    "weekly_buckets" JSONB NOT NULL,
    "built_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_chart_song_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_page_snapshots" (
    "id" TEXT NOT NULL,
    "kind" "entity_page_kind" NOT NULL,
    "entity_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "snapshot_day" DATE NOT NULL,
    "built_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_page_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_chart_song_stats_snapshot_day_key" ON "daily_chart_song_stats"("snapshot_day");

-- CreateIndex
CREATE UNIQUE INDEX "entity_page_snapshots_kind_entity_key_snapshot_day_key" ON "entity_page_snapshots"("kind", "entity_key", "snapshot_day");

-- CreateIndex
CREATE INDEX "idx_entity_page_snapshots_lookup" ON "entity_page_snapshots"("kind", "entity_key", "snapshot_day" DESC);
