-- Enquetes Melhor da Semana / Flashback também por comunidade (só membros).
-- Índices parciais: 1 poll global por semana + 1 poll por comunidade por semana.

ALTER TABLE "weekly_spotlight_polls" ADD COLUMN "community_id" TEXT;

DROP INDEX IF EXISTS "weekly_spotlight_polls_week_index_key";

CREATE UNIQUE INDEX "weekly_spotlight_polls_global_week_index_key"
  ON "weekly_spotlight_polls"("week_index")
  WHERE "community_id" IS NULL;

CREATE UNIQUE INDEX "weekly_spotlight_polls_week_index_community_id_key"
  ON "weekly_spotlight_polls"("week_index", "community_id")
  WHERE "community_id" IS NOT NULL;

CREATE INDEX "weekly_spotlight_polls_week_index_idx"
  ON "weekly_spotlight_polls"("week_index");

CREATE INDEX "weekly_spotlight_polls_community_id_status_idx"
  ON "weekly_spotlight_polls"("community_id", "status");

ALTER TABLE "weekly_spotlight_polls"
  ADD CONSTRAINT "weekly_spotlight_polls_community_id_fkey"
  FOREIGN KEY ("community_id") REFERENCES "Community"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
