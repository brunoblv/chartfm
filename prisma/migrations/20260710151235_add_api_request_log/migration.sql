-- CreateTable
CREATE TABLE "api_request_logs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "status_code" INTEGER,
    "error_message" TEXT,
    "user_id" TEXT,
    "user_name" TEXT,
    "user_handle" TEXT,

    CONSTRAINT "api_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_request_logs_created_at_idx" ON "api_request_logs"("created_at");

-- CreateIndex
CREATE INDEX "api_request_logs_path_created_at_idx" ON "api_request_logs"("path", "created_at");
