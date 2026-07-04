-- AlterTable
-- postedAt guarda o instante real da publicação (usado para ordenar o feed).
-- publishedAt continua sendo a data de referência do período (semana/dia), usada nas
-- regras de pontuação/snapshot, e não deve ser alterada.
ALTER TABLE "Chart" ADD COLUMN "postedAt" TIMESTAMP(3);

-- Backfill: sem histórico do instante real de publicação, usamos publishedAt
-- como melhor aproximação disponível para paradas já existentes.
UPDATE "Chart" SET "postedAt" = "publishedAt" WHERE "postedAt" IS NULL;

ALTER TABLE "Chart" ALTER COLUMN "postedAt" SET NOT NULL;
ALTER TABLE "Chart" ALTER COLUMN "postedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Chart_postedAt_idx" ON "Chart"("postedAt");
