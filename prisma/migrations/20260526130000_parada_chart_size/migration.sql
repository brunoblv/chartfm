-- Add chart_size to paradas, backfill from User.chart_size for primary parada
ALTER TABLE "paradas" ADD COLUMN "chart_size" INTEGER;

UPDATE "paradas" p
SET "chart_size" = u."chart_size"
FROM "User" u
WHERE u."id" = p."user_id"
  AND p."is_primary" = true
  AND u."chart_size" IS NOT NULL;
