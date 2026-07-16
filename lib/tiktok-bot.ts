import { prisma } from "@/lib/prisma";
import type { Prisma, TiktokBotUser } from "@prisma/client";

/**
 * TikTok Growth Bot — bot de Telegram (token próprio, separado do bot do
 * ChartFM) para uma comunidade de crescimento mútuo no TikTok.
 *
 * Fluxo: usuário entra no grupo → boas-vindas com botão → cadastra o usuário
 * do TikTok (e o nicho) no chat → o cron divulga perfis em rodízio híbrido
 * (70% quem espera há mais tempo, 30% aleatório com peso extra para novatos).
 *
 * Rotinas de manutenção: pesquisa de retorno pós-divulgação (DM), confirmação
 * de participação a cada 15 dias, verificação semanal de contas 404 e o
 * Follow Friday (sexta 19h, lote grande de perfis).
 *
 * Ver Planejamento_TikTok_Growth_Bot.md. Admin em /admin/tiktok-bot (@bruno).
 */

const API_BASE = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 20000;
const SETTINGS_ID = "default";

/** Denúncias distintas para um perfil sair da fila e aguardar revisão manual. */
const REPORT_THRESHOLD = 5;
/** Peso extra na parte aleatória do sorteio para quem entrou há menos de 7 dias. */
const NEWCOMER_WEIGHT = 3;
const NEWCOMER_DAYS = 7;
/** Pesquisa de retorno: enviada entre 6h e 48h após a divulgação, no máx. 1x/semana. */
const SURVEY_MIN_HOURS = 6;
const SURVEY_MAX_HOURS = 48;
const SURVEY_COOLDOWN_DAYS = 7;
/** Confirmação de participação: pedida a cada 15 dias; sem resposta em 7 → pausa. */
const CONFIRM_EVERY_DAYS = 15;
const CONFIRM_GRACE_DAYS = 7;
/** Verificação de conta no TikTok: cada perfil no máx. 1x/semana, em lotes pequenos. */
const ACCOUNT_CHECK_BATCH = Math.max(1, Number(process.env.TIKTOK_BOT_CHECK_BATCH) || 30);
const ACCOUNT_CHECK_DELAY_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function tiktokBotToken(): string | null {
  return process.env.TIKTOK_BOT_TOKEN?.trim() || null;
}

export function tiktokBotConfigured(): boolean {
  return Boolean(tiktokBotToken());
}

/** Secret enviado pelo Telegram no header X-Telegram-Bot-Api-Secret-Token do webhook. */
export function tiktokBotWebhookSecret(): string | null {
  return process.env.TIKTOK_BOT_WEBHOOK_SECRET?.trim() || null;
}

