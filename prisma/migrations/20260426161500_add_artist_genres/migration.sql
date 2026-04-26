-- Add genres array to artists
ALTER TABLE "artists"
ADD COLUMN IF NOT EXISTS "genres" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
