/**
 * Comprimento mínimo da busca tipo-ahead (artista/álbum) no admin.
 * 1 permite títulos de uma letra, ex.: álbum “T”.
 */
export const ADMIN_MUSIC_TYPEAHEAD_MIN_LENGTH = 1;

export function isAdminMusicTypeaheadQueryReady(trimmedQuery: string): boolean {
  return trimmedQuery.length >= ADMIN_MUSIC_TYPEAHEAD_MIN_LENGTH;
}