export async function getTiktokBotSettings() {
  return prisma.tiktokBotSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

// ---------------------------------------------------------------------------
// Nichos
// ---------------------------------------------------------------------------

export const TIKTOK_NICHES: { key: string; label: string }[] = [
  { key: "musica", label: "🎵 Música" },
  { key: "humor", label: "😂 Humor" },
  { key: "games", label: "🎮 Games" },
  { key: "receitas", label: "🍳 Receitas" },
  { key: "beleza", label: "💄 Beleza" },
  { key: "educacao", label: "📚 Educação" },
  { key: "tiktokshop", label: "🛍 TikTok Shop" },
  { key: "outro", label: "✨ Outro" },
];

export function nicheLabel(key: string | null): string {
  return TIKTOK_NICHES.find((n) => n.key === key)?.label ?? "—";
}

// ---------------------------------------------------------------------------
// Telegram API (deste bot)
// ---------------------------------------------------------------------------

type TgResult<T = unknown> = { ok: boolean; result?: T; description?: string };

async function tgCall<T = unknown>(method: string, payload: Record<string, unknown>): Promise<TgResult<T>> {
  const token = tiktokBotToken();
  if (!token) return { ok: false, description: "TIKTOK_BOT_TOKEN não configurado" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as TgResult<T> | null;
    if (!data) return { ok: false, description: `resposta inválida (${res.status})` };
    if (!data.ok) console.error(`[tiktok-bot] ${method} falhou: ${data.description}`);
    return data;
  } catch (err) {
    console.error(`[tiktok-bot] falha na chamada ${method}`, err);
    return { ok: false, description: String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

type SentMessage = { message_id: number };

async function sendText(
  chatId: number | string,
  text: string,
  extra?: Record<string, unknown>,
): Promise<SentMessage | null> {
  const res = await tgCall<SentMessage>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
  return res.ok ? (res.result ?? null) : null;
}

async function answerCallback(callbackQueryId: string, text?: string) {
  await tgCall("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tiktokUrl(username: string): string {
  return `https://www.tiktok.com/@${username}`;
}

// ---------------------------------------------------------------------------
// Username do TikTok — normalização e validação
// ---------------------------------------------------------------------------

/**
 * Aceita "@usuario", "usuario" ou "https://www.tiktok.com/@usuario" e devolve
 * só o handle em lowercase, ou null se inválido.
 */
export function normalizeTiktokUsername(raw: string): string | null {
  let v = raw.trim();
  const urlMatch = v.match(/tiktok\.com\/@?([a-zA-Z0-9._]+)/i);
  if (urlMatch) v = urlMatch[1];
  v = v.replace(/^@+/, "").toLowerCase().trim();
  // Regras do TikTok: 2–24 chars, letras/números/ponto/underscore.
  if (!/^[a-z0-9._]{2,24}$/.test(v)) return null;
  return v;
}

// ---------------------------------------------------------------------------
// Tipos mínimos do update do Telegram
// ---------------------------------------------------------------------------

type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
type TgChat = { id: number; type: string; title?: string };
type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  new_chat_members?: TgUser[];
  left_chat_member?: TgUser;
};
type TgCallbackQuery = { id: string; from: TgUser; message?: TgMessage; data?: string };
type TgChatMemberUpdated = {
  chat: TgChat;
  old_chat_member?: { status: string; user: TgUser };
  new_chat_member: { status: string; user: TgUser };
};

export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
  /** Status do PRÓPRIO bot num chat (adicionado/removido de grupo). */
  my_chat_member?: TgChatMemberUpdated;
  /** Entrada/saída de membros — só chega se estiver no allowed_updates E o bot for admin do grupo. */
  chat_member?: TgChatMemberUpdated;
};

// ---------------------------------------------------------------------------
// Usuários e grupos
// ---------------------------------------------------------------------------

function displayName(u: TgUser): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || String(u.id);
}

async function upsertBotUser(u: TgUser) {
  return prisma.tiktokBotUser.upsert({
    where: { telegramId: BigInt(u.id) },
    create: {
      telegramId: BigInt(u.id),
      telegramUsername: u.username ?? null,
      telegramName: displayName(u),
    },
    update: {
      telegramUsername: u.username ?? null,
      telegramName: displayName(u),
    },
  });
}

async function upsertGroup(chat: TgChat, active = true) {
  return prisma.tiktokBotGroup.upsert({
    where: { telegramGroupId: BigInt(chat.id) },
    create: { telegramGroupId: BigInt(chat.id), title: chat.title ?? null, active },
    update: { title: chat.title ?? null, active },
  });
}

async function isBotAdmin(telegramId: number): Promise<boolean> {
  const settings = await getTiktokBotSettings();
  return settings.adminTelegramIds.includes(String(telegramId));
}

/** Filtro dos perfis aptos a entrar em divulgação. */
function eligibleWhere(nicheFilter?: string | null): Prisma.TiktokBotUserWhereInput {
  return {
    tiktokUsername: { not: null },
    active: true,
    banned: false,
    pendingReview: false,
    notFoundAt: null,
    ...(nicheFilter ? { niche: nicheFilter } : {}),
  };
}

// ---------------------------------------------------------------------------
// Mensagens do bot
// ---------------------------------------------------------------------------

const REGISTER_BUTTON = {
  inline_keyboard: [[{ text: "🎵 Cadastrar meu TikTok", callback_data: "tiktok:register" }]],
};

const HELP_TEXT = [
  "🤖 <b>TikTok Growth Bot</b>",
  "",
  "/cadastro — cadastrar ou atualizar seu usuário do TikTok",
  "/perfil — ver seu cadastro e estatísticas",
  "/editar — alterar seu usuário do TikTok",
  "/remover — sair das divulgações",
  "/ajuda — esta mensagem",
  "",
  "Cadastre seu perfil e ele entra no rodízio de divulgações automáticas. Siga os perfis divulgados e deixe um ❤️ no vídeo mais recente deles — todos crescem juntos! 🚀",
].join("\n");

const ASK_USERNAME_TEXT = [
  "Me envie seu usuário do TikTok. Pode ser em qualquer um destes formatos:",
  "",
  "• @usuario",
  "• usuario",
  "• https://www.tiktok.com/@usuario",
].join("\n");

function nicheKeyboard() {
  // 2 nichos por linha.
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < TIKTOK_NICHES.length; i += 2) {
    rows.push(
      TIKTOK_NICHES.slice(i, i + 2).map((n) => ({ text: n.label, callback_data: `tiktok:niche:${n.key}` })),
    );
  }
  return { inline_keyboard: rows };
}

async function sendWelcome(chatId: number, users: TgUser[]) {
  const settings = await getTiktokBotSettings();
  const names = users.map((u) => escapeHtml(displayName(u))).join(", ");
  await sendText(chatId, `${escapeHtml(settings.welcomeMessage)}\n\n👉 ${names}`, {
    reply_markup: REGISTER_BUTTON,
  });
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

async function handleCadastro(chatId: number, from: TgUser) {
  const user = await upsertBotUser(from);
  await prisma.tiktokBotUser.update({ where: { id: user.id }, data: { pendingAction: "register" } });
  await sendText(chatId, ASK_USERNAME_TEXT);
}

async function handlePerfil(chatId: number, from: TgUser) {
  const user = await prisma.tiktokBotUser.findUnique({ where: { telegramId: BigInt(from.id) } });
  if (!user || !user.tiktokUsername) {
    await sendText(chatId, "Você ainda não cadastrou seu TikTok. Use /cadastro para participar!", {
      reply_markup: REGISTER_BUTTON,
    });
    return;
  }
  const lines = [
    "👤 <b>Seu perfil</b>",
    "",
    `🎵 TikTok: <a href="${tiktokUrl(user.tiktokUsername)}">@${user.tiktokUsername}</a>`,
    `🏷 Nicho: ${nicheLabel(user.niche)}`,
    `📣 Divulgações: ${user.shareCount}`,
    `🕒 Última divulgação: ${user.lastSharedAt ? user.lastSharedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "ainda não divulgado"}`,
    `✅ Status: ${user.banned ? "banido" : user.pendingReview ? "em revisão" : user.active ? "ativo" : "pausado"}`,
  ];
  await sendText(chatId, lines.join("\n"));
}

async function handleRemover(chatId: number, from: TgUser) {
  const user = await prisma.tiktokBotUser.findUnique({ where: { telegramId: BigInt(from.id) } });
  if (!user) {
    await sendText(chatId, "Você não tem cadastro ativo.");
    return;
  }
  await prisma.tiktokBotUser.update({ where: { id: user.id }, data: { active: false, pendingAction: null } });
  await sendText(chatId, "Pronto — você saiu das divulgações automáticas. Use /cadastro quando quiser voltar. 👋");
}

async function handleStats(chatId: number) {
  const [total, ativos, shares, settings] = await Promise.all([
    prisma.tiktokBotUser.count({ where: { tiktokUsername: { not: null } } }),
    prisma.tiktokBotUser.count({ where: eligibleWhere() }),
    prisma.tiktokBotShare.count(),
    getTiktokBotSettings(),
  ]);
  const lines = [
    "📊 <b>Estatísticas</b>",
    "",
    `👥 Perfis cadastrados: ${total}`,
    `✅ Ativos no rodízio: ${ativos}`,
    `📣 Divulgações feitas: ${shares}`,
    `⏱ Intervalo: ${settings.shareIntervalMinutes} min · ${settings.profilesPerPost} perfis por post`,
    `🏷 Nicho em divulgação: ${settings.nicheFilter ? nicheLabel(settings.nicheFilter) : "todos"}`,
    `🤖 Divulgação automática: ${settings.enabled ? "ligada" : "desligada"}`,
  ];
  await sendText(chatId, lines.join("\n"));
}

async function handleUsuarios(chatId: number) {
  const users = await prisma.tiktokBotUser.findMany({
    where: { tiktokUsername: { not: null } },
    orderBy: [{ lastSharedAt: { sort: "asc", nulls: "first" } }],
    take: 50,
  });
  if (users.length === 0) {
    await sendText(chatId, "Nenhum perfil cadastrado ainda.");
    return;
  }
  const lines = users.map((u) => {
    const flag = u.banned ? "🚫" : u.pendingReview ? "⚠️" : u.notFoundAt ? "❓" : u.active ? "✅" : "⏸";
    return `${flag} @${u.tiktokUsername} · ${u.shareCount} divulgações`;
  });
  await sendText(chatId, `👥 <b>Perfis (fila de divulgação)</b>\n\n${lines.join("\n")}`);
}

async function handleBan(chatId: number, arg: string) {
  const username = normalizeTiktokUsername(arg);
  if (!username) {
    await sendText(chatId, "Uso: /ban @usuario_tiktok");
    return;
  }
  const user = await prisma.tiktokBotUser.findUnique({ where: { tiktokUsername: username } });
  if (!user) {
    await sendText(chatId, `Perfil @${username} não encontrado.`);
    return;
  }
  await prisma.tiktokBotUser.update({ where: { id: user.id }, data: { banned: true, active: false } });
  await sendText(chatId, `🚫 @${username} banido das divulgações.`);
}

async function handleBroadcast(text: string): Promise<number> {
  const groups = await prisma.tiktokBotGroup.findMany({ where: { active: true } });
  let sent = 0;
  for (const g of groups) {
    const ok = await sendText(g.telegramGroupId.toString(), escapeHtml(text));
    if (ok) sent += 1;
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Cadastro via texto livre (pendingAction)
// ---------------------------------------------------------------------------

async function handleUsernameSubmission(chatId: number, from: TgUser, text: string) {
  const username = normalizeTiktokUsername(text);
  if (!username) {
    await sendText(
      chatId,
      "Hmm, não reconheci esse usuário. 🤔 Envie no formato <b>@usuario</b>, <b>usuario</b> ou o link do seu perfil (tiktok.com/@usuario).",
    );
    return;
  }

  // Impede duplicidade: outro Telegram já dono desse handle.
  const conflict = await prisma.tiktokBotUser.findUnique({ where: { tiktokUsername: username } });
  if (conflict && conflict.telegramId !== BigInt(from.id)) {
    await sendText(chatId, `O perfil @${username} já está cadastrado por outro membro. Se for seu, fale com um admin.`);
    return;
  }

  await prisma.tiktokBotUser.update({
    where: { telegramId: BigInt(from.id) },
    data: { tiktokUsername: username, active: true, banned: false, notFoundAt: null, pendingAction: null },
  });
  await sendText(
    chatId,
    [
      `✅ Cadastro concluído, <b>${escapeHtml(displayName(from))}</b>!`,
      "",
      `🎵 <a href="${tiktokUrl(username)}">@${username}</a> entrou no rodízio de divulgações.`,
      "",
      "Pra fechar: qual é o seu conteúdo? 👇",
    ].join("\n"),
    { reply_markup: nicheKeyboard() },
  );
}

// ---------------------------------------------------------------------------
// Callbacks (botões)
// ---------------------------------------------------------------------------

async function handleCallback(cb: TgCallbackQuery): Promise<void> {
  const data = cb.data ?? "";
  const chatId = cb.message?.chat.id;

  if (data === "tiktok:register") {
    await answerCallback(cb.id);
    const user = await upsertBotUser(cb.from);
    await prisma.tiktokBotUser.update({ where: { id: user.id }, data: { pendingAction: "register" } });
    if (chatId != null) {
      await sendText(chatId, `${escapeHtml(displayName(cb.from))}, ${ASK_USERNAME_TEXT}`);
    }
    return;
  }

  if (data.startsWith("tiktok:niche:")) {
    const key = data.slice("tiktok:niche:".length);
    if (!TIKTOK_NICHES.some((n) => n.key === key)) {
      await answerCallback(cb.id);
      return;
    }
    await prisma.tiktokBotUser
      .update({ where: { telegramId: BigInt(cb.from.id) }, data: { niche: key } })
      .catch(() => null);
    await answerCallback(cb.id, `Nicho salvo: ${nicheLabel(key)}`);
    if (chatId != null) {
      await sendText(chatId, `🏷 ${escapeHtml(displayName(cb.from))} definiu o nicho: <b>${nicheLabel(key)}</b>. Bora crescer! 🚀`);
    }
    return;
  }

  if (data === "tiktok:confirm" || data === "tiktok:leave") {
    const stay = data === "tiktok:confirm";
    await prisma.tiktokBotUser
      .update({
        where: { telegramId: BigInt(cb.from.id) },
        data: stay ? { lastConfirmedAt: new Date(), active: true } : { active: false },
      })
      .catch(() => null);
    await answerCallback(cb.id, stay ? "Confirmado! Você segue no rodízio. 🚀" : "Você saiu das divulgações. Até logo! 👋");
    return;
  }

  if (data.startsWith("tiktok:survey:")) {
    const [, , idRaw, bucket] = data.split(":");
    const surveyId = parseInt(idRaw, 10);
    if (!Number.isFinite(surveyId) || !SURVEY_BUCKETS.includes(bucket)) {
      await answerCallback(cb.id);
      return;
    }
    const survey = await prisma.tiktokBotSurvey.findUnique({ where: { id: surveyId }, include: { user: true } });
    // Só o dono da pesquisa responde, e só uma vez.
    if (!survey || survey.user.telegramId !== BigInt(cb.from.id) || survey.answeredAt) {
      await answerCallback(cb.id);
      return;
    }
    await prisma.tiktokBotSurvey.update({
      where: { id: surveyId },
      data: { answeredAt: new Date(), bucket },
    });
    await answerCallback(cb.id, "Obrigado! Sua resposta ajuda a melhorar as divulgações. 📈");
    return;
  }

  if (data.startsWith("tiktok:report:")) {
    const targetId = parseInt(data.slice("tiktok:report:".length), 10);
    if (!Number.isFinite(targetId)) {
      await answerCallback(cb.id);
      return;
    }
    const target = await prisma.tiktokBotUser.findUnique({ where: { id: targetId } });
    if (!target) {
      await answerCallback(cb.id, "Perfil não encontrado.");
      return;
    }
    if (target.telegramId === BigInt(cb.from.id)) {
      await answerCallback(cb.id, "Você não pode denunciar o próprio perfil. 😉");
      return;
    }
    await prisma.tiktokBotReport
      .create({ data: { targetUserId: targetId, reporterTelegramId: BigInt(cb.from.id) } })
      .catch(() => null); // já denunciou antes — conta 1x
    const count = await prisma.tiktokBotReport.count({ where: { targetUserId: targetId } });
    if (count >= REPORT_THRESHOLD && !target.pendingReview) {
      await prisma.tiktokBotUser.update({
        where: { id: targetId },
        data: { pendingReview: true, active: false },
      });
    }
    await answerCallback(cb.id, "Denúncia registrada. Obrigado por ajudar a manter a comunidade saudável. 🙏");
    return;
  }

  await answerCallback(cb.id);
}

// ---------------------------------------------------------------------------
// Entrada principal do webhook
// ---------------------------------------------------------------------------

/**
 * Dedupe de boas-vindas: a entrada de um membro pode chegar por DOIS caminhos
 * (mensagem de serviço new_chat_members E update chat_member, quando o bot é
 * admin). Guarda quem foi saudado nos últimos minutos para não repetir.
 */
const recentWelcomes = new Map<number, number>();
const WELCOME_DEDUPE_MS = 10 * 60 * 1000;

function markWelcomed(users: TgUser[]) {
  const now = Date.now();
  for (const [id, ts] of recentWelcomes) {
    if (now - ts > WELCOME_DEDUPE_MS) recentWelcomes.delete(id);
  }
  for (const u of users) recentWelcomes.set(u.id, now);
}

function alreadyWelcomed(userId: number): boolean {
  const ts = recentWelcomes.get(userId);
  return ts != null && Date.now() - ts <= WELCOME_DEDUPE_MS;
}

const MEMBER_STATUSES = ["member", "administrator", "creator", "restricted"];
const GONE_STATUSES = ["left", "kicked"];

export async function handleTiktokBotUpdate(update: TgUpdate): Promise<void> {
  // Bot adicionado/removido de grupo
  const mcm = update.my_chat_member;
  if (mcm && (mcm.chat.type === "group" || mcm.chat.type === "supergroup")) {
    const status = mcm.new_chat_member.status;
    if (status === "member" || status === "administrator") {
      await upsertGroup(mcm.chat, true);
    } else if (status === "left" || status === "kicked") {
      await upsertGroup(mcm.chat, false);
    }
  }

  // Entrada/saída de membros via chat_member — o caminho confiável (chega mesmo
  // quando o grupo oculta as mensagens de serviço, mas exige bot admin).
  const cm = update.chat_member;
  if (cm && (cm.chat.type === "group" || cm.chat.type === "supergroup") && !cm.new_chat_member.user.is_bot) {
    const oldStatus = cm.old_chat_member?.status ?? "left";
    const newStatus = cm.new_chat_member.status;
    const member = cm.new_chat_member.user;

    if (GONE_STATUSES.includes(oldStatus) && MEMBER_STATUSES.includes(newStatus)) {
      await upsertGroup(cm.chat, true);
      await upsertBotUser(member);
      if (!alreadyWelcomed(member.id)) {
        markWelcomed([member]);
        await sendWelcome(cm.chat.id, [member]);
      }
    } else if (MEMBER_STATUSES.includes(oldStatus) && GONE_STATUSES.includes(newStatus)) {
      await prisma.tiktokBotUser
        .update({ where: { telegramId: BigInt(member.id) }, data: { active: false } })
        .catch(() => null);
    }
    return;
  }

  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }

  const msg = update.message;
  if (!msg) return;

  // Boas-vindas a novos membros via mensagem de serviço (fallback quando o bot
  // não é admin; alguns grupos ocultam essa mensagem — daí o chat_member acima).
  const newcomers = (msg.new_chat_members ?? []).filter((u) => !u.is_bot && !alreadyWelcomed(u.id));
  if (newcomers.length > 0) {
    await upsertGroup(msg.chat, true);
    for (const u of newcomers) await upsertBotUser(u);
    markWelcomed(newcomers);
    await sendWelcome(msg.chat.id, newcomers);
    return;
  }

  // Saída do grupo — pausa o perfil
  if (msg.left_chat_member && !msg.left_chat_member.is_bot) {
    await prisma.tiktokBotUser
      .update({ where: { telegramId: BigInt(msg.left_chat_member.id) }, data: { active: false } })
      .catch(() => null);
    return;
  }

  const from = msg.from;
  const text = msg.text?.trim();
  if (!from || from.is_bot || !text) return;

  const chatId = msg.chat.id;

  // Comandos ("/comando" ou "/comando@NomeDoBot")
  const cmdMatch = text.match(/^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]+))?$/i);
  if (cmdMatch) {
    const cmd = cmdMatch[1].toLowerCase();
    const arg = (cmdMatch[2] ?? "").trim();

    switch (cmd) {
      case "start":
      case "ajuda":
      case "help":
        await sendText(chatId, HELP_TEXT, { reply_markup: REGISTER_BUTTON });
        return;
      case "cadastro":
      case "editar":
        await handleCadastro(chatId, from);
        return;
      case "perfil":
        await handlePerfil(chatId, from);
        return;
      case "remover":
        await handleRemover(chatId, from);
        return;
    }

    // Comandos de admin do bot
    if (await isBotAdmin(from.id)) {
      switch (cmd) {
        case "stats":
          await handleStats(chatId);
          return;
        case "usuarios":
          await handleUsuarios(chatId);
          return;
        case "ban":
          await handleBan(chatId, arg);
          return;
        case "broadcast": {
          if (!arg) {
            await sendText(chatId, "Uso: /broadcast sua mensagem");
            return;
          }
          const sent = await handleBroadcast(arg);
          await sendText(chatId, `📣 Broadcast enviado para ${sent} grupo(s).`);
          return;
        }
        case "forcar_divulgacao": {
          const result = await runTiktokShareRound({ force: true });
          await sendText(
            chatId,
            result.ok
              ? `📣 Divulgação enviada: ${result.shared} perfil(is) em ${result.groups} grupo(s).`
              : `⚠️ Divulgação não enviada: ${result.reason}`,
          );
          return;
        }
      }
    }
    return; // comando desconhecido — silêncio (evita ruído em grupo)
  }

  // Texto livre: só interessa se o bot está aguardando o usuário do TikTok.
  const user = await prisma.tiktokBotUser.findUnique({ where: { telegramId: BigInt(from.id) } });
  if (user?.pendingAction === "register" || user?.pendingAction === "edit") {
    await handleUsernameSubmission(chatId, from, text);
  }
}

