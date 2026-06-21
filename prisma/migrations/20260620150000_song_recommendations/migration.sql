-- CreateTable
CREATE TABLE "song_recommendations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "text" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "song_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "song_recommendation_likes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "song_recommendation_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "song_recommendation_comments" (
    "id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "song_recommendation_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "song_recommendation_comment_likes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "song_recommendation_comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "song_recommendation_comment_replies" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "song_recommendation_comment_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "song_recommendations_created_at_idx" ON "song_recommendations"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "song_recommendation_likes_user_id_recommendation_id_key" ON "song_recommendation_likes"("user_id", "recommendation_id");

-- CreateIndex
CREATE INDEX "song_recommendation_comments_recommendation_id_idx" ON "song_recommendation_comments"("recommendation_id");

-- CreateIndex
CREATE UNIQUE INDEX "song_recommendation_comment_likes_user_id_comment_id_key" ON "song_recommendation_comment_likes"("user_id", "comment_id");

-- CreateIndex
CREATE INDEX "song_recommendation_comment_replies_comment_id_idx" ON "song_recommendation_comment_replies"("comment_id");

-- AddForeignKey
ALTER TABLE "song_recommendations" ADD CONSTRAINT "song_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_recommendations" ADD CONSTRAINT "song_recommendations_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Song"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_recommendation_likes" ADD CONSTRAINT "song_recommendation_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_recommendation_likes" ADD CONSTRAINT "song_recommendation_likes_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "song_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_recommendation_comments" ADD CONSTRAINT "song_recommendation_comments_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "song_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_recommendation_comments" ADD CONSTRAINT "song_recommendation_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_recommendation_comment_likes" ADD CONSTRAINT "song_recommendation_comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_recommendation_comment_likes" ADD CONSTRAINT "song_recommendation_comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "song_recommendation_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_recommendation_comment_replies" ADD CONSTRAINT "song_recommendation_comment_replies_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "song_recommendation_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_recommendation_comment_replies" ADD CONSTRAINT "song_recommendation_comment_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
