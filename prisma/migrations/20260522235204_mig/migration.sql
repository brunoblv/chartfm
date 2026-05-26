/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Chart` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ChartType" AS ENUM ('SONGS', 'ALBUMS', 'MIXED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Chart" ADD COLUMN     "chart_type" "ChartType" NOT NULL DEFAULT 'SONGS',
ADD COLUMN     "community_id" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_published" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "max_items" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "week_start_date" DATE;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "replyCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxSongs" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "Song" ADD COLUMN     "exhibition_name" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "chart_size" INTEGER,
ADD COLUMN     "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "instagramUser" TEXT,
ADD COLUMN     "lastfmUser" TEXT,
ADD COLUMN     "paradaNome" TEXT,
ADD COLUMN     "parada_logo" TEXT,
ADD COLUMN     "twitterUser" TEXT;

-- CreateTable
CREATE TABLE "CommentReply" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_follows" (
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "following_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_snapshots" (
    "id" TEXT NOT NULL,
    "week_index" INTEGER NOT NULL,
    "week_label" TEXT NOT NULL,
    "date_range" TEXT NOT NULL,
    "weekly_songs" JSONB NOT NULL,
    "weekly_artists" JSONB NOT NULL,
    "overall_songs" JSONB NOT NULL,
    "overall_artists" JSONB NOT NULL,
    "frozen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_reviews" (
    "id" TEXT NOT NULL,
    "album_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "album_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_review_helpful" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "album_review_helpful_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentReply_commentId_idx" ON "CommentReply"("commentId");

-- CreateIndex
CREATE INDEX "idx_user_follows_follower_id" ON "user_follows"("follower_id");

-- CreateIndex
CREATE INDEX "idx_user_follows_following_id" ON "user_follows"("following_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_follows_follower_id_following_id_key" ON "user_follows"("follower_id", "following_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_snapshots_week_index_key" ON "global_snapshots"("week_index");

-- CreateIndex
CREATE INDEX "idx_global_snapshots_week_index" ON "global_snapshots"("week_index");

-- CreateIndex
CREATE INDEX "album_reviews_album_id_idx" ON "album_reviews"("album_id");

-- CreateIndex
CREATE UNIQUE INDEX "album_reviews_album_id_user_id_key" ON "album_reviews"("album_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "album_review_helpful_review_id_user_id_key" ON "album_review_helpful"("review_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Chart_slug_key" ON "Chart"("slug");

-- CreateIndex
CREATE INDEX "idx_charts_user_week" ON "Chart"("userId", "week_start_date");

-- CreateIndex
CREATE INDEX "charts_communityId_fkey" ON "Chart"("community_id");

-- CreateIndex
CREATE INDEX "idx_charts_slug" ON "Chart"("slug");

-- CreateIndex
CREATE INDEX "communities_ownerId_fkey" ON "Community"("ownerId");

-- AddForeignKey
ALTER TABLE "Chart" ADD CONSTRAINT "Chart_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReply" ADD CONSTRAINT "CommentReply_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReply" ADD CONSTRAINT "CommentReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_reviews" ADD CONSTRAINT "album_reviews_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_reviews" ADD CONSTRAINT "album_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_review_helpful" ADD CONSTRAINT "album_review_helpful_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "album_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_review_helpful" ADD CONSTRAINT "album_review_helpful_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
