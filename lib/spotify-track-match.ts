import { searchSpotifyTracks } from "@/lib/spotify-server";
import { VERSION_TAG_CLEANERS, cleanVersionTag, type VersionTagType } from "@/lib/clean-version-tag";

/**
 * Match de faixa no Spotify para os fluxos de admin (edição de dados e
 * backfill de pendências): em vez de aceitar o primeiro resultado da busca,
 * tenta variantes de query (filtros track:/artist:, título sem feat, mercados
 * BR→US) e só aceita faixa cujo álbum é álbum/single/EP do próprio artista —
 * coletâneas e "Various Artists" nunca entram, para não sujar o banco.
 */

export type SpotifyTrackHit = Awaited<ReturnType<typeof searchSpotifyTracks>>[number];

const FEAT_PAREN_RE = /\s*[([]\s*(?:feat\.?|ft\.?|featuring|with|part\.?|participação(?:\s+especial)?)\s[^)\]]*[)\]]/gi;
const FEAT_DASH_RE = /\s*[-–—]\s*(?:feat\.?|ft\.?|featuring)\s+.*$/i;
const ARTIST_FEAT_RE = /\s+(?:feat\.?|featuring|ft\.?|with|w\/|part\.?)\s+.*$/i;

export function stripFeatFromTitle(title: string): string {
  const out = title.replace(FEAT_PAREN_RE, " ").replace(FEAT_DASH_RE, "").replace(/\s+/g, " ").trim();
  return out || title.trim();
}

/** Artista principal: remove feat/with e fica com o primeiro nome antes de vírgula/&/x. */
export function primaryArtistName(artist: string): string {
  const noFeat = artist.replace(ARTIST_FEAT_RE, "").trim();
  const first = noFeat.split(/\s*[,;]\s*|\s+&\s+/)[0]?.trim();
  return first || artist.trim();
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/['’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * true quando o candidato só "bate" com o título buscado porque tem uma tag de
 * versão a mais (live, remix, acoustic, remaster, etc.) que o título buscado não
 * tem — ex.: buscar "Genie In a Bottle" não pode aceitar "Genie In a Bottle -
 * Live from the Crazy Horse". Músicas cujo título já contém a palavra (ex.
 * "Show Me How to Live") não caem aqui porque batem por igualdade exata antes.
 */
function hasUnwantedVersionTag(candidateTitle: string, wantedTitle: string): boolean {
  const candidateBase = normalize(stripFeatFromTitle(candidateTitle));
  const wantedBase = normalize(stripFeatFromTitle(wantedTitle));
  for (const type of Object.keys(VERSION_TAG_CLEANERS) as VersionTagType[]) {
    const cleanedCandidate = normalize(stripFeatFromTitle(cleanVersionTag(candidateTitle, type)));
    const cleanedWanted = normalize(stripFeatFromTitle(cleanVersionTag(wantedTitle, type)));
    const candidateHasTag = cleanedCandidate !== candidateBase;
    const wantedHasTag = cleanedWanted !== wantedBase;
    if (candidateHasTag && !wantedHasTag && cleanedCandidate === wantedBase) {
      return true;
    }
  }
  return false;
}

function titleMatches(candidateTitle: string, wantedTitle: string): boolean {
  const c = normalize(stripFeatFromTitle(candidateTitle));
  const w = normalize(stripFeatFromTitle(wantedTitle));
  if (!c || !w) return false;
  if (c === w) return true;
  if (hasUnwantedVersionTag(candidateTitle, wantedTitle)) return false;
  return c.startsWith(w) || w.startsWith(c);
}

function someNameMatches(names: string[], wanted: string): boolean {
  const w = normalize(wanted);
  if (!w) return false;
  return names.some((n) => {
    const c = normalize(n);
    return c === w || c.includes(w) || w.includes(c);
  });
}

/**
 * true quando a faixa está num lançamento do próprio artista (álbum/single/EP),
 * e não numa coletânea ou em disco de terceiros onde ela só "aparece".
 * Singles colaborativos contam: basta o dono do álbum ser um dos artistas da faixa.
 */
export function isTrackOnOwnRelease(hit: SpotifyTrackHit, wantedArtist: string): boolean {
  if (hit.albumType === "compilation") return false;
  const albumArtists = hit.albumArtistNames ?? [];
  if (albumArtists.some((n) => /various artists/i.test(n))) return false;
  // Sem info de artistas do álbum (ex.: cache antigo) não dá para reprovar.
  if (!albumArtists.length) return true;
  return (
    someNameMatches(albumArtists, primaryArtistName(wantedArtist)) ||
    albumArtists.some((albumArtist) => someNameMatches(hit.artistNames ?? [], albumArtist))
  );
}

function buildQueries(title: string, artist: string): string[] {
  const baseTitle = stripFeatFromTitle(title);
  const mainArtist = primaryArtistName(artist);
  const clean = (s: string) => s.replace(/"/g, "").trim();
  const queries = [
    `track:"${clean(baseTitle)}" artist:"${clean(mainArtist)}"`,
    `${baseTitle} ${mainArtist}`,
    `${title} ${artist}`,
  ];
  return [...new Set(queries.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

/**
 * Busca a faixa no Spotify validando título + artista e exigindo lançamento do
 * próprio artista. Devolve null quando nada aceitável aparece (melhor não
 * vincular do que vincular coletânea/faixa errada).
 */
export async function findSpotifyTrackForSong(
  title: string,
  artist: string,
  opts?: { maxAttempts?: number; deadlineAt?: number; markets?: string[] },
): Promise<SpotifyTrackHit | null> {
  const markets = opts?.markets ?? ["BR", "US"];
  const wantedArtist = primaryArtistName(artist);

  for (const market of markets) {
    for (const query of buildQueries(title, artist)) {
      const hits = await searchSpotifyTracks(query, 8, market, undefined, {
        maxAttempts: opts?.maxAttempts,
        deadlineAt: opts?.deadlineAt,
      });
      const match = hits.find(
        (h) =>
          titleMatches(h.title, title) &&
          (someNameMatches(h.artistNames ?? [], wantedArtist) || someNameMatches(h.artistNames ?? [], artist)) &&
          isTrackOnOwnRelease(h, artist),
      );
      if (match) return match;
    }
  }
  return null;
}
