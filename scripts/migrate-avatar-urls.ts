/**
 * Migra URLs de avatar antigas (/uploads/avatars/...) para o novo padrão
 * via rota de API (/api/uploads/avatars/...).
 *
 * Uso: npx tsx scripts/migrate-avatar-urls.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

function loadEnvFile() {
  const p = path.join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

const OLD_PREFIX = "/uploads/avatars/";
const NEW_PREFIX = "/api/uploads/avatars/";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const users = await prisma.user.findMany({
    where: { image: { startsWith: OLD_PREFIX } },
    select: { id: true, image: true },
  });

  console.log(`Encontrados ${users.length} usuário(s) com URL antiga.`);
  if (users.length === 0) {
    console.log("Nada a migrar.");
    return;
  }

  for (const user of users) {
    const oldUrl = user.image!;
    // Troca só o prefixo; mantém o filename e o ?v=... intactos
    const newUrl = NEW_PREFIX + oldUrl.slice(OLD_PREFIX.length);
    console.log(`  ${user.id}: ${oldUrl} → ${newUrl}`);
    if (!dryRun) {
      await prisma.user.update({
        where: { id: user.id },
        data: { image: newUrl },
      });
    }
  }

  console.log(dryRun ? `\ndry-run: nenhuma alteração aplicada.` : `\n${users.length} registro(s) atualizado(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
