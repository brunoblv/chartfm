import type { Locale } from "@/lib/i18n/config";

/**
 * Tipo do lançamento (Album.albumType) em uma única fonte: o rótulo da interface,
 * o texto de contexto e o JSON-LD precisam concordar — antes a interface dizia
 * "Álbum" enquanto o texto chamava o mesmo lançamento de "single".
 */
export type ReleaseType = "SINGLE" | "EP" | "ALBUM" | "COMPILATION";

export function normalizeReleaseType(value: string | null | undefined): ReleaseType {
  if (value === "SINGLE" || value === "EP" || value === "COMPILATION") return value;
  return "ALBUM";
}

const LABELS: Record<ReleaseType, Record<Locale, string>> = {
  ALBUM: { "pt-BR": "Álbum", en: "Album" },
  SINGLE: { "pt-BR": "Single", en: "Single" },
  EP: { "pt-BR": "EP", en: "EP" },
  COMPILATION: { "pt-BR": "Coletânea", en: "Compilation" },
};

/** Substantivo com artigo indefinido, para frases ("é um single de X"). */
const NOUNS: Record<ReleaseType, Record<Locale, string>> = {
  ALBUM: { "pt-BR": "um álbum", en: "an album" },
  SINGLE: { "pt-BR": "um single", en: "a single" },
  EP: { "pt-BR": "um EP", en: "an EP" },
  COMPILATION: { "pt-BR": "uma coletânea", en: "a compilation" },
};

export function releaseTypeLabel(value: string | null | undefined, locale: Locale): string {
  return LABELS[normalizeReleaseType(value)][locale];
}

export function releaseTypeNoun(value: string | null | undefined, locale: Locale): string {
  return NOUNS[normalizeReleaseType(value)][locale];
}

/** schema.org MusicAlbumReleaseType */
export function releaseTypeSchemaOrg(value: string | null | undefined): string {
  switch (normalizeReleaseType(value)) {
    case "SINGLE":
      return "https://schema.org/SingleRelease";
    case "EP":
      return "https://schema.org/EPRelease";
    default:
      return "https://schema.org/AlbumRelease";
  }
}
