-- CreateTable
CREATE TABLE "weekly_releases" (
    "id" TEXT NOT NULL,
    "week_label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_release_albums" (
    "id" TEXT NOT NULL,
    "weekly_release_id" TEXT NOT NULL,
    "album_id" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "weekly_release_albums_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weekly_release_albums_weekly_release_id_album_id_key" ON "weekly_release_albums"("weekly_release_id", "album_id");

-- CreateIndex
CREATE INDEX "idx_weekly_release_albums_release_id" ON "weekly_release_albums"("weekly_release_id");

-- AddForeignKey
ALTER TABLE "weekly_release_albums" ADD CONSTRAINT "weekly_release_albums_weekly_release_id_fkey" FOREIGN KEY ("weekly_release_id") REFERENCES "weekly_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_release_albums" ADD CONSTRAINT "weekly_release_albums_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
