-- CreateTable
-- Tabelas criadas via `prisma db push` em 2026-07-17 (Hot 100 retroativo);
-- esta migração registra o CREATE no histórico para o shadow database.
CREATE TABLE "retro_song_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "importance" INTEGER,
    "importance_locked" BOOLEAN NOT NULL DEFAULT false,
    "peak_potential" TEXT,
    "peak_potential_locked" BOOLEAN NOT NULL DEFAULT false,
    "manual_adjustment" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retro_song_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retro_era_overrides" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL,

    CONSTRAINT "retro_era_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "retro_song_profiles_user_id_idx" ON "retro_song_profiles"("user_id");

-- CreateIndex
CREATE INDEX "retro_song_profiles_song_id_idx" ON "retro_song_profiles"("song_id");

-- CreateIndex
CREATE UNIQUE INDEX "retro_song_profiles_user_id_song_id_key" ON "retro_song_profiles"("user_id", "song_id");

-- CreateIndex
CREATE INDEX "retro_era_overrides_user_id_idx" ON "retro_era_overrides"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "retro_era_overrides_user_id_song_id_year_key" ON "retro_era_overrides"("user_id", "song_id", "year");

-- AddForeignKey
ALTER TABLE "retro_song_profiles" ADD CONSTRAINT "retro_song_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_song_profiles" ADD CONSTRAINT "retro_song_profiles_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_era_overrides" ADD CONSTRAINT "retro_era_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_era_overrides" ADD CONSTRAINT "retro_era_overrides_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
