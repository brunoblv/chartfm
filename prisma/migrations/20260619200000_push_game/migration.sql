-- CreateEnum
CREATE TYPE "push_phase" AS ENUM ('SUBMISSION', 'LISTENING', 'RANKING', 'RESULT');

-- CreateTable
CREATE TABLE "push_rounds" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "phase" "push_phase" NOT NULL DEFAULT 'SUBMISSION',
    "submission_ends_at" TIMESTAMP(3) NOT NULL,
    "listening_ends_at" TIMESTAMP(3) NOT NULL,
    "ranking_ends_at" TIMESTAMP(3) NOT NULL,
    "spotify_playlist_id" TEXT,
    "season" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_submissions" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "spotify_track_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_votes" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_rounds_number_key" ON "push_rounds"("number");

-- CreateIndex
CREATE UNIQUE INDEX "push_submissions_spotify_track_id_key" ON "push_submissions"("spotify_track_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_submissions_round_id_user_id_key" ON "push_submissions"("round_id", "user_id");

-- CreateIndex
CREATE INDEX "push_submissions_round_id_idx" ON "push_submissions"("round_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_votes_round_id_user_id_submission_id_key" ON "push_votes"("round_id", "user_id", "submission_id");

-- CreateIndex
CREATE INDEX "push_votes_round_id_user_id_idx" ON "push_votes"("round_id", "user_id");

-- CreateIndex
CREATE INDEX "push_votes_submission_id_idx" ON "push_votes"("submission_id");

-- AddForeignKey
ALTER TABLE "push_submissions" ADD CONSTRAINT "push_submissions_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "push_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_submissions" ADD CONSTRAINT "push_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_submissions" ADD CONSTRAINT "push_submissions_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Song"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_votes" ADD CONSTRAINT "push_votes_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "push_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_votes" ADD CONSTRAINT "push_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_votes" ADD CONSTRAINT "push_votes_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "push_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