// ---------------------------------------------------------------------------
// Seleção de perfis — rodízio híbrido
// ---------------------------------------------------------------------------

/**
 * Sorteio híbrido: ~70% das vagas vão para quem está há mais tempo sem
 * divulgação (nunca divulgados primeiro); ~30% são aleatórias entre o resto,
 * com peso extra (x3) para quem entrou há menos de 7 dias — novatos crescem
 * mais rápido e a seleção nunca fica 100% previsível.
 */
async function selectProfiles(count: number, nicheFilter: string | null): Promise<TiktokBotUser[]> {
  const candidates = await prisma.tiktokBotUser.findMany({
    where: eligibleWhere(nicheFilter),
    orderBy: [{ lastSharedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
  });
  if (candidates.length <= count) return candidates;

  const oldestSlots = Math.max(1, Math.round(count * 0.7));
  const picked = candidates.slice(0, oldestSlots);

  const pool = candidates.slice(oldestSlots);
  const newcomerCutoff = daysAgo(NEWCOMER_DAYS);
  const weights = pool.map((u) => (u.createdAt >= newcomerCutoff ? NEWCOMER_WEIGHT : 1));

  while (picked.length < count && pool.length > 0) {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx += 1) {
      r -= weights[idx];
      if (r <= 0) break;
    }
    idx = Math.min(idx, pool.length - 1);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
    weights.splice(idx, 1);
  }

  return picked;
}

// ---------------------------------------------------------------------------
// Divulgação automática
// ---------------------------------------------------------------------------

function shareMessageText(users: TiktokBotUser[]): string {
  const profiles = users.flatMap((u) => [
    `🎵 <a href="${tiktokUrl(u.tiktokUsername!)}">@${u.tiktokUsername}</a>${u.niche ? ` · ${nicheLabel(u.niche)}` : ""}`,
    tiktokUrl(u.tiktokUsername!),
    "",
  ]);
  return [
    "🚀 <b>Hora de crescer juntos!</b>",
    "",
    "Hoje é sua vez de apoiar outros criadores.",
    "",
    "👇 Siga estes perfis:",
    "",
    ...profiles,
    "❤️ Depois curta o vídeo mais recente deles.",
    "",
    "Seu perfil também aparecerá automaticamente em outra rodada.",
  ].join("\n");
}

/** Uma linha de botões por perfil: [📱 Seguir @user] [🚨 denunciar]. */
function shareKeyboard(users: TiktokBotUser[]) {
  return {
    inline_keyboard: users.map((u) => [
      { text: `📱 Seguir @${u.tiktokUsername}`, url: tiktokUrl(u.tiktokUsername!) },
      { text: "🚨", callback_data: `tiktok:report:${u.id}` },
    ]),
  };
}

export type ShareRoundResult =
  | { ok: true; shared: number; groups: number }
  | { ok: false; reason: string };

/** Registra as divulgações e atualiza contadores após envio bem-sucedido. */
async function recordShares(users: TiktokBotUser[], groupId: number, messageId: number, bumpQueue: boolean) {
  await prisma.tiktokBotShare.createMany({
    data: users.map((u) => ({ userId: u.id, groupId, messageId: BigInt(messageId) })),
  });
  if (bumpQueue) {
    await prisma.tiktokBotUser.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { lastSharedAt: new Date(), shareCount: { increment: 1 } },
    });
  } else {
    await prisma.tiktokBotUser.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { shareCount: { increment: 1 } },
    });
  }
}

