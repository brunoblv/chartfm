-- CreateEnum
CREATE TYPE "news_post_format" AS ENUM ('SINGLE', 'CAROUSEL', 'VIDEO');

-- CreateEnum
CREATE TYPE "news_post_status" AS ENUM ('DRAFT', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "news_posts" (
    "id" TEXT NOT NULL,
    "format" "news_post_format" NOT NULL,
    "status" "news_post_status" NOT NULL DEFAULT 'DRAFT',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "eyebrow" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "news_date" DATE NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "photo_url" TEXT,
    "video_url" TEXT,
    "caption" TEXT NOT NULL DEFAULT '',
    "rendered_images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rendered_video" TEXT,
    "rendered_at" TIMESTAMP(3),
    "instagram_media_id" TEXT,
    "published_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "news_posts_status_updated_at_idx" ON "news_posts"("status", "updated_at" DESC);
