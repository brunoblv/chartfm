-- CreateTable
CREATE TABLE "paradas" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paradas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_paradas_user_id" ON "paradas"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "paradas_user_id_sort_order_key" ON "paradas"("user_id", "sort_order");

-- AddForeignKey
ALTER TABLE "paradas" ADD CONSTRAINT "paradas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill paradas from User
INSERT INTO "paradas" ("id", "user_id", "name", "logo", "genres", "is_primary", "sort_order", "created_at", "updated_at")
SELECT
    'cm' || substr(md5(u."id" || ':parada:0'), 1, 23),
    u."id",
    COALESCE(NULLIF(TRIM(u."paradaNome"), ''), 'Parada de ' || SPLIT_PART(u."name", ' ', 1)),
    u."parada_logo",
    COALESCE(u."genres", ARRAY[]::TEXT[]),
    true,
    0,
    NOW(),
    NOW()
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "paradas" p WHERE p."user_id" = u."id");

-- Add parada_id column (nullable first)
ALTER TABLE "Chart" ADD COLUMN "parada_id" TEXT;

-- Link charts to primary parada
UPDATE "Chart" c
SET "parada_id" = p."id"
FROM "paradas" p
WHERE p."user_id" = c."userId" AND p."is_primary" = true AND p."sort_order" = 0;

-- Fallback: any parada for user
UPDATE "Chart" c
SET "parada_id" = (
    SELECT p."id" FROM "paradas" p WHERE p."user_id" = c."userId" ORDER BY p."sort_order" ASC LIMIT 1
)
WHERE c."parada_id" IS NULL;

ALTER TABLE "Chart" ALTER COLUMN "parada_id" SET NOT NULL;

-- Drop old unique, add new
DROP INDEX IF EXISTS "Chart_userId_weekIndex_key";
CREATE UNIQUE INDEX "Chart_parada_id_weekIndex_key" ON "Chart"("parada_id", "weekIndex");
CREATE INDEX "idx_charts_parada_id" ON "Chart"("parada_id");

-- AddForeignKey
ALTER TABLE "Chart" ADD CONSTRAINT "Chart_parada_id_fkey" FOREIGN KEY ("parada_id") REFERENCES "paradas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