/**
 * Divulga os próximos N perfis (seleção híbrida) em todos os grupos ativos.
 * Respeita o intervalo configurado, exceto com force=true.
 */
export async function runTiktokShareRound(opts?: { force?: boolean }): Promise<ShareRoundResult> {
  if (!tiktokBotConfigured()) return { ok: false, reason: "TIKTOK_BOT_TOKEN não configurado" };

  const settings = await getTiktokBotSettings();
  if (!settings.enabled && !opts?.force) return { ok: false, reason: "divulgação automática desligada" };

  if (!opts?.force && settings.lastShareAt) {
    const elapsedMin = (Date.now() - settings.lastShareAt.getTime()) / 60000;
    if (elapsedMin < settings.shareIntervalMinutes - 1) {
      return { ok: false, reason: `intervalo de ${settings.shareIntervalMinutes} min ainda não passou` };
    }
  }

  const groups = await prisma.tiktokBotGroup.findMany({ where: { active: true } });
  if (groups.length === 0) return { ok: false, reason: "nenhum grupo ativo" };

  const users = await selectProfiles(Math.max(1, settings.profilesPerPost), settings.nicheFilter);
  if (users.length === 0) return { ok: false, reason: "nenhum perfil ativo cadastrado" };

  const text = shareMessageText(users);
  const keyboard = shareKeyboard(users);

  let sentGroups = 0;
  for (const group of groups) {
    const sent = await sendText(group.telegramGroupId.toString(), text, { reply_markup: keyboard });
    if (!sent) continue;
    sentGroups += 1;
    await recordShares(users, group.id, sent.message_id, false);
  }

  if (sentGroups === 0) return { ok: false, reason: "falha ao enviar para os grupos" };

  const now = new Date();
  await prisma.tiktokBotUser.updateMany({
    where: { id: { in: users.map((u) => u.id) } },
    data: { lastSharedAt: now },
  });
  await prisma.tiktokBotSettings.update({
    where: { id: SETTINGS_ID },
    data: { lastShareAt: now },
  });

  return { ok: true, shared: users.length, groups: sentGroups };
}

