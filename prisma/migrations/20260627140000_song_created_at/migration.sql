-- Data de cadastro da faixa (prioridade no backfill de tags)
ALTER TABLE "songs"
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Estimar cadastro a partir da 1ª aparição em parada
UPDATE "songs" s
SET "created_at" = sub.first_seen
FROM (
  SELECT "song_id", MIN("created_at") AS first_seen
  FROM "chart_entries"
  GROUP BY "song_id"
) sub
WHERE s.id = sub.song_id;

CREATE INDEX IF NOT EXISTS "idx_songs_created_at" ON "songs" ("created_at" DESC);
