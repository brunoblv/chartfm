-- AlterTable
ALTER TABLE "album_club_rounds" ADD COLUMN "nominations_open_at" TIMESTAMP(3);

UPDATE "album_club_rounds"
SET "nominations_open_at" = "nominations_close_at" - INTERVAL '14 hours'
WHERE "nominations_open_at" IS NULL;

ALTER TABLE "album_club_rounds" ALTER COLUMN "nominations_open_at" SET NOT NULL;
