-- CreateTable
CREATE TABLE "copa_day_playlists" (
    "id" TEXT NOT NULL,
    "copa_id" TEXT NOT NULL,
    "batch_order" INTEGER NOT NULL,
    "day_label" TEXT NOT NULL,
    "spotify_playlist_id" TEXT,
    "youtube_playlist_id" TEXT,
    "track_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copa_day_playlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "copa_day_playlists_copa_id_batch_order_key" ON "copa_day_playlists"("copa_id", "batch_order");

-- AddForeignKey
ALTER TABLE "copa_day_playlists" ADD CONSTRAINT "copa_day_playlists_copa_id_fkey" FOREIGN KEY ("copa_id") REFERENCES "copa_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
