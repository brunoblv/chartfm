import crypto from "crypto";

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
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for YouTube OAuth state");
  return secret;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function createYouTubeConnectState(
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
export function parseYouTubeConnectState(
  state: string,
): { userId: string; redirectUri: string; from?: string } | null {
  const payload = verifyStatePayload(state);
  if (!payload?.u || !payload.r || !payload.e) return null;
  if (payload.e < Date.now()) return null;
  return { userId: payload.u, redirectUri: payload.r, from: payload.f };
}

export function verifyYouTubeConnectState(
  state: string,
  userId: string,
): { redirectUri: string; from?: string } | null {
  const parsed = parseYouTubeConnectState(state);
  if (!parsed || parsed.userId !== userId) return null;
  return { redirectUri: parsed.redirectUri, from: parsed.from };
}

export function youtubeConnectErrorMessage(status: string, reason?: string | null): string | null {
  switch (status) {
    case "connected":
      return null;
    case "invalid_state":
      return "A sessão de conexão com o YouTube expirou. Tente novamente.";
    case "token_error":
      return "Não foi possível concluir a autorização com o YouTube. Tente novamente.";
    case "no_refresh_token":
      return "O Google não enviou permissão de acesso contínuo. Reconecte e aceite todas as permissões.";
    case "access_denied":
      return "Autorização negada pelo Google. Tente conectar novamente.";
    case "wrong_channel":
      return "A conta Google conectada não é do canal @chartFM. Use a conta que administra youtube.com/@chartFM.";
    case "error":
      return reason
        ? `Erro retornado pelo Google (${reason}). Tente novamente.`
        : "Erro ao conectar o YouTube. Tente novamente.";
    default:
      return `Erro ao conectar o YouTube (${status}). Tente novamente.`;
  }
}
