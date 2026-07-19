-- CreateTable
CREATE TABLE "site_audit_logs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "user_id" TEXT,
    "user_name" TEXT,
    "user_handle" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "spotify_calls" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,

    CONSTRAINT "site_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_audit_logs_created_at_idx" ON "site_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "site_audit_logs_action_created_at_idx" ON "site_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "site_audit_logs_user_id_created_at_idx" ON "site_audit_logs"("user_id", "created_at");
