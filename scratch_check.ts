import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
}
const p = new PrismaClient();
const handles = ['copa-bot-2','copa-bot-3','copa-bot-4','copa-bot-5','copa-bot-6','copa-bot-7','copa-bot-8','clube_r3_import_01','clube_r3_import_02','clube_r3_import_03','clube_r3_import_04','clube_r3_import_05','clube_r3_import_06','clube_r3_import_07','clube_r3_import_08','clube_r3_import_09','clube_r3_import_10','clube_r3_import_11','clube_r3_import_12'];
(async () => {
  const us = await p.user.findMany({ where: { handle: { in: handles } }, select: { id: true, handle: true, name: true, role: true } });
  console.log('FOUND', us.length, 'of', handles.length);
  for (const u of us) console.log(' ', u.handle, '|', u.name, '|', u.role);
  const missing = handles.filter(h => !us.find(u => u.handle === h));
  if (missing.length) console.log('MISSING:', missing.join(', '));
})().catch(e => console.error('ERR', e.message)).finally(() => p.$disconnect());
