-- CreateEnum
CREATE TYPE "SocialEventType" AS ENUM ('GLOBAL100_PUBLISHED', 'AIRPLAY_PUBLISHED', 'ALBUMS_CHART_PUBLISHED', 'ALBUM_REVIEW_MILESTONE', 'ALBUM_CLUB_WINNER', 'PUSH_PHASE_CHANGE', 'COPA_ROUND_START', 'COPA_ROUND_RESULT', 'COPA_FINAL_RESULT', 'WEEKLY_POLL_OPEN');

-- CreateEnum
CREATE TYPE "SocialPostPriority" AS ENUM ('CRITICAL', 'HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('PENDING', 'SCHEDULED', 'GENERATING', 'READY', 'PUBLISHING', 'PUBLISHED', 'PARTIALLY_PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'INSTAGRAM_FEED', 'INSTAGRAM_STORY', 'THREADS', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "SocialPublishStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED', 'SKIPPED_CAP');

-- CreateTable
CREATE TABLE "social_events" (
    "id" TEXT NOT NULL,
    "event_type" "SocialEventType" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "event_type" "SocialEventType" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "priority" "SocialPostPriority" NOT NULL DEFAULT 'NORMAL',
    "score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "status" "SocialPostStatus" NOT NULL DEFAULT 'PENDING',
    "platforms" "SocialPlatform"[],
    "caption_instagram" TEXT,
    "caption_facebook" TEXT,
    "caption_threads" TEXT,
    "caption_telegram" TEXT,
    "image_feed_45" TEXT,
    "image_telegram_11" TEXT,
    "image_story_916" TEXT,
    "hashtags" TEXT[],
    "published_at" TIMESTAMP(3),
    "facebook_post_id" TEXT,
    "instagram_media_id" TEXT,
    "threads_post_id" TEXT,
    "telegram_message_id" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post_publications" (
    "id" TEXT NOT NULL,
    "social_post_id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "status" "SocialPublishStatus" NOT NULL DEFAULT 'PENDING',
    "external_id" TEXT,
    "error" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_post_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_platform_configs" (
    "platform" "SocialPlatform" NOT NULL,
    "daily_limit" INTEGER NOT NULL DEFAULT 2,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "social_platform_configs_pkey" PRIMARY KEY ("platform")
);

-- CreateTable
CREATE TABLE "social_schedule_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "slots" TEXT[] DEFAULT ARRAY['07:00', '09:00', '13:00', '17:00', '19:00']::TEXT[],
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',

    CONSTRAINT "social_schedule_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_automation_toggles" (
    "event_type" "SocialEventType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "social_automation_toggles_pkey" PRIMARY KEY ("event_type")
);

-- CreateTable
CREATE TABLE "social_post_metrics" (
    "id" TEXT NOT NULL,
    "social_post_id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "reach" INTEGER,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_post_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_social_events_type_entity" ON "social_events"("event_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_social_posts_status" ON "social_posts"("status");

-- CreateIndex
CREATE INDEX "idx_social_posts_entity" ON "social_posts"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_social_posts_scheduled_at" ON "social_posts"("scheduled_at");

-- CreateIndex
CREATE INDEX "idx_social_post_publications_platform_published" ON "social_post_publications"("platform", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "social_post_publications_social_post_id_platform_key" ON "social_post_publications"("social_post_id", "platform");

-- CreateIndex
CREATE INDEX "idx_social_post_metrics_post_platform" ON "social_post_metrics"("social_post_id", "platform");

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "social_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post_publications" ADD CONSTRAINT "social_post_publications_social_post_id_fkey" FOREIGN KEY ("social_post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

