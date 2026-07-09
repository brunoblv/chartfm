/** "Taylor Swift" -> "TaylorSwift", "The Weeknd" -> "TheWeeknd" (sem o #, ver buildHashtags). */
export function normalizeArtistTag(name: string): string | null {
  const DIACRITICS = new RegExp("[̀-ͯ]", "g");
  const cleaned = name
    .normalize("NFD")
    .replace(DIACRITICS, "") // remove acentos (marcas diacríticas combinantes, após normalize NFD)
    .replace(/[^a-zA-Z0-9\s]/g, "") // só letras/números/espaço
    .trim();
  if (!cleaned) return null;
  const tag = cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  return tag || null;
}

/** Monta a lista de hashtags (sempre com #ChartFM na frente, sem duplicatas). */
export function buildHashtags(artistNames: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = ["ChartFM"];
  seen.add("chartfm");

  for (const name of artistNames) {
    const tag = normalizeArtistTag(name);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }

  return tags;
}

export function formatHashtags(tags: string[]): string {
  return tags.map((t) => `#${t}`).join(" ");
}
