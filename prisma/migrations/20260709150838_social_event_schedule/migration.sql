-- AlterTable
ALTER TABLE "social_platform_configs" DROP COLUMN "daily_limit";

-- CreateTable
CREATE TABLE "social_event_schedules" (
    "event_type" "SocialEventType" NOT NULL,
    "weekday" INTEGER NOT NULL,
    "time" TEXT NOT NULL,

    CONSTRAINT "social_event_schedules_pkey" PRIMARY KEY ("event_type")
);

