/**
 * Corrige URLs http:// salvas em cover_url/image_url (Cover Art Archive
 * devolve http:// nas respostas, o que viola a CSP img-src 'https:').
 *
 * Uso:
 *   npx tsx scripts/fix-http-cover-urls.ts
 */

import { prisma } from "../lib/prisma";

async function main() {
  const albums = await prisma.$executeRaw`
    UPDATE albums SET cover_url = REPLACE(cover_url, 'http://', 'https://')
    WHERE cover_url LIKE 'http://%'
  `;
  const artists = await prisma.$executeRaw`
    UPDATE artists SET image_url = REPLACE(image_url, 'http://', 'https://')
    WHERE image_url LIKE 'http://%'
  `;
  console.log(`albums.cover_url corrigidos: ${albums}`);
  console.log(`artists.image_url corrigidos: ${artists}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
