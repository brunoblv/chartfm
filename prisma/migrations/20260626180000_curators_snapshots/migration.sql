-- CreateTable
CREATE TABLE "curators_snapshots" (
    "id" TEXT NOT NULL,
    "week_index" INTEGER NOT NULL,
    "week_label" TEXT NOT NULL,
    "date_range" TEXT NOT NULL,
    "entries" JSONB NOT NULL,
    "frozen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curators_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "curators_snapshots_week_index_key" ON "curators_snapshots"("week_index");

-- CreateIndex
CREATE INDEX "idx_curators_snapshots_week_index" ON "curators_snapshots"("week_index");
