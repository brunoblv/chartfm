/**
 * Testa a importação do Last.fm para um usuário específico.
 *
 * Uso:
 *   npx tsx scripts/test-lastfm-user.ts Petter_HD
 *   npx tsx scripts/test-lastfm-user.ts brunoblv
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

import { PrismaClient } from "@prisma/client";
import { fetchTopTracks } from "../lib/lastfm";

const prisma = new PrismaClient();
const targetHandle = process.argv[2];

async function main() {
  // 1. Lista todos os usuários com lastfmUser cadastrado
  const users = await prisma.user.findMany({
    where: { lastfmUser: { not: null } },
    select: { id: true, name: true, lastfmUser: true },
  });

  console.log(`\n=== Usuários com Last.fm cadastrado (${users.length}) ===`);
  for (const u of users) {
    const marker = u.lastfmUser?.toLowerCase() === targetHandle?.toLowerCase() ? " ← ALVO" : "";
    console.log(`  ${u.name} → lastfmUser: "${u.lastfmUser}"${marker}`);
  }

  if (!targetHandle) {
    console.log("\nNenhum usuário-alvo especificado. Passe o handle como argumento.");
    return;
  }

  // 2. Verifica se o alvo está cadastrado
  const target = users.find(
    (u) => u.lastfmUser?.toLowerCase() === targetHandle.toLowerCase(),
  );

  if (!target) {
    console.log(`\n[ERRO] Nenhum usuário com lastfmUser = "${targetHandle}" encontrado no banco.`);
    console.log("O usuário precisa configurar o Last.fm no perfil para que o import funcione.");
    return;
  }

  console.log(`\n=== Testando fetch do Last.fm para "${target.lastfmUser}" ===`);

  // 3. Faz o mesmo fetch que a rota /api/lastfm/import faz
  const topTracks = await fetchTopTracks("1month", 20, target.lastfmUser!);

  console.log(`\nTop tracks (último mês): ${topTracks.length}`);
  for (let i = 0; i < topTracks.length; i += 1) {
    const t = topTracks[i]!;
    console.log(`  ${String(i + 1).padStart(2)}. ${t.track} — ${t.artist} (${t.playcount} plays)`);
  }

  if (topTracks.length === 0) {
    console.log("  (nenhuma faixa encontrada — usuário sem scrobbles no período)");
  }
}

main()
  .catch((err) => {
    console.error("\n[ERRO]", err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
