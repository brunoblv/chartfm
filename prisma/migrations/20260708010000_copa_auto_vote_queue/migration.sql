-- CreateTable
CREATE TABLE "copa_auto_vote_queue" (
    "id" TEXT NOT NULL,
    "fixture_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copa_auto_vote_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "copa_auto_vote_queue_created_at_idx" ON "copa_auto_vote_queue"("created_at");
