-- Data de estreia mais antiga em qualquer chart secundário da Billboard (não o Hot 100),
-- importada via scripts/billboard-genre-charts-scrape.py + scripts/import-billboard-genre-charts-debut-dates.ts.
ALTER TABLE "Song" ADD COLUMN "billboard_genre_chart_debut_date" DATE;
ALTER TABLE "Song" ADD COLUMN "billboard_genre_chart_name" TEXT;
