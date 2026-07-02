-- CreateTable
CREATE TABLE "ParadaComment" (
    "id" TEXT NOT NULL,
    "communityId" TEXT,
    "genreSlug" TEXT,
    "section" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "weekIndex" INTEGER,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParadaComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParadaCommentLike" (
    "id" TEXT NOT NULL,
    "paradaCommentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParadaCommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParadaComment_communityId_genreSlug_section_period_weekIn_idx" ON "ParadaComment"("communityId", "genreSlug", "section", "period", "weekIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ParadaCommentLike_paradaCommentId_userId_key" ON "ParadaCommentLike"("paradaCommentId", "userId");

-- AddForeignKey
ALTER TABLE "ParadaComment" ADD CONSTRAINT "ParadaComment_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParadaComment" ADD CONSTRAINT "ParadaComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParadaCommentLike" ADD CONSTRAINT "ParadaCommentLike_paradaCommentId_fkey" FOREIGN KEY ("paradaCommentId") REFERENCES "ParadaComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParadaCommentLike" ADD CONSTRAINT "ParadaCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
