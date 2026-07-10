-- AlterTable
ALTER TABLE "artists" ADD COLUMN "bio_not_found_at" TIMESTAMP(3),
ADD COLUMN "metadata_not_found_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "albums" ADD COLUMN "metadata_not_found_at" TIMESTAMP(3);
