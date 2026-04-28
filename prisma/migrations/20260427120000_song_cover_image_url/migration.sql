-- Capa personalizada por música (ex.: importações sem Spotify)
ALTER TABLE "Song" ADD COLUMN "cover_image_url" TEXT;

UPDATE "Song"
SET
  "cover_image_url" = '/covers/tvxq-beautiful-you-the-secret-code.png',
  album = COALESCE(NULLIF(TRIM(album), ''), 'The Secret Code')
WHERE LOWER(TRIM(title)) = 'beautiful you'
  AND artist = 'TVXQ!';
