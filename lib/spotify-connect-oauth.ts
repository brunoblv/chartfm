import crypto from "crypto";

/** Mensagens compartilhadas pelo OAuth Spotify de usuários comuns (/api/spotify/connect). */

const STATE_TTL_MS = 600_000;

type StatePayload = {
  n: string;
  u: string;
  r: string;
  f?: string;
  e: number;
};

function stateSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for Spotify OAuth state");
  return secret;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** State assinado — não depende de cookies (evita invalid_state em www/Safari/navegador in-app). */
export function createSpotifyConnectState(
  userId: string,
  redirectUri: string,
  from?: string,
): string {
  const payload: StatePayload = {
    n: crypto.randomBytes(16).toString("hex"),
    u: userId,
    r: redirectUri,
    f: from,
    e: Date.now() + STATE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyStatePayload(state: string): StatePayload | null {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
  } catch {
    return null;
  }
}

/** Valida o state assinado e retorna o userId sem depender de cookies de sessão. */
export function parseSpotifyConnectState(
  state: string,
): { userId: string; redirectUri: string; from?: string } | null {
  const payload = verifyStatePayload(state);
  if (!payload?.u || !payload.r || !payload.e) return null;
  if (payload.e < Date.now()) return null;
  return { userId: payload.u, redirectUri: payload.r, from: payload.f };
}

export function verifySpotifyConnectState(
  state: string,
  userId: string,
): { redirectUri: string; from?: string } | null {
  const parsed = parseSpotifyConnectState(state);
  if (!parsed || parsed.userId !== userId) return null;
  return { redirectUri: parsed.redirectUri, from: parsed.from };
}

/** Mensagem amigável para o parâmetro `?spotify=` retornado após o OAuth. */
export function spotifyConnectErrorMessage(status: string, reason?: string | null): string | null {
  switch (status) {
    case "connected":
      return null;
    case "invalid_state":
      return (
        "A sessão de conexão expirou ou foi invalidada. Tente conectar novamente em até 10 minutos " +
        "usando o site chartfm.com.br (sem www) e evite navegadores in-app (Instagram, TikTok, etc.)."
      );
    case "token_error":
      return (
        "Não foi possível concluir a autorização com o Spotify (erro ao trocar o código por token). " +
        "Tente novamente; se persistir, avise o suporte do ChartFM."
      );
    case "no_refresh_token":
      return (
        "O Spotify não enviou permissão de acesso contínuo. Remova o ChartFM em " +
        "spotify.com/account/apps, reconecte e aceite todas as permissões."
      );
    case "access_denied":
      return (
        "Autorização negada pelo Spotify. Se você cancelou, tente de novo. " +
        "Se apareceu uma mensagem sobre conta não registrada, o app ainda está em modo de desenvolvimento " +
        "da Spotify — entre em contato pelo contato@chartfm.com.br para solicitar acesso."
      );
    case "not_registered":
      return (
        "Sua conta Spotify não está autorizada a usar o ChartFM. " +
        "O app está em modo de desenvolvimento da Spotify (máx. 5 usuários cadastrados manualmente). " +
        "Envie seu e-mail da conta Spotify para contato@chartfm.com.br para liberarmos o acesso."
      );
    case "error":
      if (reason === "access_denied") return spotifyConnectErrorMessage("access_denied");
      if (reason === "invalid_scope") {
        return "O Spotify recusou as permissões solicitadas. Tente conectar novamente e aceite todas as permissões.";
      }
      return reason
        ? `Erro retornado pelo Spotify (${reason}). Tente novamente ou entre em contato com o suporte.`
        : "Erro ao conectar o Spotify. Tente novamente.";
    default:
      return `Erro ao conectar o Spotify (${status}). Tente novamente.`;
  }
}
