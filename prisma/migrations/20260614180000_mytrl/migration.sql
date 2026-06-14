-- AlterTable
ALTER TABLE "User" ADD COLUMN "spotify_access_token" TEXT,
ADD COLUMN "spotify_refresh_token" TEXT,
ADD COLUMN "spotify_token_expires_at" TIMESTAMP(3),
ADD COLUMN "spotify_user_id" TEXT,
ADD COLUMN "spotify_new_hits_playlist_id" TEXT;

-- CreateTable
CREATE TABLE "mytrl_snapshots" (
    "id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "week_index" INTEGER NOT NULL,
    "week_label" TEXT NOT NULL,
    "date_range" TEXT NOT NULL,
    "entries" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mytrl_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mytrl_snapshots_weekday_week_index_idx" ON "mytrl_snapshots"("weekday", "week_index" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "mytrl_snapshots_weekday_week_index_key" ON "mytrl_snapshots"("weekday", "week_index");
