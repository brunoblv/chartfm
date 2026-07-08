-- CreateEnum
CREATE TYPE "song_flag_status" AS ENUM ('PENDING', 'DISMISSED');

-- CreateTable
CREATE TABLE "song_flags" (
    "id" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT,
    "status" "song_flag_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "song_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "song_flags_song_id_idx" ON "song_flags"("song_id");

-- CreateIndex
CREATE INDEX "song_flags_status_idx" ON "song_flags"("status");

-- AddForeignKey
ALTER TABLE "song_flags" ADD CONSTRAINT "song_flags_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_flags" ADD CONSTRAINT "song_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
