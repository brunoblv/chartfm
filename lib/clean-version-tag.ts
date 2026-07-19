/**
 * Remove tags de versão de títulos de músicas (remaster, instrumental, live, etc.).
 * Cobre segmentos entre parênteses/colchetes e sufixos separados por traço.
 */

export const VERSION_TAG_CLEANERS = {
  remaster: {
    label: "Remaster",
    searchTerms: ["remaster", "remastered"],
    matchPattern: "remaster(?:ed)?",
    description: 'Remove trechos como "- 2015 Remaster", "(Remastered)", etc.',
  },
  live: {
    label: "Live / Ao Vivo",
    searchTerms: ["live", "ao vivo", "in concert"],
    matchPattern: "ao\\s+vivo|in\\s+concert|live",
    description: 'Remove trechos como "(Live)", "- Ao Vivo", "(In Concert)", etc.',
  },
  acoustic: {
    label: "Acoustic",
    searchTerms: ["acoustic", "acústico", "unplugged"],
    matchPattern: "acoustic|acústico|unplugged",
    description: 'Remove trechos como "(Acoustic)", "- Unplugged", etc.',
  },
  remix: {
    label: "Remix",
    searchTerms: ["remix", "remixed"],
    matchPattern: "remix(?:ed)?",
    description: 'Remove trechos como "(Remix)", "- Remixed", etc.',
  },
  instrumental: {
    label: "Instrumental",
    searchTerms: ["instrumental"],
    matchPattern: "instrumental",
    description: 'Remove trechos como "(Instrumental)", "- Instrumental Version", etc.',
  },
  demo: {
    label: "Demo",
    searchTerms: ["demo"],
    matchPattern: "demo",
    description: 'Remove trechos como "(Demo)", "- Demo Version", etc.',
  },
  extended: {
    label: "Extended / Edit",
    searchTerms: ["extended", "radio edit", "single edit"],
    matchPattern: "extended|radio\\s+edit|single\\s+edit",
    description: 'Remove trechos como "(Extended)", "- Radio Edit", etc.',
  },
  edition: {
    label: "Edition / Deluxe",
    searchTerms: ["deluxe", "edition", "anniversary", "expanded", "bonus"],
    matchPattern: "deluxe|expanded|anniversary|bonus(?:\\s+track)?|edition|version",
    description: 'Remove trechos como "(Deluxe Version)", "- Anniversary Edition", etc.',
  },
  outros: {
    label: "Outros",
    searchTerms: ["cover", "reprise", "sped up", "slowed"],
    matchPattern: "cover|reprise|sped\\s+up|slowed",
    description: 'Remove trechos como "(Cover)", "- Reprise", "(Sped Up)", etc.',
  },
} as const;

export type VersionTagType = keyof typeof VERSION_TAG_CLEANERS;

function cleanByPattern(title: string, matchPattern: string): string {
  let t = title;
  const inSegment = new RegExp(
    `\\s*[([][^()[\\]]*(?:${matchPattern})[^()[\\]]*[)\\]]`,
    "gi",
  );
  const afterDash = new RegExp(
    `\\s*[-–—]\\s*[^-–—]*(?:${matchPattern})[^-–—]*$`,
    "gi",
  );
  t = t.replace(inSegment, "");
  t = t.replace(afterDash, "");
  return t.replace(/\s{2,}/g, " ").trim();
}

export function cleanVersionTag(title: string, type: VersionTagType): string {
  return cleanByPattern(title, VERSION_TAG_CLEANERS[type].matchPattern);
}

/** Verdadeiro se o título contém uma tag removível do tipo indicado. */
export function hasVersionTag(title: string, type: VersionTagType): boolean {
  const cleaned = cleanVersionTag(title, type);
  return cleaned !== title.trim() && cleaned.length > 0;
}

/** @deprecated Use cleanVersionTag(title, "remaster") */
export function cleanRemasterTag(title: string): string {
  return cleanVersionTag(title, "remaster");
}

/** @deprecated Use hasVersionTag(title, "remaster") */
export function hasRemasterTag(title: string): boolean {
  return hasVersionTag(title, "remaster");
}
