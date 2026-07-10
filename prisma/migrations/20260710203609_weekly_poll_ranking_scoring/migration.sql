-- Votação da semana passa de aprovação (toggle) para ranking (drag-and-drop, pontos 20->1).
-- Votos antigos não têm posição e não fazem sentido no novo modelo: são descartados.
TRUNCATE TABLE "weekly_spotlight_votes";

-- AlterTable
ALTER TABLE "weekly_spotlight_votes" ADD COLUMN "position" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "weekly_spotlight_options" ADD COLUMN "total_points" INTEGER NOT NULL DEFAULT 0;
