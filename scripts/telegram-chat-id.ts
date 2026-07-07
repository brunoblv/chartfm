/**
 * Descobre o chat_id do grupo do Telegram.
 *
 * Passos:
 *   1) Crie o bot no @BotFather e coloque TELEGRAM_BOT_TOKEN no .env
 *   2) Adicione o bot ao grupo do ChartFM
 *   3) Envie QUALQUER mensagem no grupo (ex.: "oi")
 *   4) Rode: npm run telegram:chat-id
 *
 * O script lê getUpdates e imprime os chats encontrados (com o id do grupo,
 * ex.: -1001234567890). Cole esse valor em TELEGRAM_CHAT_ID no .env.
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
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.error("Defina TELEGRAM_BOT_TOKEN no .env antes de rodar.");
    process.exit(1);
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const data = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: Array<{
      message?: { chat?: { id: number; title?: string; type?: string } };
      channel_post?: { chat?: { id: number; title?: string; type?: string } };
    }>;
  };

  if (!data.ok) {
    console.error("Telegram retornou erro:", data.description ?? "desconhecido");
    process.exit(1);
  }

  const chats = new Map<number, { title: string; type: string }>();
  for (const update of data.result ?? []) {
    const chat = update.message?.chat ?? update.channel_post?.chat;
    if (chat) chats.set(chat.id, { title: chat.title ?? "(sem título)", type: chat.type ?? "?" });
  }

  if (chats.size === 0) {
    console.log(
      "Nenhum chat encontrado. Adicione o bot ao grupo, envie uma mensagem lá e rode de novo.\n" +
        "Dica: se o bot tiver o modo privacidade ligado no @BotFather, ele só vê mensagens que o mencionam.",
    );
    return;
  }

  console.log("Chats encontrados:\n");
  for (const [id, info] of chats) {
    console.log(`  ${id}  ·  ${info.type}  ·  ${info.title}`);
  }
  console.log("\nCole o id do grupo em TELEGRAM_CHAT_ID no .env (grupos costumam começar com -100).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
