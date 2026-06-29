-- Data de lançamento do single (MusicBrainz), distinta da data do álbum
ALTER TABLE "Song" ADD COLUMN "single_release_date" DATE;
ALTER TABLE "Song" ADD COLUMN "single_release_date_fetched_at" TIMESTAMP(3);
