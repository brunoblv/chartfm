-- CreateTable
CREATE TABLE "weekly_spotlight_polls" (
    "id" TEXT NOT NULL,
    "week_index" INTEGER NOT NULL,
    "week_label" TEXT NOT NULL,
    "date_range" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "weekly_spotlight_polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_spotlight_options" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "is_winner" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_spotlight_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_spotlight_nominations" (
    "id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_spotlight_nominations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_spotlight_votes" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_spotlight_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weekly_spotlight_polls_week_index_key" ON "weekly_spotlight_polls"("week_index");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_spotlight_options_poll_id_category_song_id_key" ON "weekly_spotlight_options"("poll_id", "category", "song_id");

-- CreateIndex
CREATE INDEX "idx_weekly_spotlight_options_poll_id" ON "weekly_spotlight_options"("poll_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_spotlight_nominations_option_id_user_id_key" ON "weekly_spotlight_nominations"("option_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_spotlight_votes_option_id_user_id_key" ON "weekly_spotlight_votes"("option_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_weekly_spotlight_votes_poll_id" ON "weekly_spotlight_votes"("poll_id");

-- CreateIndex
CREATE INDEX "idx_weekly_spotlight_votes_user_id" ON "weekly_spotlight_votes"("user_id");

-- AddForeignKey
ALTER TABLE "weekly_spotlight_options" ADD CONSTRAINT "weekly_spotlight_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "weekly_spotlight_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_spotlight_options" ADD CONSTRAINT "weekly_spotlight_options_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_spotlight_nominations" ADD CONSTRAINT "weekly_spotlight_nominations_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "weekly_spotlight_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_spotlight_nominations" ADD CONSTRAINT "weekly_spotlight_nominations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_spotlight_votes" ADD CONSTRAINT "weekly_spotlight_votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "weekly_spotlight_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_spotlight_votes" ADD CONSTRAINT "weekly_spotlight_votes_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "weekly_spotlight_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_spotlight_votes" ADD CONSTRAINT "weekly_spotlight_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
