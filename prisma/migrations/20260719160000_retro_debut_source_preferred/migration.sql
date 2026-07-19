-- Fonte de estreia travada no Hot 100 retrospectivo (null = automático).
ALTER TABLE "retro_song_profiles" ADD COLUMN IF NOT EXISTS "debut_source_preferred" TEXT;
