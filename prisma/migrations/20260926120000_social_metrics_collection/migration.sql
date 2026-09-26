-- A tabela nunca foi populada, mas limpa duplicatas/órfãos por segurança antes do índice único e da FK.
DELETE FROM "social_post_metrics"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("social_post_id", "platform") "id"
  FROM "social_post_metrics"
  ORDER BY "social_post_id", "platform", "fetched_at" DESC
);
DELETE FROM "social_post_metrics" m
WHERE NOT EXISTS (SELECT 1 FROM "social_posts" p WHERE p."id" = m."social_post_id");

-- AlterTable
ALTER TABLE "social_post_metrics"
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "permalink" TEXT,
  ADD COLUMN "saves" INTEGER,
  ADD COLUMN "views" INTEGER,
  ADD COLUMN "raw" JSONB,
  ADD COLUMN "error" TEXT;

-- DropIndex
DROP INDEX "idx_social_post_metrics_post_platform";

-- CreateIndex
CREATE UNIQUE INDEX "idx_social_post_metrics_post_platform" ON "social_post_metrics"("social_post_id", "platform");

-- AddForeignKey
ALTER TABLE "social_post_metrics" ADD CONSTRAINT "social_post_metrics_social_post_id_fkey" FOREIGN KEY ("social_post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "social_account_snapshots" (
    "id" TEXT NOT NULL,
    "platform" "SocialCredentialPlatform" NOT NULL,
    "date" DATE NOT NULL,
    "followers" INTEGER,
    "follows" INTEGER,
    "media_count" INTEGER,
    "reach" INTEGER,
    "views" INTEGER,
    "profile_views" INTEGER,
    "accounts_engaged" INTEGER,
    "interactions" INTEGER,
    "raw" JSONB,
    "error" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_account_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_account_snapshots_platform_date_key" ON "social_account_snapshots"("platform", "date");
