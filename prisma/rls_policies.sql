-- ============================================================
-- Habilita RLS em todas as tabelas públicas
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Tabelas com nome mapeado (snake_case)
ALTER TABLE artists           ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums            ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_feats        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows      ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_snapshots  ENABLE ROW LEVEL SECURITY;

-- Tabelas com nome PascalCase (sem @@map no Prisma)
ALTER TABLE "User"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Song"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Chart"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChartEntry"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChartLike"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChartRepost"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Community"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommunityMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Post"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostLike"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostReply"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification"    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Policies de leitura pública (dados não-sensíveis)
-- O Prisma usa service_role e bypassa RLS automaticamente.
-- Estas policies protegem o acesso direto via PostgREST/anon key.
-- ============================================================

-- Dados de catálogo (somente leitura pública)
CREATE POLICY "public_read" ON artists           FOR SELECT USING (true);
CREATE POLICY "public_read" ON albums            FOR SELECT USING (true);
CREATE POLICY "public_read" ON song_feats        FOR SELECT USING (true);
CREATE POLICY "public_read" ON global_snapshots  FOR SELECT USING (true);
CREATE POLICY "public_read" ON "Song"            FOR SELECT USING (true);

-- Perfis de usuário (leitura pública)
CREATE POLICY "public_read" ON "User"            FOR SELECT USING (true);

-- Charts e entradas (leitura pública)
CREATE POLICY "public_read" ON "Chart"           FOR SELECT USING (true);
CREATE POLICY "public_read" ON "ChartEntry"      FOR SELECT USING (true);
CREATE POLICY "public_read" ON "ChartLike"       FOR SELECT USING (true);
CREATE POLICY "public_read" ON "ChartRepost"     FOR SELECT USING (true);
CREATE POLICY "public_read" ON "Comment"         FOR SELECT USING (true);

-- Comunidades (leitura pública)
CREATE POLICY "public_read" ON "Community"       FOR SELECT USING (true);
CREATE POLICY "public_read" ON "CommunityMember" FOR SELECT USING (true);
CREATE POLICY "public_read" ON "Post"            FOR SELECT USING (true);
CREATE POLICY "public_read" ON "PostLike"        FOR SELECT USING (true);
CREATE POLICY "public_read" ON "PostReply"       FOR SELECT USING (true);
CREATE POLICY "public_read" ON user_follows      FOR SELECT USING (true);

-- Notificações: somente leitura via service_role (Prisma)
-- Nenhuma policy SELECT aqui = bloqueado via anon key (correto)
-- Prisma (service_role) ainda acessa normalmente
