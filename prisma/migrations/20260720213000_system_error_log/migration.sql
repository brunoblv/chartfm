-- CreateTable
CREATE TABLE "system_error_logs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scope" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "path" TEXT,
    "meta" JSONB,

    CONSTRAINT "system_error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_error_logs_created_at_idx" ON "system_error_logs"("created_at");

-- CreateIndex
CREATE INDEX "system_error_logs_scope_created_at_idx" ON "system_error_logs"("scope", "created_at");
