/** Mensagens amigáveis para o parâmetro `?spotify=` retornado após o OAuth (uso no cliente). */
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