// ---------------------------------------------------------------------------
// Follow Friday — sexta 19h, lote grande de perfis
// ---------------------------------------------------------------------------

/**
 * Mensagem especial de sexta com um lote grande de perfis (default 25).
 * Registra as divulgações e incrementa shareCount, mas NÃO mexe em
 * lastSharedAt — o Follow Friday é um bônus e não fura a fila justa.
 */
export async function runFollowFriday(): Promise<ShareRoundResult> {
  if (!tiktokBotConfigured()) return { ok: false, reason: "TIKTOK_BOT_TOKEN não configurado" };

  const settings = await getTiktokBotSettings();
  if (!settings.followFridayEnabled) return { ok: false, reason: "Follow Friday desligado" };

  // Idempotência: no máximo 1 por dia (o cron pode reexecutar).
  if (settings.lastFollowFridayAt && settings.lastFollowFridayAt > hoursAgo(20)) {
    return { ok: false, reason: "Follow Friday de hoje já foi enviado" };
  }

  const groups = await prisma.tiktokBotGroup.findMany({ where: { active: true } });
  if (groups.length === 0) return { ok: false, reason: "nenhum grupo ativo" };

  const users = await prisma.tiktokBotUser.findMany({
    where: eligibleWhere(settings.nicheFilter),
    orderBy: [{ lastSharedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: Math.max(5, settings.followFridayCount),
  });
  if (users.length === 0) return { ok: false, reason: "nenhum perfil ativo cadastrado" };

  const text = [
    "🎉 <b>FOLLOW FRIDAY</b>",
    "",
    "Hoje é dia oficial de fortalecer nossa comunidade.",
    "",
    "Siga todos estes criadores:",
    "",
    ...users.map((u) => `🎵 <a href="${tiktokUrl(u.tiktokUsername!)}">@${u.tiktokUsername}</a> — ${tiktokUrl(u.tiktokUsername!)}`),
    "",
    "❤️ Curta um vídeo recente de cada um.",
    "",
    "Vamos crescer juntos!",
  ].join("\n");

  let sentGroups = 0;
  for (const group of groups) {
    const sent = await sendText(group.telegramGroupId.toString(), text);
    if (!sent) continue;
    sentGroups += 1;
    await recordShares(users, group.id, sent.message_id, false);
  }

  if (sentGroups === 0) return { ok: false, reason: "falha ao enviar para os grupos" };

  await prisma.tiktokBotSettings.update({
    where: { id: SETTINGS_ID },
    data: { lastFollowFridayAt: new Date() },
  });

  return { ok: true, shared: users.length, groups: sentGroups };
}

// ---------------------------------------------------------------------------
// Manutenção — pesquisa de retorno + confirmação de participação
// ---------------------------------------------------------------------------

const SURVEY_BUCKETS = ["0-5", "6-20", "21-50", "50+"];
/** Ponto médio de cada faixa, para a estimativa de seguidores ganhos. */
const SURVEY_BUCKET_MIDPOINT: Record<string, number> = { "0-5": 3, "6-20": 13, "21-50": 35, "50+": 60 };

export type MaintenanceResult = {
  ok: boolean;
  surveysAsked: number;
  confirmationsAsked: number;
  deactivated: number;
  errors: string[];
};

/**
 * Rotina horária: envia a pesquisa de retorno (6–48h após a divulgação, no
 * máximo 1x/semana por pessoa) e a confirmação periódica de participação
 * (a cada 15 dias; sem resposta em 7 dias → pausa o perfil).
 *
 * As duas são DMs — só chegam a quem já abriu chat privado com o bot. Quem
 * nunca abriu simplesmente não recebe (e não é penalizado por isso).
 */
export async function runTiktokBotMaintenance(): Promise<MaintenanceResult> {
  const errors: string[] = [];
  if (!tiktokBotConfigured()) {
    return { ok: false, surveysAsked: 0, confirmationsAsked: 0, deactivated: 0, errors: ["TIKTOK_BOT_TOKEN não configurado"] };
  }
  const settings = await getTiktokBotSettings();
  let surveysAsked = 0;
  let confirmationsAsked = 0;
  let deactivated = 0;

  // Pesquisa de retorno
  if (settings.surveyEnabled) {
    try {
      const candidates = await prisma.tiktokBotUser.findMany({
        where: {
          ...eligibleWhere(),
          lastSharedAt: { gte: hoursAgo(SURVEY_MAX_HOURS), lte: hoursAgo(SURVEY_MIN_HOURS) },
          surveys: { none: { askedAt: { gte: daysAgo(SURVEY_COOLDOWN_DAYS) } } },
        },
        take: 30,
      });
      for (const user of candidates) {
        const survey = await prisma.tiktokBotSurvey.create({ data: { userId: user.id } });
        const sent = await sendText(
          user.telegramId.toString(),
          [
            "📈 <b>Como foi a divulgação?</b>",
            "",
            "Desde a última divulgação, aproximadamente quantos novos seguidores você ganhou?",
          ].join("\n"),
          {
            reply_markup: {
              inline_keyboard: [
                SURVEY_BUCKETS.map((b) => ({ text: b, callback_data: `tiktok:survey:${survey.id}:${b}` })),
              ],
            },
          },
        );
        if (sent) {
          surveysAsked += 1;
        } else {
          // DM bloqueada/nunca aberta — remove a pesquisa para tentar de novo no futuro.
          await prisma.tiktokBotSurvey.delete({ where: { id: survey.id } }).catch(() => null);
        }
      }
    } catch (err) {
      errors.push(`pesquisa: ${String(err)}`);
    }
  }

  // Confirmação periódica de participação
  if (settings.confirmationEnabled) {
    try {
      const cutoff = daysAgo(CONFIRM_EVERY_DAYS);
      const candidates = await prisma.tiktokBotUser.findMany({
        where: {
          ...eligibleWhere(),
          createdAt: { lt: cutoff },
          OR: [{ lastConfirmedAt: null }, { lastConfirmedAt: { lt: cutoff } }],
          AND: [{ OR: [{ confirmationRequestedAt: null }, { confirmationRequestedAt: { lt: cutoff } }] }],
        },
        take: 30,
      });
      for (const user of candidates) {
        const sent = await sendText(
          user.telegramId.toString(),
          [
            "👋 <b>Confirmação de participação</b>",
            "",
            "Você deseja continuar participando das divulgações automáticas?",
            "",
            "Sem resposta em 7 dias, seu perfil é pausado (dá pra voltar com /cadastro).",
          ].join("\n"),
          {
            reply_markup: {
              inline_keyboard: [[
                { text: "✅ Continuar", callback_data: "tiktok:confirm" },
                { text: "👋 Sair", callback_data: "tiktok:leave" },
              ]],
            },
          },
        );
        // Só marca como pedida se a DM chegou — quem nunca abriu o bot não é penalizado.
        if (sent) {
          await prisma.tiktokBotUser.update({
            where: { id: user.id },
            data: { confirmationRequestedAt: new Date() },
          });
          confirmationsAsked += 1;
        }
      }

      // Pausa quem foi perguntado há mais de 7 dias e não respondeu.
      const graceCutoff = daysAgo(CONFIRM_GRACE_DAYS);
      const stale = await prisma.tiktokBotUser.findMany({
        where: {
          active: true,
          confirmationRequestedAt: { not: null, lt: graceCutoff },
        },
      });
      for (const user of stale) {
        if (user.lastConfirmedAt && user.confirmationRequestedAt && user.lastConfirmedAt >= user.confirmationRequestedAt) continue;
        await prisma.tiktokBotUser.update({ where: { id: user.id }, data: { active: false } });
        deactivated += 1;
      }
    } catch (err) {
      errors.push(`confirmação: ${String(err)}`);
    }
  }

  return { ok: true, surveysAsked, confirmationsAsked, deactivated, errors };
}

// ---------------------------------------------------------------------------
// Verificação de contas (404 no TikTok)
// ---------------------------------------------------------------------------

export type AccountCheckResult = {
  ok: boolean;
  checked: number;
  notFound: number;
  errors: string[];
};

/**
 * Checa em lote se os perfis ainda existem no TikTok (rotina semanal, em
 * lotes pequenos e espaçados — mesma filosofia do release-radar para não
 * tomar bloqueio). 404 → pausa o perfil, avisa por DM e marca notFoundAt.
 * Rate limit/erro de rede não penaliza ninguém.
 */
export async function runTiktokAccountCheck(): Promise<AccountCheckResult> {
  const errors: string[] = [];
  const users = await prisma.tiktokBotUser.findMany({
    where: {
      tiktokUsername: { not: null },
      active: true,
      banned: false,
      OR: [{ accountCheckedAt: null }, { accountCheckedAt: { lt: daysAgo(7) } }],
    },
    orderBy: [{ accountCheckedAt: { sort: "asc", nulls: "first" } }],
    take: ACCOUNT_CHECK_BATCH,
  });

  let checked = 0;
  let notFound = 0;

  for (const user of users) {
    try {
      const res = await fetch(tiktokUrl(user.tiktokUsername!), {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      checked += 1;

      if (res.status === 404) {
        notFound += 1;
        await prisma.tiktokBotUser.update({
          where: { id: user.id },
          data: { notFoundAt: new Date(), active: false, accountCheckedAt: new Date() },
        });
        await sendText(
          user.telegramId.toString(),
          `⚠️ Seu usuário do TikTok (<b>@${user.tiktokUsername}</b>) parece não existir mais.\n\nAtualize usando /editar para voltar às divulgações.`,
        );
      } else if (res.ok) {
        await prisma.tiktokBotUser.update({
          where: { id: user.id },
          data: { notFoundAt: null, accountCheckedAt: new Date() },
        });
      } else {
        // 403/429 etc. — inconclusivo; registra a checagem sem penalizar.
        await prisma.tiktokBotUser.update({
          where: { id: user.id },
          data: { accountCheckedAt: new Date() },
        });
      }
    } catch (err) {
      errors.push(`@${user.tiktokUsername}: ${String(err)}`);
    }
    await sleep(ACCOUNT_CHECK_DELAY_MS);
  }

  return { ok: true, checked, notFound, errors };
}

// ---------------------------------------------------------------------------
// Admin (página /admin/tiktok-bot)
// ---------------------------------------------------------------------------

export type TiktokBotAdminUser = {
  id: number;
  telegramId: string;
  telegramUsername: string | null;
  telegramName: string | null;
  tiktokUsername: string | null;
  niche: string | null;
  active: boolean;
  banned: boolean;
  pendingReview: boolean;
  reportsCount: number;
  notFound: boolean;
  shareCount: number;
  lastSharedAt: string | null;
  lastConfirmedAt: string | null;
  createdAt: string;
};

export type TiktokBotAdminData = {
  configured: boolean;
  settings: {
    enabled: boolean;
    shareIntervalMinutes: number;
    profilesPerPost: number;
    welcomeMessage: string;
    adminTelegramIds: string[];
    lastShareAt: string | null;
    nicheFilter: string | null;
    followFridayEnabled: boolean;
    followFridayCount: number;
    lastFollowFridayAt: string | null;
    surveyEnabled: boolean;
    confirmationEnabled: boolean;
  };
  groups: { id: number; telegramGroupId: string; title: string | null; active: boolean }[];
  users: TiktokBotAdminUser[];
  recentShares: { id: number; tiktokUsername: string | null; groupTitle: string | null; sharedAt: string }[];
  stats: {
    totalUsers: number;
    activeUsers: number;
    pausedUsers: number;
    pendingReviewUsers: number;
    notFoundUsers: number;
    totalShares: number;
    sharesToday: number;
    registrationsToday: number;
    registrationsWeek: number;
    /** Soma dos pontos médios das faixas respondidas na pesquisa. */
    estimatedFollowers: number;
    surveysAnswered: number;
    surveysAsked: number;
    /** Estimativa de horas para um perfil voltar à fila (ciclo completo). */
    avgQueueHours: number | null;
  };
  surveyBuckets: { bucket: string; count: number }[];
  /** Últimos 14 dias (BRT): cadastros e divulgações por dia, para o dashboard. */
  dailySeries: { date: string; registrations: number; shares: number }[];
};

function brtDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function getTiktokBotAdminData(): Promise<TiktokBotAdminData> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const since14d = daysAgo(14);

  const [settings, groups, users, recentShares, totalShares, sharesToday, surveys, recentUsers14d, recentShares14d] =
    await Promise.all([
      getTiktokBotSettings(),
      prisma.tiktokBotGroup.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.tiktokBotUser.findMany({
        orderBy: [{ lastSharedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
        include: { _count: { select: { reports: true } } },
      }),
      prisma.tiktokBotShare.findMany({
        orderBy: { sharedAt: "desc" },
        take: 30,
        include: { user: { select: { tiktokUsername: true } }, group: { select: { title: true } } },
      }),
      prisma.tiktokBotShare.count(),
      prisma.tiktokBotShare.count({ where: { sharedAt: { gte: startOfDay } } }),
      prisma.tiktokBotSurvey.findMany({ select: { bucket: true, answeredAt: true } }),
      prisma.tiktokBotUser.findMany({ where: { createdAt: { gte: since14d } }, select: { createdAt: true } }),
      prisma.tiktokBotShare.findMany({ where: { sharedAt: { gte: since14d } }, select: { sharedAt: true } }),
    ]);

  const withTiktok = users.filter((u) => u.tiktokUsername);
  const eligible = withTiktok.filter((u) => u.active && !u.banned && !u.pendingReview && !u.notFoundAt);
  const answered = surveys.filter((s) => s.answeredAt && s.bucket);

  const bucketCounts = SURVEY_BUCKETS.map((bucket) => ({
    bucket,
    count: answered.filter((s) => s.bucket === bucket).length,
  }));
  const estimatedFollowers = answered.reduce((sum, s) => sum + (SURVEY_BUCKET_MIDPOINT[s.bucket!] ?? 0), 0);

  // Ciclo estimado: quantas rodadas até todo mundo aparecer × intervalo.
  const avgQueueHours =
    eligible.length > 0
      ? Math.round((Math.ceil(eligible.length / Math.max(1, settings.profilesPerPost)) * settings.shareIntervalMinutes) / 6) / 10
      : null;

  // Série diária (14 dias, BRT) para o dashboard.
  const seriesMap = new Map<string, { registrations: number; shares: number }>();
  for (let i = 13; i >= 0; i -= 1) {
    seriesMap.set(brtDateKey(daysAgo(i)), { registrations: 0, shares: 0 });
  }
  for (const u of recentUsers14d) {
    const key = brtDateKey(u.createdAt);
    const entry = seriesMap.get(key);
    if (entry) entry.registrations += 1;
  }
  for (const s of recentShares14d) {
    const key = brtDateKey(s.sharedAt);
    const entry = seriesMap.get(key);
    if (entry) entry.shares += 1;
  }

  const now = new Date();
  const weekAgo = daysAgo(7);

  return {
    configured: tiktokBotConfigured(),
    settings: {
      enabled: settings.enabled,
      shareIntervalMinutes: settings.shareIntervalMinutes,
      profilesPerPost: settings.profilesPerPost,
      welcomeMessage: settings.welcomeMessage,
      adminTelegramIds: settings.adminTelegramIds,
      lastShareAt: settings.lastShareAt?.toISOString() ?? null,
      nicheFilter: settings.nicheFilter,
      followFridayEnabled: settings.followFridayEnabled,
      followFridayCount: settings.followFridayCount,
      lastFollowFridayAt: settings.lastFollowFridayAt?.toISOString() ?? null,
      surveyEnabled: settings.surveyEnabled,
      confirmationEnabled: settings.confirmationEnabled,
    },
    groups: groups.map((g) => ({
      id: g.id,
      telegramGroupId: g.telegramGroupId.toString(),
      title: g.title,
      active: g.active,
    })),
    users: users.map((u) => ({
      id: u.id,
      telegramId: u.telegramId.toString(),
      telegramUsername: u.telegramUsername,
      telegramName: u.telegramName,
      tiktokUsername: u.tiktokUsername,
      niche: u.niche,
      active: u.active,
      banned: u.banned,
      pendingReview: u.pendingReview,
      reportsCount: u._count.reports,
      notFound: Boolean(u.notFoundAt),
      shareCount: u.shareCount,
      lastSharedAt: u.lastSharedAt?.toISOString() ?? null,
      lastConfirmedAt: u.lastConfirmedAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
    recentShares: recentShares.map((s) => ({
      id: s.id,
      tiktokUsername: s.user.tiktokUsername,
      groupTitle: s.group.title,
      sharedAt: s.sharedAt.toISOString(),
    })),
    stats: {
      totalUsers: withTiktok.length,
      activeUsers: eligible.length,
      pausedUsers: withTiktok.filter((u) => !u.active && !u.banned).length,
      pendingReviewUsers: withTiktok.filter((u) => u.pendingReview).length,
      notFoundUsers: withTiktok.filter((u) => u.notFoundAt).length,
      totalShares,
      sharesToday,
      registrationsToday: users.filter((u) => brtDateKey(u.createdAt) === brtDateKey(now)).length,
      registrationsWeek: users.filter((u) => u.createdAt >= weekAgo).length,
      estimatedFollowers,
      surveysAnswered: answered.length,
      surveysAsked: surveys.length,
      avgQueueHours,
    },
    surveyBuckets: bucketCounts,
    dailySeries: Array.from(seriesMap.entries()).map(([date, v]) => ({ date, ...v })),
  };
}

/** Registra o webhook do bot no Telegram apontando para a URL pública informada. */
export async function setTiktokBotWebhook(publicBaseUrl: string): Promise<{ ok: boolean; detail: string }> {
  const url = `${publicBaseUrl.replace(/\/$/, "")}/api/tiktok-bot/webhook`;
  // "chat_member" precisa ser pedido explicitamente (o Telegram não o entrega
  // por padrão) e só chega nos grupos em que o bot é ADMINISTRADOR — é o
  // caminho confiável das boas-vindas quando o grupo oculta mensagens de serviço.
  const res = await tgCall("setWebhook", {
    url,
    secret_token: tiktokBotWebhookSecret() ?? undefined,
    allowed_updates: ["message", "callback_query", "my_chat_member", "chat_member"],
    drop_pending_updates: false,
  });
  return { ok: res.ok, detail: res.ok ? url : (res.description ?? "falha") };
}

export async function getTiktokBotInfo(): Promise<{ ok: boolean; username?: string; webhookUrl?: string; detail?: string }> {
  const me = await tgCall<{ username?: string }>("getMe", {});
  if (!me.ok) return { ok: false, detail: me.description };
  const wh = await tgCall<{ url?: string }>("getWebhookInfo", {});
  return { ok: true, username: me.result?.username, webhookUrl: wh.result?.url || undefined };
}

export { handleBroadcast as sendTiktokBotBroadcast };
