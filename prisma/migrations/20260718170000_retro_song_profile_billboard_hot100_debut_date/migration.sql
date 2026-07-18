-- Coluna já existe no modelo Prisma (RetroSongProfile.billboardHot100DebutDate) desde
-- 20260718143037_add_billboard_hot100_debut_date, mas aquela migração só adicionou a
-- coluna na tabela "Song" — nunca em "retro_song_profiles". Corrige o drift.
ALTER TABLE "retro_song_profiles" ADD COLUMN IF NOT EXISTS "billboard_hot100_debut_date" DATE;
