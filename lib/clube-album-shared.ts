/**
 * Constantes do Clube do Álbum compartilhadas entre servidor e client.
 * Mantido separado de `clube-album.ts` porque aquele módulo puxa a cadeia de
 * notificações do servidor (system-feed → telegram → playwright), que não pode
 * entrar no bundle do navegador.
 */

/** Mínimo de álbuns que o usuário precisa votar na enquete do Clube. */
export const MIN_POLL_VOTES = 7;
