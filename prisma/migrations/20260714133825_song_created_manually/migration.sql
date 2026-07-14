-- Marca músicas cadastradas à mão na tela de criar parada (Spotify indisponível),
-- para filtrar em /admin/dados e buscar no Spotify depois.
ALTER TABLE "Song" ADD COLUMN "created_manually" BOOLEAN NOT NULL DEFAULT false;
