-- Imagem de capa do header da comunidade
ALTER TABLE "Community" ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;
