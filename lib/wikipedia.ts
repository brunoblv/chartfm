/**
 * Cliente Wikipedia (MediaWiki Action API) — datas de lançamento e bio.
 * Não precisa de chave de API: basta um User-Agent identificado
 * (https://www.mediawiki.org/wiki/API:Etiquette). Opcionalmente defina
 * WIKIPEDIA_USER_AGENT no .env para sobrescrever o padrão.
 *
 * Estratégia para datas de single/clipe:
 *  - single: parâmetro "released" do Infobox song/single (wikitext);
 *  - clipe: frase "music video ... released/premiered on <data>" no texto.
 * A Wikipedia costuma listar VÁRIAS datas de lançamento (por país/formato);
 * devolvemos todas e usamos a mais antiga como data do single.
 */

type WikiLang = "en" | "pt";

const MIN_INTERVAL_MS = 250;
let lastFetchAt = 0;

function userAgent(): string {
  return (
    process.env.WIKIPEDIA_USER_AGENT?.trim() ||
    process.env.MUSICBRAINZ_USER_AGENT?.trim() ||
    "ChartFM/1.0 (https://chartfm.com.br; contact@chartfm.com.br)"
  );
}

async function wikiFetch(lang: WikiLang, params: Record<string, string>): Promise<unknown | null> {
  const wait = lastFetchAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt = Date.now();

  const qs = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${qs.toString()}`, {
    headers: { "User-Agent": userAgent(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function searchTitles(lang: WikiLang, query: string, limit = 4): Promise<string[]> {
  const data = (await wikiFetch(lang, {
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
  })) as { query?: { search?: Array<{ title?: string }> } } | null;
  return (data?.query?.search ?? [])
    .map((s) => s.title?.trim())
    .filter((t): t is string => Boolean(t));
}

async function getWikitext(lang: WikiLang, title: string): Promise<string | null> {
  const data = (await wikiFetch(lang, {
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: title,
  })) as {
    query?: { pages?: Array<{ revisions?: Array<{ slots?: { main?: { content?: string } } }> }> };
  } | null;
  return data?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? null;
}

async function getPlainExtract(lang: WikiLang, title: string, introOnly: boolean): Promise<string | null> {
  const params: Record<string, string> = {
    action: "query",
    prop: "extracts",
    explaintext: "1",
    titles: title,
  };
  if (introOnly) params.exintro = "1";
  const data = (await wikiFetch(lang, params)) as {
    query?: { pages?: Array<{ extract?: string }> };
  } | null;
  return data?.query?.pages?.[0]?.extract ?? null;
}

export function wikipediaPageUrl(lang: WikiLang, title: string): string {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  janeiro: 1, fevereiro: 2, "março": 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function utcDate(y: number, m: number, d: number): Date | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

/** Extrai todas as datas reconhecíveis de um trecho (wikitext ou texto puro). */
export function extractDatesFromText(text: string): Date[] {
  const out: Date[] = [];
  const push = (d: Date | null) => {
    if (d && !out.some((x) => x.getTime() === d.getTime())) out.push(d);
  };

  // {{Start date|2023|5|12}} / {{start date and age|2023|05|12|df=y}}
  const tplRe = /\{\{\s*start date[^|}]*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/gi;
  for (let m = tplRe.exec(text); m; m = tplRe.exec(text)) {
    push(utcDate(Number(m[1]), Number(m[2]), Number(m[3])));
  }

  // ISO: 2023-05-12
  const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  for (let m = isoRe.exec(text); m; m = isoRe.exec(text)) {
    push(utcDate(Number(m[1]), Number(m[2]), Number(m[3])));
  }

  // "May 12, 2023"
  const mdyRe = /\b([A-Za-zçÇ]+)\s+(\d{1,2}),\s*(\d{4})\b/g;
  for (let m = mdyRe.exec(text); m; m = mdyRe.exec(text)) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) push(utcDate(Number(m[3]), month, Number(m[2])));
  }

  // "12 May 2023" / "12 de maio de 2023"
  const dmyRe = /\b(\d{1,2})(?:º)?\s+(?:de\s+)?([A-Za-zçÇ]+)(?:\s+(?:de\s+)?|\s*,\s*)(\d{4})\b/g;
  for (let m = dmyRe.exec(text); m; m = dmyRe.exec(text)) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) push(utcDate(Number(m[3]), month, Number(m[1])));
  }

  return out;
}

function earliest(dates: Date[]): Date | null {
  if (!dates.length) return null;
  return dates.reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
}

/** Valor de um parâmetro do infobox (ex.: "released") no wikitext. */
function infoboxParam(wikitext: string, param: string): string | null {
  const re = new RegExp(`\\|\\s*${param}\\s*=([\\s\\S]*?)(?=\\n\\s*\\|\\s*[\\w_ ]+\\s*=|\\n\\}\\})`, "i");
  const m = re.exec(wikitext);
  return m ? m[1] : null;
}

function normalizeLoose(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A página encontrada menciona o artista? Evita aplicar dados da página errada. */
function pageMatchesArtist(wikitext: string, artist: string): boolean {
  const a = normalizeLoose(artist);
  if (!a) return false;
  const text = normalizeLoose(wikitext.slice(0, 4000));
  return text.includes(a) || text.includes(a.split(" ")[0] ?? a);
}

/** Data do clipe a partir do texto: frases com "music video" + released/premiered. */
function musicVideoDateFromText(plain: string): Date | null {
  const sentences = plain.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (!/music video|videoclipe|vídeo musical/i.test(sentence)) continue;
    if (!/releas|premier|debut|upload|lançad|estreou|estreia/i.test(sentence)) continue;
    if (/lyric video|lyric-video/i.test(sentence)) continue;
    const dates = extractDatesFromText(sentence);
    if (dates.length) return dates[0];
  }
  return null;
}

/** Conteúdo da seção "Music video"/"Videoclipe" do artigo, se existir. */
function musicVideoSection(text: string): string | null {
  const m = /==+\s*(?:music video|videoclipe|vídeo musical)s?\s*==+([\s\S]*?)(?=\n==[^=]|$)/i.exec(text);
  return m ? m[1] : null;
}

/**
 * O texto do artigo cita datas de clipes de OUTRAS músicas; sem esse filtro
 * o regex pode pegar a data errada. O clipe sai perto do single: aceita de
 * 60 dias antes até 3 anos depois da data do single.
 */
function plausibleMusicVideoDate(mv: Date | null, single: Date | null): Date | null {
  if (!mv) return null;
  if (!single) return mv;
  const diff = mv.getTime() - single.getTime();
  const DAY = 24 * 60 * 60 * 1000;
  return diff >= -60 * DAY && diff <= 3 * 365 * DAY ? mv : null;
}

// ---------------------------------------------------------------------------
// Consultas de alto nível
// ---------------------------------------------------------------------------

export type WikipediaSongInfo = {
  lang: WikiLang;
  pageTitle: string;
  pageUrl: string;
  /** Todas as datas do parâmetro "released" (a Wikipedia lista várias, por país/formato). */
  releasedDates: Date[];
  /** A mais antiga das datas de "released" — melhor aposta para a data do single. */
  singleReleaseDate: Date | null;
  musicVideoReleaseDate: Date | null;
};

async function findSongPage(
  lang: WikiLang,
  title: string,
  artist: string,
): Promise<{ pageTitle: string; wikitext: string } | null> {
  const suffix = lang === "pt" ? "canção" : "song";
  const queries = [`"${title}" ${artist} ${suffix}`, `${title} ${artist}`];
  const seen = new Set<string>();
  for (const q of queries) {
    for (const pageTitle of await searchTitles(lang, q)) {
      if (seen.has(pageTitle)) continue;
      seen.add(pageTitle);
      const wikitext = await getWikitext(lang, pageTitle);
      if (!wikitext) continue;
      const isSongPage = /\{\{\s*infobox (song|single|canção)/i.test(wikitext);
      if (isSongPage && pageMatchesArtist(wikitext, artist)) return { pageTitle, wikitext };
    }
  }
  return null;
}

export async function getWikipediaSongInfo(title: string, artist: string): Promise<WikipediaSongInfo | null> {
  for (const lang of ["en", "pt"] as const) {
    const page = await findSongPage(lang, title, artist);
    if (!page) continue;

    const releasedRaw = infoboxParam(page.wikitext, "released") ?? infoboxParam(page.wikitext, "lançado");
    const releasedDates = releasedRaw ? extractDatesFromText(releasedRaw) : [];
    const singleReleaseDate = earliest(releasedDates);

    // 1º a seção "Music video" (wikitext e texto puro); só depois o artigo todo,
    // sempre com o filtro de plausibilidade em relação à data do single.
    const plain = (await getPlainExtract(lang, page.pageTitle, false)) ?? "";
    const sections = [musicVideoSection(page.wikitext), musicVideoSection(plain)];
    let musicVideoReleaseDate: Date | null = null;
    for (const section of sections) {
      if (!section) continue;
      const d =
        plausibleMusicVideoDate(musicVideoDateFromText(section), singleReleaseDate) ??
        plausibleMusicVideoDate(earliest(extractDatesFromText(section)), singleReleaseDate);
      if (d) {
        musicVideoReleaseDate = d;
        break;
      }
    }
    if (!musicVideoReleaseDate) {
      musicVideoReleaseDate =
        plausibleMusicVideoDate(musicVideoDateFromText(page.wikitext), singleReleaseDate) ??
        plausibleMusicVideoDate(musicVideoDateFromText(plain), singleReleaseDate);
    }

    return {
      lang,
      pageTitle: page.pageTitle,
      pageUrl: wikipediaPageUrl(lang, page.pageTitle),
      releasedDates,
      singleReleaseDate,
      musicVideoReleaseDate,
    };
  }
  return null;
}

export type WikipediaAlbumInfo = {
  lang: WikiLang;
  pageTitle: string;
  pageUrl: string;
  releaseDate: Date | null;
};

export async function getWikipediaAlbumInfo(title: string, artist: string): Promise<WikipediaAlbumInfo | null> {
  for (const lang of ["en", "pt"] as const) {
    const suffix = lang === "pt" ? "álbum" : "album";
    for (const pageTitle of await searchTitles(lang, `"${title}" ${artist} ${suffix}`)) {
      const wikitext = await getWikitext(lang, pageTitle);
      if (!wikitext) continue;
      if (!/\{\{\s*infobox (album|álbum)/i.test(wikitext)) continue;
      if (!pageMatchesArtist(wikitext, artist)) continue;
      const releasedRaw = infoboxParam(wikitext, "released") ?? infoboxParam(wikitext, "lançado");
      return {
        lang,
        pageTitle,
        pageUrl: wikipediaPageUrl(lang, pageTitle),
        releaseDate: earliest(releasedRaw ? extractDatesFromText(releasedRaw) : []),
      };
    }
  }
  return null;
}

export type WikipediaArtistBio = {
  lang: WikiLang;
  pageTitle: string;
  pageUrl: string;
  bio: string;
};

const MAX_BIO_LENGTH = 1500;

/** A página tem infobox de artista/banda musical? Evita futebolista, flor, etc. com o mesmo nome. */
function isMusicArtistPage(wikitext: string): boolean {
  return /\{\{\s*infobox (musical artist|banda|artista musical|conjunto musical)\b/i.test(wikitext);
}

/** Bio do artista: intro da Wikipedia em pt (preferido) ou en. */
export async function getWikipediaArtistBio(name: string): Promise<WikipediaArtistBio | null> {
  for (const lang of ["pt", "en"] as const) {
    for (const pageTitle of await searchTitles(lang, name, 3)) {
      const wikitext = await getWikitext(lang, pageTitle);
      if (!wikitext || !isMusicArtistPage(wikitext)) continue;

      const extract = (await getPlainExtract(lang, pageTitle, true))?.trim();
      if (!extract || extract.length < 80) continue;
      if (!normalizeLoose(extract.slice(0, 400)).includes(normalizeLoose(name).split(" ")[0] ?? "")) continue;
      let bio = extract;
      if (bio.length > MAX_BIO_LENGTH) {
        const cut = bio.slice(0, MAX_BIO_LENGTH);
        bio = cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, MAX_BIO_LENGTH - 200));
      }
      return { lang, pageTitle, pageUrl: wikipediaPageUrl(lang, pageTitle), bio };
    }
  }
  return null;
}
