-- CreateTable
CREATE TABLE "global_genre_snapshots" (
    "id" TEXT NOT NULL,
    "week_index" INTEGER NOT NULL,
    "genre_slug" TEXT NOT NULL,
    "week_label" TEXT NOT NULL,
    "date_range" TEXT NOT NULL,
    "weekly_songs" JSONB NOT NULL,
    "weekly_artists" JSONB NOT NULL,
    "overall_songs" JSONB NOT NULL,
    "overall_artists" JSONB NOT NULL,
    "contributor_count" INTEGER NOT NULL,
    "frozen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_genre_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "global_genre_snapshots_week_genre_key" ON "global_genre_snapshots"("week_index", "genre_slug");

-- CreateIndex
CREATE INDEX "idx_global_genre_snapshots_week_index" ON "global_genre_snapshots"("week_index");
