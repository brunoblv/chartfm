-- CreateEnum
CREATE TYPE "clip_type" AS ENUM ('OFFICIAL', 'LYRIC_VIDEO', 'VISUALIZER', 'LIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "CopaStatus" AS ENUM ('REGISTRATION', 'GROUP_STAGE', 'KNOCKOUT', 'FINISHED');

-- CreateEnum
CREATE TYPE "CopaPhase" AS ENUM ('GROUP', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL');

-- CreateEnum
CREATE TYPE "CopaFixtureStatus" AS ENUM ('UPCOMING', 'LIVE', 'DONE');

-- AlterTable
ALTER TABLE "song_video_clips" ADD COLUMN "clip_type" "clip_type" NOT NULL DEFAULT 'OFFICIAL',
ADD COLUMN "published_at" TIMESTAMP(3),
ADD COLUMN "youtube_id" TEXT;

-- CreateTable
CREATE TABLE "copa_editions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "CopaStatus" NOT NULL DEFAULT 'REGISTRATION',
    "max_participants" INTEGER NOT NULL DEFAULT 8,
    "artists_per_user" INTEGER NOT NULL DEFAULT 8,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copa_editions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copa_participants" (
    "id" TEXT NOT NULL,
    "copa_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "copa_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copa_artists" (
    "id" TEXT NOT NULL,
    "copa_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "group_letter" TEXT NOT NULL,
    "slot_in_group" INTEGER NOT NULL,
    "artist_spotify_id" TEXT,
    "artist_name" TEXT NOT NULL,
    "artist_image" TEXT,
    "artist_color" TEXT NOT NULL DEFAULT '#FA243C',
    "artist_initials" TEXT NOT NULL DEFAULT '??',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copa_artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copa_singles" (
    "id" TEXT NOT NULL,
    "copa_artist_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "song_id" TEXT,
    "song_name" TEXT NOT NULL,

    CONSTRAINT "copa_singles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copa_fixtures" (
    "id" TEXT NOT NULL,
    "copa_id" TEXT NOT NULL,
    "phase" "CopaPhase" NOT NULL,
    "group_letter" TEXT,
    "round" INTEGER,
    "match_index" INTEGER NOT NULL,
    "artist_a_id" TEXT NOT NULL,
    "artist_b_id" TEXT NOT NULL,
    "single_a_idx" INTEGER NOT NULL DEFAULT 0,
    "single_b_idx" INTEGER NOT NULL DEFAULT 0,
    "status" "CopaFixtureStatus" NOT NULL DEFAULT 'UPCOMING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "copa_fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copa_votes" (
    "id" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copa_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "copa_participants_copa_id_user_id_key" ON "copa_participants"("copa_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "copa_artists_copa_id_artist_spotify_id_key" ON "copa_artists"("copa_id", "artist_spotify_id");

-- CreateIndex
CREATE UNIQUE INDEX "copa_artists_copa_id_group_letter_slot_in_group_key" ON "copa_artists"("copa_id", "group_letter", "slot_in_group");

-- CreateIndex
CREATE UNIQUE INDEX "copa_singles_copa_artist_id_slot_index_key" ON "copa_singles"("copa_artist_id", "slot_index");

-- CreateIndex
CREATE INDEX "copa_fixtures_copa_id_phase_idx" ON "copa_fixtures"("copa_id", "phase");

-- CreateIndex
CREATE INDEX "copa_fixtures_copa_id_group_letter_idx" ON "copa_fixtures"("copa_id", "group_letter");

-- CreateIndex
CREATE UNIQUE INDEX "copa_votes_fixture_id_user_id_key" ON "copa_votes"("fixture_id", "user_id");

-- AddForeignKey
ALTER TABLE "copa_participants" ADD CONSTRAINT "copa_participants_copa_id_fkey" FOREIGN KEY ("copa_id") REFERENCES "copa_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copa_participants" ADD CONSTRAINT "copa_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copa_artists" ADD CONSTRAINT "copa_artists_copa_id_fkey" FOREIGN KEY ("copa_id") REFERENCES "copa_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copa_artists" ADD CONSTRAINT "copa_artists_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copa_singles" ADD CONSTRAINT "copa_singles_copa_artist_id_fkey" FOREIGN KEY ("copa_artist_id") REFERENCES "copa_artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copa_fixtures" ADD CONSTRAINT "copa_fixtures_copa_id_fkey" FOREIGN KEY ("copa_id") REFERENCES "copa_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copa_fixtures" ADD CONSTRAINT "copa_fixtures_artist_a_id_fkey" FOREIGN KEY ("artist_a_id") REFERENCES "copa_artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copa_fixtures" ADD CONSTRAINT "copa_fixtures_artist_b_id_fkey" FOREIGN KEY ("artist_b_id") REFERENCES "copa_artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copa_votes" ADD CONSTRAINT "copa_votes_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "copa_fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copa_votes" ADD CONSTRAINT "copa_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
