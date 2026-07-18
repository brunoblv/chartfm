type SongLike = { artist: string; featArtists?: string[] };

export type ArtistCreditSplit = { main: string; feats: string[] };

// "feat"/"ft" seguido de espaço (não "Featuring", tratado à parte pra não
// disparar em falso quando o alternativo "feat" bate só o prefixo).
const FEAT_KEYWORD = /\s+(?:feat\.?|featuring|ft\.?)\s+/i;
const X_SEPARATOR = /\s+x\s+/i;

function splitFeatNames(raw: string): string[] {
  return raw
    .split(/\s*&\s*|\s+and\s+|\s*,\s*/i)
    .map((n) => n.trim())
    .filter(Boolean);
}

/**
 * Extrai o artista principal e os featurings de um crédito de artista bruto.
 * Cobre os formatos vistos em import/colagem manual: "A feat. B", "A ft. B",
 * "A Featuring B" e "A, B, C" (lista separada por vírgula).
 *
 * NÃO separa por "x" aqui — existem artistas cujo nome já tem "x" (Chloe x
 * Halle, por exemplo), e essa função não tem como saber por texto puro se é
 * um separador de featuring ou parte do nome. Quem precisar tratar "A x B"
 * deve primeiro checar se "A" já é um artista conhecido no catálogo (ver
 * `splitByXSeparator` + consulta ao catálogo em lib/resolve-publish-songs.ts).
 */
export function splitArtistCredits(raw: string): ArtistCreditSplit {
  const artist = raw.trim();
  if (!artist) return { main: "", feats: [] };

  const featMatch = artist.match(new RegExp(`^(.*?)${FEAT_KEYWORD.source}(.+)$`, "i"));
  if (featMatch?.[1]?.trim() && featMatch[2]?.trim()) {
    return { main: featMatch[1].trim(), feats: splitFeatNames(featMatch[2]) };
  }

  const commaParts = artist.split(",").map((p) => p.trim()).filter(Boolean);
  if (commaParts.length > 1) {
    return { main: commaParts[0], feats: commaParts.slice(1) };
  }

  return { main: artist, feats: [] };
}

/**
 * Separa "A x B x C" em partes, sem decidir se é featuring — só quem chama
 * sabe (via catálogo) se o primeiro nome é um artista já conhecido antes de
 * usar isso para dividir em principal + feats.
 */
export function splitByXSeparator(raw: string): string[] {
  return raw
    .split(X_SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Normaliza um crédito de artista bruto para o formato canônico salvo no
 * banco: só o artista principal em `Song.artist`, com os featurings
 * anexados como "Principal feat. A & B". Usar antes de gravar `Song.artist`
 * sempre que o texto vier de busca/colagem livre (sem já ter passado pelo
 * Spotify, que devolve o artista principal isolado).
 */
export function normalizeArtistCredit(raw: string): string {
  const { main, feats } = splitArtistCredits(raw);
  if (!main) return raw.trim();
  if (!feats.length) return main;
  return `${main} feat. ${feats.join(" & ")}`;
}

export function formatSongArtist(song: SongLike): string {
  const main = song.artist?.trim() ?? "";
  const explicitFeats = (song.featArtists ?? []).map((name) => name.trim()).filter(Boolean);
  if (explicitFeats.length) {
    return explicitFeats.length === 1 ? `${main} feat. ${explicitFeats[0]}` : `${main} feat. ${explicitFeats.join(" & ")}`;
  }
  return normalizeArtistCredit(main);
}
