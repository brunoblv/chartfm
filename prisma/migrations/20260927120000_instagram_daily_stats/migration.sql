-- Histórico diário de seguidores do Instagram (dashboard em /admin/instagram).
CREATE TABLE "instagram_daily_stats" (
    "date" DATE NOT NULL,
    "net_followers" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_daily_stats_pkey" PRIMARY KEY ("date")
);
