-- CreateTable
CREATE TABLE "SystemFeedPost" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "targetUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemFeedPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemFeedPost_createdAt_idx" ON "SystemFeedPost"("createdAt");
