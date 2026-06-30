/** Mensagens amigáveis para o parâmetro `?youtube=` retornado após o OAuth (uso no cliente). */
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
