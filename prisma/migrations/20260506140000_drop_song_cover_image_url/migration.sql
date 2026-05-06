-- Capa oficial apenas em Album.cover_url; evita URLs duplicadas/inconsistentes em Song
ALTER TABLE "Song" DROP COLUMN IF EXISTS "cover_image_url";
