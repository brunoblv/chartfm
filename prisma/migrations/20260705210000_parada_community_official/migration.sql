-- AlterTable
ALTER TABLE "paradas" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "paradas" ADD COLUMN "is_community_official" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "idx_paradas_deleted_at" ON "paradas"("deleted_at");
