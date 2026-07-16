import { prisma } from "@/lib/prisma";

/**
 * TikTok Growth Bot — bot de Telegram (token próprio, separado do bot do
 * ChartFM) para uma comunidade de crescimento mútuo no TikTok.
 *
 * Fluxo: usuário entra no grupo → boas-vindas com botão → cadastra o usuário
 * do TikTok no chat → o cron divulga perfis em intervalos regulares,
 * priorizando quem está há mais tempo sem divulgação.
 *
 * Ver Planejamento_TikTok_Growth_Bot.md. Admin em /admin/tiktok-bot (@bruno).
 */

const API_BASE = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 20000;
const SETTINGS_ID = "default";

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

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  new_chat_member: { status: string; user: TgUser };
};

export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
  my_chat_member?: TgChatMemberUpdated;
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
    `🎵 TikTok: <a href="https://www.tiktok.com/@${user.tiktokUsername}">@${user.tiktokUsername}</a>`,
    `📣 Divulgações: ${user.shareCount}`,
    `🕒 Última divulgação: ${user.lastSharedAt ? user.lastSharedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "ainda não divulgado"}`,
    `✅ Status: ${user.banned ? "banido" : user.active ? "ativo" : "pausado"}`,
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
    prisma.tiktokBotUser.count({ where: { tiktokUsername: { not: null }, active: true, banned: false } }),
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
    const flag = u.banned ? "🚫" : u.active ? "✅" : "⏸";
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
    data: { tiktokUsername: username, active: true, banned: false, pendingAction: null },
  });
  await sendText(
    chatId,
    [
      `✅ Cadastro concluído, <b>${escapeHtml(displayName(from))}</b>!`,
      "",
      `🎵 <a href="https://www.tiktok.com/@${username}">@${username}</a> entrou no rodízio de divulgações.`,
      "Fique de olho no grupo e siga os perfis divulgados — crescimento é via de mão dupla! 🚀",
    ].join("\n"),
  );
}

// ---------------------------------------------------------------------------
// Entrada principal do webhook
// ---------------------------------------------------------------------------

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

  // Botão "Cadastrar meu TikTok"
  const cb = update.callback_query;
  if (cb?.data === "tiktok:register") {
    await tgCall("answerCallbackQuery", { callback_query_id: cb.id });
    const user = await upsertBotUser(cb.from);
    await prisma.tiktokBotUser.update({ where: { id: user.id }, data: { pendingAction: "register" } });
    const chatId = cb.message?.chat.id;
    if (chatId != null) {
      await sendText(chatId, `${escapeHtml(displayName(cb.from))}, ${ASK_USERNAME_TEXT}`);
    }
    return;
  }

  const msg = update.message;
  if (!msg) return;

  // Boas-vindas a novos membros (ignora bots)
  const newcomers = (msg.new_chat_members ?? []).filter((u) => !u.is_bot);
  if (newcomers.length > 0) {
    await upsertGroup(msg.chat, true);
    for (const u of newcomers) await upsertBotUser(u);
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
// Divulgação automática
// ---------------------------------------------------------------------------

export type ShareRoundResult =
  | { ok: true; shared: number; groups: number }
  | { ok: false; reason: string };

/**
 * Divulga os próximos N perfis (quem está há mais tempo sem divulgação
 * primeiro) em todos os grupos ativos. Respeita o intervalo configurado,
 * exceto com force=true.
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

  // Seleção justa: quem nunca foi divulgado primeiro, depois os mais "atrasados".
  const users = await prisma.tiktokBotUser.findMany({
    where: { tiktokUsername: { not: null }, active: true, banned: false },
    orderBy: [{ lastSharedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: Math.max(1, settings.profilesPerPost),
  });
  if (users.length === 0) return { ok: false, reason: "nenhum perfil ativo cadastrado" };

  const lines = [
    "🚀 <b>Hora de crescer juntos!</b>",
    "",
    "Siga estes criadores:",
    "",
    ...users.map((u) => `🎵 <a href="https://www.tiktok.com/@${u.tiktokUsername}">@${u.tiktokUsername}</a>`),
    "",
    "Depois deixe um ❤️ no vídeo mais recente deles.",
  ];
  const text = lines.join("\n");

  let sentGroups = 0;
  for (const group of groups) {
    const sent = await sendText(group.telegramGroupId.toString(), text);
    if (!sent) continue;
    sentGroups += 1;
    await prisma.tiktokBotShare.createMany({
      data: users.map((u) => ({
        userId: u.id,
        groupId: group.id,
        messageId: BigInt(sent.message_id),
      })),
    });
  }

  if (sentGroups === 0) return { ok: false, reason: "falha ao enviar para os grupos" };

  const now = new Date();
  await prisma.tiktokBotUser.updateMany({
    where: { id: { in: users.map((u) => u.id) } },
    data: { lastSharedAt: now, shareCount: { increment: 1 } },
  });
  await prisma.tiktokBotSettings.update({
    where: { id: SETTINGS_ID },
    data: { lastShareAt: now },
  });

  return { ok: true, shared: users.length, groups: sentGroups };
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
  active: boolean;
  banned: boolean;
  shareCount: number;
  lastSharedAt: string | null;
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
  };
  groups: { id: number; telegramGroupId: string; title: string | null; active: boolean }[];
  users: TiktokBotAdminUser[];
  recentShares: { id: number; tiktokUsername: string | null; groupTitle: string | null; sharedAt: string }[];
  stats: { totalUsers: number; activeUsers: number; totalShares: number; sharesToday: number };
};

export async function getTiktokBotAdminData(): Promise<TiktokBotAdminData> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [settings, groups, users, recentShares, totalShares, sharesToday] = await Promise.all([
    getTiktokBotSettings(),
    prisma.tiktokBotGroup.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.tiktokBotUser.findMany({
      orderBy: [{ lastSharedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    }),
    prisma.tiktokBotShare.findMany({
      orderBy: { sharedAt: "desc" },
      take: 30,
      include: { user: { select: { tiktokUsername: true } }, group: { select: { title: true } } },
    }),
    prisma.tiktokBotShare.count(),
    prisma.tiktokBotShare.count({ where: { sharedAt: { gte: startOfDay } } }),
  ]);

  const withTiktok = users.filter((u) => u.tiktokUsername);

  return {
    configured: tiktokBotConfigured(),
    settings: {
      enabled: settings.enabled,
      shareIntervalMinutes: settings.shareIntervalMinutes,
      profilesPerPost: settings.profilesPerPost,
      welcomeMessage: settings.welcomeMessage,
      adminTelegramIds: settings.adminTelegramIds,
      lastShareAt: settings.lastShareAt?.toISOString() ?? null,
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
      active: u.active,
      banned: u.banned,
      shareCount: u.shareCount,
      lastSharedAt: u.lastSharedAt?.toISOString() ?? null,
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
      activeUsers: withTiktok.filter((u) => u.active && !u.banned).length,
      totalShares,
      sharesToday,
    },
  };
}

/** Registra o webhook do bot no Telegram apontando para a URL pública informada. */
export async function setTiktokBotWebhook(publicBaseUrl: string): Promise<{ ok: boolean; detail: string }> {
  const url = `${publicBaseUrl.replace(/\/$/, "")}/api/tiktok-bot/webhook`;
  const res = await tgCall("setWebhook", {
    url,
    secret_token: tiktokBotWebhookSecret() ?? undefined,
    allowed_updates: ["message", "callback_query", "my_chat_member"],
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
