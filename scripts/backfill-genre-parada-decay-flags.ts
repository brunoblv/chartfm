/**
 * Marca as paradas "de estilo" criadas por create-genre-paradas.ts com
 * autoDecay=true e grava sourceLastfmUsers, para o cron de queda semanal
 * (lib/genre-parada-decay.ts) saber quais paradas processar e de onde tirar
 * novas faixas.
 *
 * Usage: npx tsx scripts/backfill-genre-parada-decay-flags.ts [--prod]
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
}

process.env.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL ?? process.env.DATABASE_URL;

const prisma = new PrismaClient();

type Row = { handle: string; paradaName: string; lastfmUsers: string[] };

const ROWS: Row[] = [
  { handle: "cesarmaziero", paradaName: "CESAR20", lastfmUsers: ["romisk", "lucas_SS", "thunder__", "blvbruno"] },
  { handle: "demilovatique", paradaName: "Lovatique's Parade", lastfmUsers: ["thunder__", "lucas_SS"] },
  { handle: "dudabts", paradaName: "Serendipity Hot 50", lastfmUsers: ["romisk", "ohmymog_", "gabrielhahn", "alephunk"] },
  { handle: "kendikamura", paradaName: "Riot Act Top 30", lastfmUsers: ["blvbruno", "gabrielhahn", "ohmymog_"] },
  { handle: "julianast", paradaName: "The Hits", lastfmUsers: ["boofrnds", "IM4ttthew", "lucas_SS", "gabrielhahn"] },
  { handle: "karlacomk", paradaName: "Top 20", lastfmUsers: ["thunder__", "lucas_SS"] },
  { handle: "theandre", paradaName: "Top 20", lastfmUsers: ["nothingbutcami", "blvbruno", "readingmyeyes", "Khalysto"] },
  { handle: "joaoHT", paradaName: "Hitlist", lastfmUsers: ["okpaulinho", "romisk", "thunder__"] },
  { handle: "caiosoares", paradaName: "As Melhores da Semana", lastfmUsers: ["okpaulinho", "romisk", "soprani"] },
  { handle: "heavydirtysoul", paradaName: "heavydirtysoul 100+", lastfmUsers: ["boofrnds", "blvbruno", "okpaulinho", "RohLeitao"] },
  { handle: "jessycv", paradaName: "Top 40", lastfmUsers: ["otifaR", "lucas_SS", "blvbruno", "soprani"] },
  { handle: "midnightrain", paradaName: "Midnight Rain Playlist", lastfmUsers: ["evrmr", "lucas_SS", "Leighlstr", "soprani"] },
  { handle: "mayaradias", paradaName: "Neon Pulse", lastfmUsers: ["blvbruno", "rafael-a7x", "ohmymog_", "Khalysto"] },
  { handle: "diegox", paradaName: "Midnight Frequency", lastfmUsers: ["thunder__", "gustavocouk", "ohmymog_", "soprani"] },
  { handle: "guisouza", paradaName: "Global Heat", lastfmUsers: ["lucas_SS", "h_aunted", "alephunk"] },
  { handle: "kamarcelino", paradaName: "Pop Horizon", lastfmUsers: ["gabrielhahn", "Rapha1907", "rafael-a7x", "leeooh_costa"] },
  { handle: "marinasemdiamonds", paradaName: "Electric Chart", lastfmUsers: ["h_aunted", "blvbruno", "RohLeitao", "boofrnds"] },
  { handle: "lachica", paradaName: "Viral Waves", lastfmUsers: ["h_aunted", "ohmymog_", "evrmr", "boofrnds"] },
  { handle: "xalmeida", paradaName: "Sound Rush", lastfmUsers: ["flow_", "BriRy", "romisk", "boofrnds"] },
  { handle: "sandman", paradaName: "Hit Spectrum", lastfmUsers: ["h_aunted", "alephunk", "Leighlstr", "blvbruno"] },
  { handle: "ingrididas7", paradaName: "Next Wave 50", lastfmUsers: ["h_aunted", "ownconfusion", "daniel_azevedo", "soprani"] },
  { handle: "keku", paradaName: "Echo Charts", lastfmUsers: ["mattvieira", "leonardo_alves", "daniel_azevedo", "gabrielhahn"] },
];

async function main() {
  let updated = 0;
  let missing = 0;
  for (const row of ROWS) {
    const user = await prisma.user.findUnique({ where: { handle: row.handle }, select: { id: true } });
    if (!user) {
      console.log(`[erro] usuário @${row.handle} não encontrado.`);
      missing++;
      continue;
    }
    const parada = await prisma.parada.findFirst({
      where: { userId: user.id, name: { equals: row.paradaName, mode: "insensitive" } },
      select: { id: true },
    });
    if (!parada) {
      console.log(`[erro] parada "${row.paradaName}" de @${row.handle} não encontrada — ainda não foi criada?`);
      missing++;
      continue;
    }
    await prisma.parada.update({
      where: { id: parada.id },
      data: { autoDecay: true, sourceLastfmUsers: row.lastfmUsers },
    });
    console.log(`[ok] @${row.handle} — "${row.paradaName}" marcada com autoDecay=true.`);
    updated++;
  }
  console.log(`\nAtualizadas: ${updated}/${ROWS.length}. Faltando: ${missing}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
