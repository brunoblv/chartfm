-- AlterTable
ALTER TABLE "paradas" ADD COLUMN "auto_decay" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "paradas" ADD COLUMN "source_lastfm_users" TEXT[] DEFAULT ARRAY[]::TEXT[];
