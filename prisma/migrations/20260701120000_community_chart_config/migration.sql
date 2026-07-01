-- Configuração da parada coletiva da comunidade
ALTER TABLE "Community" ADD COLUMN IF NOT EXISTS "paradaName" TEXT NOT NULL DEFAULT 'Parada';
ALTER TABLE "Community" ADD COLUMN IF NOT EXISTS "memberPositionLimit" INTEGER;
ALTER TABLE "Community" ADD COLUMN IF NOT EXISTS "pointsMode" TEXT NOT NULL DEFAULT 'member';
ALTER TABLE "Community" ADD COLUMN IF NOT EXISTS "customPoints" JSONB;
