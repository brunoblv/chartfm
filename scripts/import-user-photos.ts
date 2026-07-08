import { readdir, mkdir, copyFile } from "fs/promises";
import { existsSync } from "fs";
import { join, extname, basename } from "path";
import { prisma } from "../lib/prisma";

const SOURCE_DIR = join(process.cwd(), "uploads", "fotos");
const TARGET_DIR = join(process.cwd(), "uploads", "avatars");

async function main() {
  if (!existsSync(TARGET_DIR)) {
    await mkdir(TARGET_DIR, { recursive: true, mode: 0o755 });
  }

  const files = await readdir(SOURCE_DIR);

  for (const file of files) {
    const ext = extname(file).slice(1).toLowerCase();
    const handle = basename(file, extname(file));

    const user = await prisma.user.findUnique({ where: { handle } });
    if (!user) {
      console.log(`[skip] Nenhum usuário com handle "${handle}" (arquivo: ${file})`);
      continue;
    }

    const targetFilename = `${user.id}.${ext}`;
    await copyFile(join(SOURCE_DIR, file), join(TARGET_DIR, targetFilename));

    const url = `/api/uploads/avatars/${targetFilename}?v=${Date.now()}`;
    await prisma.user.update({ where: { id: user.id }, data: { image: url } });

    console.log(`[ok] ${handle} -> ${url}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
