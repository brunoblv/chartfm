-- Data de cadastro da faixa (prioridade no backfill de tags)
ALTER TABLE "Song"
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Estimar cadastro a partir da 1ª aparição em parada
UPDATE "Song" s
SET "created_at" = sub.first_seen
FROM (
  SELECT "songId", MIN("created_at") AS first_seen
  FROM "ChartEntry"
  GROUP BY "songId"
) sub
WHERE s.id = sub."songId";

CREATE INDEX IF NOT EXISTS "idx_songs_created_at" ON "Song" ("created_at" DESC);
