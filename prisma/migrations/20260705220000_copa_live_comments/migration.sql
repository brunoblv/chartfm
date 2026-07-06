-- CreateTable
CREATE TABLE "copa_live_comments" (
    "id" TEXT NOT NULL,
    "copa_id" TEXT NOT NULL,
    "batch_order" INTEGER,
    "user_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copa_live_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copa_live_comment_likes" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copa_live_comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "copa_live_comments_copa_id_batch_order_idx" ON "copa_live_comments"("copa_id", "batch_order");

-- CreateIndex
CREATE UNIQUE INDEX "copa_live_comment_likes_comment_id_user_id_key" ON "copa_live_comment_likes"("comment_id", "user_id");

-- AddForeignKey
ALTER TABLE "copa_live_comments" ADD CONSTRAINT "copa_live_comments_copa_id_fkey" FOREIGN KEY ("copa_id") REFERENCES "copa_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copa_live_comments" ADD CONSTRAINT "copa_live_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copa_live_comment_likes" ADD CONSTRAINT "copa_live_comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "copa_live_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copa_live_comment_likes" ADD CONSTRAINT "copa_live_comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
