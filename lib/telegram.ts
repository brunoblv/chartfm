import { renderEventCard } from "@/lib/telegram-card";

const API_BASE = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 20000;

type TelegramConfig = { token: string; chatId: string; enabled: boolean };

function readConfig(): TelegramConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return null;

  const flag = process.env.TELEGRAM_ENABLED?.trim().toLowerCase();
  const enabled = flag ? flag === "1" || flag === "true" || flag === "yes" : true;
  return { token, chatId, enabled };
}

export function isTelegramConfigured(): boolean {
  return readConfig() !== null;
}

/** Base pública usada para montar os links das mensagens (não a URL interna dos crons). */
function publicBaseUrl(): string {
  const raw = process.env.TELEGRAM_PUBLIC_BASE_URL?.trim() || "https://chartfm.com.br";
  return raw.replace(/\/$/, "");
}

function absoluteUrl(targetUrl?: string | null): string | null {
  if (!targetUrl) return null;
  if (/^https?:\/\//i.test(targetUrl)) return targetUrl;
  return `${publicBaseUrl()}${targetUrl.startsWith("/") ? "" : "/"}${targetUrl}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function telegramFetch(config: TelegramConfig, method: string, body: BodyInit, headers?: HeadersInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/bot${config.token}/${method}`, {
      method: "POST",
      body,
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[telegram] ${method} respondeu ${res.status}: ${detail}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[telegram] falha na chamada ${method}`, err);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function buildCaption(text: string, url: string | null): string {
  const base = escapeHtml(text);
  return url ? `${base}\n\n<a href="${escapeHtml(url)}">Abrir no ChartFM →</a>` : base;
}

/** Envia uma mensagem de texto simples ao grupo. */
export async function sendTelegramMessage(text: string, targetUrl?: string | null): Promise<boolean> {
  const config = readConfig();
  if (!config || !config.enabled) return false;

  const body = JSON.stringify({
    chat_id: config.chatId,
    text: buildCaption(text, absoluteUrl(targetUrl)),
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });
  return telegramFetch(config, "sendMessage", body, { "Content-Type": "application/json" });
}

/** Envia uma foto (PNG) com legenda ao grupo. */
export async function sendTelegramPhoto(png: Buffer, caption: string, targetUrl?: string | null): Promise<boolean> {
  const config = readConfig();
  if (!config || !config.enabled) return false;

  const form = new FormData();
  form.set("chat_id", config.chatId);
  form.set("caption", buildCaption(caption, absoluteUrl(targetUrl)));
  form.set("parse_mode", "HTML");
  form.set("photo", new Blob([new Uint8Array(png)], { type: "image/png" }), "chartfm-card.png");
  return telegramFetch(config, "sendPhoto", form);
}

type EventStyle = { eyebrow: string; accent: string };

/** Mapeia o "kind" do feed / tipo de notificação para a etiqueta e cor do card. */
function styleForKind(kind: string): EventStyle {
  const k = kind.toLowerCase();
  if (k.startsWith("copa")) return { eyebrow: "Copa ChartFM", accent: "#FF6A00" };
  if (k.startsWith("push")) return { eyebrow: "ChartFM Push", accent: "#06D6A0" };
  if (k.startsWith("clube")) return { eyebrow: "Clube do Álbum", accent: "#7C5CFF" };
  if (k.startsWith("global")) return { eyebrow: "Parada Global", accent: "#FA243C" };
  if (k.startsWith("weekly_poll")) return { eyebrow: "Votação da Semana", accent: "#B89CFF" };
  return { eyebrow: "Aviso ChartFM", accent: "#FA243C" };
}

export type TelegramEventInput = {
  kind: string;
  text: string;
  targetUrl?: string | null;
};

/**
 * Notifica um evento "da casa" no grupo do Telegram: tenta enviar com imagem
 * (card gerado no servidor) e, se falhar, cai para mensagem de texto.
 * Nunca lança — pensada para ser chamada como fire-and-forget.
 */
export async function notifyTelegramEvent(input: TelegramEventInput): Promise<void> {
  if (!isTelegramConfigured()) return;

  const style = styleForKind(input.kind);
  try {
    const png = await renderEventCard({ eyebrow: style.eyebrow, text: input.text, accent: style.accent });
    if (png) {
      const sent = await sendTelegramPhoto(png, input.text, input.targetUrl);
      if (sent) return;
    }
    await sendTelegramMessage(input.text, input.targetUrl);
  } catch (err) {
    console.error("[telegram] notifyTelegramEvent falhou", err);
  }
}

/** Dispara a notificação sem bloquear o fluxo chamador (fire-and-forget). */
export function notifyTelegramEventSafe(input: TelegramEventInput): void {
  if (!isTelegramConfigured()) return;
  void notifyTelegramEvent(input).catch((err) => console.error("[telegram] notifyTelegramEventSafe", err));
}
