-- CreateEnum
CREATE TYPE "album_club_phase" AS ENUM ('NOMINATIONS', 'POLL', 'RESULT', 'LISTENING', 'COMPLETED');

-- CreateTable
CREATE TABLE "album_club_rounds" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "theme" TEXT NOT NULL,
    "date_range" TEXT NOT NULL,
    "phase" "album_club_phase" NOT NULL DEFAULT 'NOMINATIONS',
    "nominations_close_at" TIMESTAMP(3) NOT NULL,
    "poll_close_at" TIMESTAMP(3) NOT NULL,
    "result_close_at" TIMESTAMP(3),
    "listening_close_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "album_club_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_club_nominations" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "album_id" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "album_club_nominations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_club_poll_votes" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nomination_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "album_club_poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_club_winners" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "nomination_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "vote_count" INTEGER NOT NULL,

    CONSTRAINT "album_club_winners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "album_club_rounds_number_key" ON "album_club_rounds"("number");

-- CreateIndex
CREATE INDEX "idx_album_club_nominations_round_id" ON "album_club_nominations"("round_id");

-- CreateIndex
CREATE UNIQUE INDEX "album_club_nominations_round_id_user_id_slot_key" ON "album_club_nominations"("round_id", "user_id", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "album_club_nominations_round_id_user_id_album_id_key" ON "album_club_nominations"("round_id", "user_id", "album_id");

-- CreateIndex
CREATE INDEX "idx_album_club_poll_votes_round_id" ON "album_club_poll_votes"("round_id");

-- CreateIndex
CREATE INDEX "idx_album_club_poll_votes_nomination_id" ON "album_club_poll_votes"("nomination_id");

-- CreateIndex
CREATE UNIQUE INDEX "album_club_poll_votes_round_id_user_id_nomination_id_key" ON "album_club_poll_votes"("round_id", "user_id", "nomination_id");

-- CreateIndex
CREATE UNIQUE INDEX "album_club_winners_nomination_id_key" ON "album_club_winners"("nomination_id");

-- CreateIndex
CREATE UNIQUE INDEX "album_club_winners_round_id_rank_key" ON "album_club_winners"("round_id", "rank");

-- AddForeignKey
ALTER TABLE "album_club_nominations" ADD CONSTRAINT "album_club_nominations_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "album_club_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_club_nominations" ADD CONSTRAINT "album_club_nominations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_club_nominations" ADD CONSTRAINT "album_club_nominations_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_club_poll_votes" ADD CONSTRAINT "album_club_poll_votes_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "album_club_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_club_poll_votes" ADD CONSTRAINT "album_club_poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_club_poll_votes" ADD CONSTRAINT "album_club_poll_votes_nomination_id_fkey" FOREIGN KEY ("nomination_id") REFERENCES "album_club_nominations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_club_winners" ADD CONSTRAINT "album_club_winners_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "album_club_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_club_winners" ADD CONSTRAINT "album_club_winners_nomination_id_fkey" FOREIGN KEY ("nomination_id") REFERENCES "album_club_nominations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: primeira rodada ativa (7 dias inscrições, 4 dias enquete, 3 dias resultado, 7 dias escuta)
INSERT INTO "album_club_rounds" (
    "id",
    "number",
    "theme",
    "date_range",
    "phase",
    "nominations_close_at",
    "poll_close_at",
    "result_close_at",
    "listening_close_at",
    "created_at",
    "updated_at"
) VALUES (
    'clube_round_001',
    1,
    'Rap Clássico dos Anos 90',
    '30 mai – 20 jun 2026',
    'NOMINATIONS',
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '11 days',
    NOW() + INTERVAL '14 days',
    NOW() + INTERVAL '21 days',
    NOW(),
    NOW()
) ON CONFLICT ("number") DO NOTHING;
