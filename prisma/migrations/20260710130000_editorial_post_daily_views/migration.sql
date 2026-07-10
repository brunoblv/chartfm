-- CreateTable
CREATE TABLE "editorial_post_daily_views" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "editorial_post_daily_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "editorial_post_daily_views_slug_idx" ON "editorial_post_daily_views"("slug");

-- CreateIndex
CREATE INDEX "editorial_post_daily_views_date_idx" ON "editorial_post_daily_views"("date");

-- CreateIndex
CREATE UNIQUE INDEX "editorial_post_daily_views_slug_date_key" ON "editorial_post_daily_views"("slug", "date");
