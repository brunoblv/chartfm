-- AlterTable
ALTER TABLE "artists" ADD COLUMN "bio" TEXT;

-- AlterTable
ALTER TABLE "songs" ADD COLUMN "editorial_note" TEXT;

-- CreateTable
CREATE TABLE "weekly_editorials" (
    "id" SERIAL NOT NULL,
    "week_index" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_editorials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weekly_editorials_week_index_key" ON "weekly_editorials"("week_index");
