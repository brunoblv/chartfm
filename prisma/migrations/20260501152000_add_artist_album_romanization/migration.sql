ALTER TABLE "artists"
ADD COLUMN IF NOT EXISTS "exhibition_name" TEXT;

ALTER TABLE "albums"
ADD COLUMN IF NOT EXISTS "exhibition_name" TEXT;
