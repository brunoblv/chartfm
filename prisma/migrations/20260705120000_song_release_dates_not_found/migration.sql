-- Marca músicas cujo backfill automático de datas não encontrou resultado em nenhuma fonte.
ALTER TABLE "Song" ADD COLUMN "release_dates_not_found_at" TIMESTAMP(3);
