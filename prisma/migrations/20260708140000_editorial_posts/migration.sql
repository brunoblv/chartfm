-- CreateEnum
CREATE TYPE "EditorialPostCategory" AS ENUM ('video', 'clipe', 'playlist', 'album', 'artista', 'editorial');

-- CreateTable
CREATE TABLE "editorial_posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "category" "EditorialPostCategory" NOT NULL,
    "published_at" DATE NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'Equipe ChartFM',
    "excerpt" TEXT NOT NULL,
    "paragraphs" JSONB NOT NULL,
    "youtube_url" TEXT,
    "spotify_url" TEXT,
    "preview_image" TEXT,
    "tags" JSONB,
    "related_links" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editorial_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "editorial_posts_slug_key" ON "editorial_posts"("slug");

-- CreateIndex
CREATE INDEX "editorial_posts_published_published_at_idx" ON "editorial_posts"("published", "published_at" DESC);
