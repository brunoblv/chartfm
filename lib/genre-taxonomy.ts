/**
 * Taxonomia de gêneros para paradas globais / Discover.
 * Match exato (normalizado) — evita "k-pop" cair em "pop".
 */

export type ChartGenre = {
  slug: string;
  name: string;
  /** Tags Spotify / MusicBrainz / Last.fm que pertencem a esta categoria */
  tags: readonly string[];
  /** UI Discover */
  color?: readonly [string, string];
  letter?: string;
};

export const CHART_GENRES: readonly ChartGenre[] = [
  {
    slug: "k-pop",
    name: "K-Pop",
    tags: ["k-pop", "k-rap", "k-ballad", "k-rock", "noise music"],
    color: ["#FB5607", "#FFBE0B"],
    letter: "K",
  },
  {
    slug: "j-pop",
    name: "J-Pop / Anime",
    tags: [
      "j-pop", "j-rock", "j-rap", "j-r&b", "j-dance", "anime", "vocaloid",
      "japanese indie", "city pop", "kayōkyoku", "enka", "shibuya-kei", "visual kei",
    ],
  },
  {
    slug: "pop",
    name: "Pop",
    tags: [
      "pop", "brazilian pop", "dance pop", "art pop", "baroque pop", "bubblegum pop",
      "electropop", "hyperpop", "bedroom pop", "folk pop", "power pop", "soft pop",
      "acoustic pop", "synthpop", "dream pop", "indie pop", "pop rock", "europop",
      "swedish pop", "norwegian pop", "german pop", "french pop", "dansk pop",
      "finnish pop", "nederpop", "turkish pop", "singer-songwriter",
    ],
    color: ["#FA243C", "#FF5858"],
    letter: "P",
  },
  {
    slug: "rock",
    name: "Rock / Punk / Emo",
    tags: [
      "rock", "brazilian rock", "classic rock", "hard rock", "alternative rock", "art rock",
      "garage rock", "post-grunge", "grunge", "britpop", "madchester", "post-punk",
      "proto-punk", "punk", "pop punk", "skate punk", "ska punk", "hardcore punk",
      "emo", "screamo", "post-hardcore", "metalcore", "melodic hardcore", "shoegaze",
      "noise rock", "space rock", "stoner rock", "surf rock", "blues rock", "folk rock",
      "glam rock", "rap rock", "funk rock", "christian rock", "christian alternative rock",
      "argentine rock", "latin rock", "neo-psychedelic", "psychedelic rock",
      "progressive rock", "riot grrrl", "midwest emo", "emo rap", "alternative metal",
      "nu metal", "rap metal", "gothic rock", "new wave", "soft rock", "yacht rock",
      "aor", "jangle pop", "southern rock",
    ],
  },
  {
    slug: "metal",
    name: "Metal",
    tags: [
      "metal", "heavy metal", "metalcore", "symphonic metal", "gothic metal", "power metal",
      "folk metal", "thrash metal", "groove metal", "death metal", "doom metal",
      "progressive metal", "industrial metal", "glam metal", "djent", "deathcore",
      "mathcore", "stoner metal", "trap metal",
    ],
  },
  {
    slug: "hip-hop-rap",
    name: "Hip-Hop / Rap",
    tags: [
      "hip hop", "rap", "trap", "drill", "brazilian hip hop", "brazilian trap",
      "east coast hip hop", "west coast hip hop", "southern hip hop", "old school hip hop",
      "gangster rap", "g-funk", "boom bap", "cloud rap", "melodic rap", "rage rap",
      "grime", "uk grime", "uk drill", "portuguese hip hop", "trap funk", "trap latino",
      "french rap", "phonk", "drift phonk", "jersey club", "afroswing",
    ],
    color: ["#1D1D1F", "#4A4A4F"],
    letter: "H",
  },
  {
    slug: "rnb-soul",
    name: "R&B / Soul",
    tags: [
      "r&b", "soul", "neo soul", "alternative r&b", "quiet storm", "classic soul",
      "motown", "new jack swing", "uk r&b", "indie soul", "french r&b", "chinese r&b",
      "pop soul", "trap soul", "dark r&b", "retro soul",
    ],
    color: ["#6A0572", "#AB83A1"],
    letter: "R",
  },
  {
    slug: "indie-alt",
    name: "Indie / Alt",
    tags: [
      "indie", "indie rock", "indie folk", "indie soul", "indie r&b", "indie dance",
      "indie electronic", "lo-fi indie", "alternative dance", "new rave", "electroclash",
      "witch house", "slowcore", "lo-fi", "bedroom pop",
    ],
    color: ["#06D6A0", "#073B4C"],
    letter: "I",
  },
  {
    slug: "eletronica",
    name: "Eletrônica",
    tags: [
      "electronic", "edm", "house", "deep house", "tech house", "french house",
      "progressive house", "electro house", "brazilian bass", "dubstep", "drum and bass",
      "liquid funk", "future bass", "melodic bass", "techno", "trance", "tropical house",
      "moombahton", "electronica", "electro", "synthwave", "trip hop", "downtempo",
      "idm", "ambient", "eurodance", "hi-nrg", "disco", "big room", "psytrance",
    ],
    color: ["#8338EC", "#3A86FF"],
    letter: "E",
  },
  {
    slug: "funk-br",
    name: "Funk BR",
    tags: [
      "funk carioca", "brazilian funk", "funk pop", "funk melody", "brega funk",
      "trap funk", "funk consciente", "funk",
    ],
    color: ["#EF476F", "#FFD166"],
    letter: "F",
  },
  {
    slug: "sertanejo",
    name: "Sertanejo",
    tags: [
      "sertanejo", "sertanejo universitário", "sertanejo tradicional", "agronejo",
      "forró", "forró tradicional", "arrocha", "piseiro", "tecnobrega", "brega",
    ],
    color: ["#E36414", "#FFD166"],
    letter: "S",
  },
  {
    slug: "mpb",
    name: "MPB",
    tags: ["mpb", "new mpb", "bossa nova", "samba", "pagode", "pagode baiano", "axé", "brazilian jazz", "choro"],
  },
  {
    slug: "latina",
    name: "Latina",
    tags: [
      "latin", "latin pop", "reggaeton", "urbano latino", "trap latino", "t-pop",
      "thai pop", "c-pop", "mandopop", "bachata", "salsa", "flamenco", "neoperreo",
      "argentine trap", "latin alternative",
    ],
  },
  {
    slug: "reggae",
    name: "Reggae",
    tags: [
      "reggae", "roots reggae", "dub", "dancehall", "ragga", "riddim", "soca",
      "lovers rock", "rocksteady", "reggae pop",
    ],
  },
  {
    slug: "country",
    name: "Country",
    tags: ["country", "pop country", "classic country", "outlaw country", "country rock", "americana"],
  },
  {
    slug: "jazz",
    name: "Jazz",
    tags: ["jazz", "latin jazz", "bossa nova", "cool jazz", "vocal jazz", "smooth jazz", "jazz fusion", "jazz pop"],
  },
  {
    slug: "afro",
    name: "Afro / Afrobeats",
    tags: [
      "afrobeats", "afrobeat", "afropop", "afropiano", "afro house", "afro r&b",
      "afro soul", "alté", "highlife", "kizomba", "zouk", "kuduro",
    ],
  },
] as const;

