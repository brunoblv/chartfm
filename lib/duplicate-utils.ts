export function normalizeLoose(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTrailingBracketVariant(input: string, hintRe: RegExp): string {
  let out = input;
  let changed = true;
  while (changed) {
    changed = false;
    out = out.replace(/\s*[\[(]([^\])]+)[\])]\s*$/g, (full, inner) => {
      if (hintRe.test(String(inner))) {
        changed = true;
        return "";
      }
      return full;
    });
  }
  return out.trim();
}

function stripTrailingDashVariant(input: string, hintRe: RegExp): string {
  const m = input.match(/\s[-–]\s(.+)$/);
  if (!m) return input.trim();
  if (!hintRe.test(m[1] ?? "")) return input.trim();
  return input.slice(0, m.index).trim();
}

export function canonicalSongTitle(title: string): string {
  const remixRe = /\bremix(?:es)?\b/i;
  const noBrackets = stripTrailingBracketVariant(title, remixRe);
  const noDash = stripTrailingDashVariant(noBrackets, remixRe);
  return normalizeLoose(noDash);
}

export function canonicalArtistName(artist: string): string {
  return normalizeLoose(artist.replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.+$/i, ""));
}

export function canonicalAlbumTitle(title: string): string {
  const variantRe =
    /\b(deluxe|expanded|extended|edition|version|remaster(?:ed)?|anniversary|bonus|track by track|commentary|ao vivo|live|instrumental)\b/i;
  const noBrackets = stripTrailingBracketVariant(title, variantRe);
  const noDash = stripTrailingDashVariant(noBrackets, variantRe);
  return normalizeLoose(noDash);
}
