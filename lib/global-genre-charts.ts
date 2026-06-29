import {
  getChartGenreBySlug,
  normalizeGenreTag,
} from "@/lib/genre-taxonomy";

export type GlobalGenreChart = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  /** Tags da faixa (MusicBrainz / Last.fm) incluídas nesta parada */
  tags: readonly string[];
  color: readonly [string, string];
  letter: string;
  /** Slugs da taxonomia base usados (referência) */
  includes: readonly string[];
};

function collectTags(slugs: string[], extra: string[] = []): string[] {
  const set = new Set<string>();
  for (const slug of slugs) {
    const g = getChartGenreBySlug(slug);
    if (g) for (const t of g.tags) set.add(normalizeGenreTag(t));
  }
  for (const t of extra) set.add(normalizeGenreTag(t));
  return [...set];
}

/** Paradas globais Top 50 por gênero (hub /global). */
export const GLOBAL_GENRE_CHARTS: readonly GlobalGenreChart[] = [
  {
    slug: "rock",
    name: "Top 50 Rock",
    shortName: "Rock",
    description: "Rock, punk, emo, grunge, metal e subgêneros relacionados nas paradas da comunidade.",
    includes: ["rock", "metal"],
    tags: collectTags(["rock", "metal"], [
      "latin rock", "finnish rock", "chinese rock", "stoner metal", "speed metal",
      "melodic death metal", "black metal", "industrial rock", "christian metal",
    ]),
    color: ["#E36414", "#FFD166"],
    letter: "R",
  },
  {
    slug: "brasil",
    name: "Top 50 Brasil",
    shortName: "Brasil",
    description: "MPB, sertanejo, funk carioca, pagode, forró, axé e demais estilos brasileiros.",
    includes: ["mpb", "sertanejo", "funk-br"],
    tags: collectTags(["mpb", "sertanejo", "funk-br"], [
      "brazilian pop", "brazilian rock", "brazilian hip hop", "brazilian trap",
      "brazilian funk", "brazilian jazz", "brazilian bass", "brazilian gospel",
      "pagode baiano", "seresta", "música adventista", "funk ostentacao",
      "zouk", "fado",
    ]),
    color: ["#009C3B", "#FFDF00"],
    letter: "B",
  },
  {
    slug: "urban",
    name: "Top 50 R&B / Hip-Hop / Rap / Soul",
    shortName: "Urban",
    description: "R&B, soul, neo soul, hip hop, rap, trap, drill e estilos urbanos afins.",
    includes: ["rnb-soul", "hip-hop-rap", "afro"],
    tags: collectTags(["rnb-soul", "hip-hop-rap"], [
      "afro r&b", "afro soul", "alté", "afroswing", "trap soul", "cloud rap",
      "conscious hip hop", "experimental hip hop", "rage rap", "phonk",
      "afrobeats", "afrobeat", "afropop", "afropiano",
    ]),
    color: ["#6A0572", "#1D1D1F"],
    letter: "U",
  },
  {
    slug: "asian",
    name: "Top 50 Asian",
    shortName: "Asian",
    description: "K-pop, J-pop, C-pop, T-pop, anime, city pop e pop asiático em geral.",
    includes: ["k-pop", "j-pop"],
    tags: collectTags(["k-pop", "j-pop"], [
      "c-pop", "mandopop", "cantopop", "t-pop", "thai pop", "thai hip hop", "thai trap",
      "thai rock", "thai indie pop", "p-pop", "opm", "pinoy r&b", "chinese r&b",
      "chinese hip hop", "malay pop", "kayōkyoku", "enka", "shibuya-kei", "visual kei",
      "vocaloid", "j-dance", "japanese vgm", "noise music", "k-ballad", "k-rock",
      "k-rap", "j-rap", "j-r&b", "j-rock", "anime", "city pop", "japanese indie",
    ]),
    color: ["#FB5607", "#8338EC"],
    letter: "A",
  },
  {
    slug: "pop",
    name: "Top 50 Pop",
    shortName: "Pop",
    description: "Pop internacional, dance pop, synthpop, hyperpop, art pop e variantes mainstream.",
    includes: ["pop"],
    tags: collectTags(["pop"], [
      "electropop", "teen pop", "dance pop", "art pop", "baroque pop", "bubblegum pop",
      "hyperpop", "bedroom pop", "folk pop", "power pop", "soft pop", "acoustic pop",
      "synthpop", "dream pop", "indie pop", "pop rock", "europop", "swedish pop",
      "norwegian pop", "german pop", "french pop", "dansk pop", "finnish pop",
      "nederpop", "turkish pop", "indonesian pop", "singer-songwriter", "retro pop",
      "pop soul", "pop singer-songwriter", "italo disco", "eurodance",
    ]),
    color: ["#FA243C", "#FF5858"],
    letter: "P",
  },
  {
    slug: "alternative",
    name: "Top 50 Alternative",
    shortName: "Alternative",
    description: "Indie, alternativo, shoegaze, post-punk, britpop e cenas adjacentes.",
    includes: ["indie-alt", "rock"],
    tags: collectTags(["indie-alt"], [
      "alternative rock", "alternative dance", "alternative r&b", "alternative metal",
      "alternative pop", "post-punk", "shoegaze", "dream pop", "britpop", "madchester",
      "neo-psychedelic", "new wave", "slowcore", "anti-folk", "riot grrrl",
      "electroclash", "new rave", "witch house", "lo-fi", "bedroom pop",
      "indie québécois", "indie jazz", "jangle pop", "noise rock", "space rock",
    ]),
    color: ["#06D6A0", "#073B4C"],
    letter: "Alt",
  },
  {
    slug: "eletronica",
    name: "Top 50 Eletrônica",
    shortName: "Eletrônica",
    description: "EDM, house, techno, trance, dubstep, bass e música eletrônica em geral.",
    includes: ["eletronica"],
    tags: collectTags(["eletronica"], [
      "electropop", "brazilian bass", "slap house", "stutter house", "future house",
      "bass house", "g-house", "melbourne bounce", "electro swing", "breakbeat",
      "uk garage", "uk funky", "acid house", "chicago house", "hip house",
      "nu disco", "funky house", "afro house", "latin house", "melodic techno",
      "progressive trance", "progressive house", "big room", "psytrance",
      "deathstep", "chillstep", "electroclash", "synthwave", "chillwave",
      "nightcore", "phonk", "hypertechno", "guaracha", "techengue",
    ]),
    color: ["#8338EC", "#3A86FF"],
    letter: "E",
  },
] as const;

const tagSets = new Map<string, Set<string>>();
for (const chart of GLOBAL_GENRE_CHARTS) {
  tagSets.set(chart.slug, new Set(chart.tags.map(normalizeGenreTag)));
}

export function getGlobalGenreChart(slug: string): GlobalGenreChart | undefined {
  return GLOBAL_GENRE_CHARTS.find((c) => c.slug === slug);
}

export function isGlobalGenreChartSlug(slug: string): boolean {
  return tagSets.has(slug);
}

/** A faixa entra nesta parada global? Match exato nas tags normalizadas. */
export function matchesGlobalGenreChart(tags: string[], chartSlug: string): boolean {
  const allowed = tagSets.get(chartSlug);
  if (!allowed || tags.length === 0) return false;
  return tags.some((t) => allowed.has(normalizeGenreTag(t)));
}

/** Lista legível de subgêneros (primeiros N) para exibir na página. */
export function formatGenreChartTags(chart: GlobalGenreChart, limit = 24): string {
  return chart.tags.slice(0, limit).join(" · ");
}

export const GLOBAL_GENRE_CHART_LIMIT = 50;
