-- Data de estreia da música na Billboard Hot 100, importada de mhollingshead/billboard-hot-100.
ALTER TABLE "Song" ADD COLUMN "billboard_hot100_debut_date" DATE;
