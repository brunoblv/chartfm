-- CreateEnum
CREATE TYPE "ParadaCadence" AS ENUM ('WEEKLY', 'DAILY');

-- AlterTable
ALTER TABLE "paradas" ADD COLUMN "cadence" "ParadaCadence" NOT NULL DEFAULT 'WEEKLY';
