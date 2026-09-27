-- Histórico diário de seguidores do Instagram oficial (admin /admin/instagram).
CREATE TABLE IF NOT EXISTS "instagram_follower_days" (
    "date" DATE NOT NULL,
    "net_followers" INTEGER,
    "followers_count" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_follower_days_pkey" PRIMARY KEY ("date")
);