/** Gêneros com card no Discover (têm cor e letra). */
export const DISCOVER_CHART_GENRES = CHART_GENRES.filter(
  (g): g is ChartGenre & { color: [string, string]; letter: string } =>
    Boolean(g.color && g.letter),
);

const tagToSlugs = new Map<string, Set<string>>();
for (const genre of CHART_GENRES) {
  for (const tag of genre.tags) {
    const key = normalizeGenreTag(tag);
    const set = tagToSlugs.get(key) ?? new Set<string>();
    set.add(genre.slug);
    tagToSlugs.set(key, set);
  }
}

export function normalizeGenreTag(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getChartGenreBySlug(slug: string): ChartGenre | undefined {
  return CHART_GENRES.find((g) => g.slug === slug);
}

/** Tags efetivas: faixa primeiro, artista como fallback. */
export function effectiveSongGenreTags(
  songGenres: string[] | null | undefined,
  artistGenres?: string[] | null,
): string[] {
  if (songGenres?.length) return songGenres;
  return artistGenres ?? [];
}

/** A faixa pertence à categoria? Match exato nas tags normalizadas. */
export function matchesChartGenre(
  tags: string[],
  categorySlug: string,
): boolean {
  const genre = getChartGenreBySlug(categorySlug);
  if (!genre || tags.length === 0) return false;

  const categoryTags = new Set(genre.tags.map(normalizeGenreTag));
  return tags.some((t) => categoryTags.has(normalizeGenreTag(t)));
}

/** Slugs de categorias que a faixa pertence. */
export function chartGenreSlugsForTags(tags: string[]): string[] {
  const out = new Set<string>();
  for (const tag of tags) {
    const slugs = tagToSlugs.get(normalizeGenreTag(tag));
    if (slugs) for (const s of slugs) out.add(s);
  }
  return [...out];
}
