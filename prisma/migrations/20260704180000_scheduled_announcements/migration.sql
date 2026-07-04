-- CreateTable
CREATE TABLE "scheduled_announcements" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "text" TEXT NOT NULL,
    "targetUrl" TEXT,
    "notifyType" TEXT NOT NULL DEFAULT 'admin_announcement',
    "feedKind" TEXT NOT NULL DEFAULT 'admin_announcement',
    "template_id" TEXT,
    "context_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "schedule_mode" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "interval_hours" INTEGER,
    "next_run_at" TIMESTAMP(3),
    "last_sent_at" TIMESTAMP(3),
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "max_runs" INTEGER,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_scheduled_announcements_due" ON "scheduled_announcements"("status", "next_run_at");
