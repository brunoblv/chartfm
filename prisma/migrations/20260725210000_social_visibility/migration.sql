-- Privacidade por rede social no perfil (everyone | following | nobody)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twitter_visibility" TEXT NOT NULL DEFAULT 'everyone';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "instagram_visibility" TEXT NOT NULL DEFAULT 'everyone';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastfm_visibility" TEXT NOT NULL DEFAULT 'everyone';
