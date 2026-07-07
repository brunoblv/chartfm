/**
 * Envia uma mensagem de teste ao grupo do Telegram (com o card gerado no servidor).
 * Útil para validar TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID e a geração de imagem.
 *
 *   npm run telegram:test
 *   npm run telegram:test -- copa "A Copa ChartFM começou! Vote nos jogos ao vivo."
 *
 * Argumentos (opcionais): <kind> <texto>
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

async function main() {
  const { isTelegramConfigured, notifyTelegramEvent } = await import("../lib/telegram");

  if (!isTelegramConfigured()) {
    console.error("Telegram não configurado. Defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no .env.");
    process.exit(1);
  }

  const kind = process.argv[2] ?? "global_chart";
  const text =
    process.argv[3] ?? "Teste do ChartFM: a integração com o Telegram está funcionando. 🎧";

  console.log(`Enviando evento de teste (kind="${kind}")...`);
  await notifyTelegramEvent({ kind, text, targetUrl: "/global/100" });
  console.log("Pronto. Confira o grupo no Telegram.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
