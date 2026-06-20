-- CreateTable
CREATE TABLE "global_airplay_snapshots" (
    "id" TEXT NOT NULL,
    "week_index" INTEGER NOT NULL,
    "week_label" TEXT NOT NULL,
    "date_range" TEXT NOT NULL,
    "scoring_window" TEXT NOT NULL,
    "entries" JSONB NOT NULL,
    "contributor_count" INTEGER NOT NULL,
    "frozen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_airplay_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_albums_snapshots" (
    "id" TEXT NOT NULL,
    "week_index" INTEGER NOT NULL,
    "week_label" TEXT NOT NULL,
    "date_range" TEXT NOT NULL,
    "scoring_window" TEXT NOT NULL,
    "entries" JSONB NOT NULL,
    "contributor_count" INTEGER NOT NULL,
    "frozen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_albums_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "global_airplay_snapshots_week_index_key" ON "global_airplay_snapshots"("week_index");

-- CreateIndex
CREATE INDEX "idx_global_airplay_snapshots_week_index" ON "global_airplay_snapshots"("week_index");

-- CreateIndex
CREATE UNIQUE INDEX "global_albums_snapshots_week_index_key" ON "global_albums_snapshots"("week_index");

-- CreateIndex
CREATE INDEX "idx_global_albums_snapshots_week_index" ON "global_albums_snapshots"("week_index");
