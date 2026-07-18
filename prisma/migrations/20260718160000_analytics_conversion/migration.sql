-- AlterTable
ALTER TABLE "analytics_daily_stats"
  ADD COLUMN "landing_visitors" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "signup_events" INTEGER NOT NULL DEFAULT 0;
