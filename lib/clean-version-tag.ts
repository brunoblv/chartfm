/**
 * Remove tags de "remaster" de títulos de músicas.
 * Cobre variações como:
 *   "Song - 2015 Remaster"
 *   "Song - Remastered 2011"
 *   "Song (Remastered)"
 *   "Song (2009 Remastered Version)"
 *   "Song [Remaster]"
 * Mantém o restante do título intacto.
 */
export function cleanRemasterTag(title: string): string {
  let t = title;
  // Segmentos entre parênteses/colchetes que mencionam remaster (em qualquer posição)
  t = t.replace(/\s*[([][^()[\]]*\bremaster(?:ed)?\b[^()[\]]*[)\]]/gi, "");
  // Segmento final separado por traço que menciona remaster
  t = t.replace(/\s*[-–—]\s*[^-–—]*\bremaster(?:ed)?\b[^-–—]*$/gi, "");
  // Normaliza espaços
  return t.replace(/\s{2,}/g, " ").trim();
}

/** Verdadeiro se o título contém uma tag de remaster que seria removida. */
export function hasRemasterTag(title: string): boolean {
  const cleaned = cleanRemasterTag(title);
  return cleaned !== title.trim() && cleaned.length > 0;
}
