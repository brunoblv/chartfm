-- AlterTable
ALTER TABLE "Chart" ADD COLUMN "flashback_song_id" TEXT;
ALTER TABLE "Chart" ADD COLUMN "destaque_song_id" TEXT;

-- AddForeignKey
ALTER TABLE "Chart" ADD CONSTRAINT "Chart_flashback_song_id_fkey" FOREIGN KEY ("flashback_song_id") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Chart" ADD CONSTRAINT "Chart_destaque_song_id_fkey" FOREIGN KEY ("destaque_song_id") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;
