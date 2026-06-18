/** Cookies e mensagens compartilhados pelo OAuth Spotify de usuários comuns (/api/spotify/connect). */

export const SPOTIFY_CONNECT_STATE_COOKIE = "spotify_connect_state";
export const SPOTIFY_CONNECT_FROM_COOKIE = "spotify_connect_from";
export const SPOTIFY_CONNECT_REDIRECT_URI_COOKIE = "spotify_connect_redirect_uri";

export const SPOTIFY_CONNECT_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

/** Mensagem amigável para o parâmetro `?spotify=` retornado após o OAuth. */
export function spotifyConnectErrorMessage(status: string, reason?: string | null): string | null {
  switch (status) {
    case "connected":
      return null;
    case "invalid_state":
      return (
        "A sessão de conexão expirou ou foi invalidada. Feche outras abas, tente de novo em até 10 minutos " +
        "e evite navegadores in-app (Instagram, TikTok, etc.)."
      );
    case "token_error":
      return (
        "Não foi possível concluir a autorização com o Spotify (erro ao trocar o código por token). " +
        "Tente novamente; se persistir, avise o suporte do ChartFM."
      );
    case "access_denied":
      return (
        "Autorização negada pelo Spotify. Se você cancelou, tente de novo. " +
        "Se apareceu uma mensagem sobre conta não registrada, o app ainda pode estar em modo de desenvolvimento " +
        "— peça ao suporte para liberar sua conta."
      );
    case "not_registered":
      return (
        "Sua conta Spotify ainda não está autorizada a usar o ChartFM. " +
        "O app pode estar em modo de desenvolvimento da Spotify (máx. 5 usuários). " +
        "Entre em contato pelo contato@chartfm.app para solicitar acesso."
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
