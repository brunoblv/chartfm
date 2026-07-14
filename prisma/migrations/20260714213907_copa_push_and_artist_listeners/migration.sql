-- CreateEnum
CREATE TYPE "CopaEditionType" AS ENUM ('NORMAL', 'PUSH');

-- AlterTable
ALTER TABLE "artists" ADD COLUMN     "monthly_listeners" INTEGER,
ADD COLUMN     "monthly_listeners_fetched_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "copa_editions" ADD COLUMN     "push_spotify_playlist_id" TEXT,
ADD COLUMN     "type" "CopaEditionType" NOT NULL DEFAULT 'NORMAL';

