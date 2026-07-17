const CROWNNOTE_ORIGIN = "https://www.crownnote.com";
const USER_AGENT = "ChartFM-CrownnoteExport/1.0 (+https://chartfm.com)";

const MONTH_MAP: Record<string, number> = {
  january: 0,
  jan: 0,
  janeiro: 0,
  february: 1,
  feb: 1,
  fev: 1,
  fevereiro: 1,
  march: 2,
  mar: 2,
  marco: 2,
  março: 2,
  april: 3,
  apr: 3,
  abr: 3,
  abril: 3,
  may: 4,
  maio: 4,
  mai: 4,
  june: 5,
  jun: 5,
  junho: 5,
  july: 6,
  jul: 6,
  julho: 6,
  august: 7,
  aug: 7,
  ago: 7,
  agosto: 7,
  september: 8,
  sep: 8,
  sept: 8,
  set: 8,
  setembro: 8,
  october: 9,
  oct: 9,
  out: 9,
  outubro: 9,
  november: 10,
  nov: 10,
  novembro: 10,
  december: 11,
  dec: 11,
  dez: 11,
  dezembro: 11,
};

/** Sufixo ordinal EN (`15th`) e typo comum (`7h` no lugar de `7th`). */
const ORDINAL_RE = "(?:st|nd|rd|th|h)?";

const DROPOUTS_RE = /^DROPOUTS:?/i;
const ENTRY_LINE_RE =
  /^(\d+|NE|RE)\s+(\d+)\s+(.+?)\s+[–—-]\s+"([^"]+)"(?:\s+(\d+)(?:\(×\d+\))?)?\s*(\d+)?\s*$/;

export type CrownnoteChartEntry = {
  prevPosition: number | "NE" | "RE";
  position: number;
  artist: string;
  title: string;
  peak: number | null;
  peakWeeks: number | null;
  weeksOnChart: number | null;
};

export type CrownnoteDropout = {
  prevPosition: number;
  artist: string;
  title: string;
  peak: number | null;
  weeksOnChart: number | null;
};

export type CrownnoteChartExport = {
  url: string;
  slug: string;
  date: string | null;
  entries: CrownnoteChartEntry[];
  dropouts: CrownnoteDropout[];
  plainText: string;
};

export type CrownnoteUserExport = {
  source: "crownnote";
  username: string;
  profileUrl: string;
  exportedAt: string;
  chartSeriesSlug: string | null;
  charts: CrownnoteChartExport[];
  crownnoteText: string;
  stats: {
    chartCount: number;
    entryCount: number;
    oldestDate: string | null;
    newestDate: string | null;
  };
};

export type CrownnoteExportProgress = {
  current: number;
  slug: string;
  entries: number;
  url: string;
};

type ExportOptions = {
  maxCharts?: number;
  delayMs?: number;
  onProgress?: (progress: CrownnoteExportProgress) => void;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\u00a0/g, " ");
}

function htmlFragmentToText(fragment: string): string {
  return decodeHtml(
    fragment
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function normalizeUsername(input: string): string {
  const trimmed = input.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) {
    throw new Error("Nome de usuário inválido.");
  }
  return trimmed;
}

function toYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDateFromChartSlug(slug: string): string | null {
  const patterns: Array<{ re: RegExp; pick: (m: RegExpMatchArray) => string | null }> = [
    {
      // 2024-set-15th / 2024-sep-15
      re: new RegExp(`(\\d{4})-([a-z]+)-(\\d{1,2})${ORDINAL_RE}(?:\\D|$)`, "i"),
      pick: (m) => {
        const month = MONTH_MAP[m[2]!.toLowerCase()];
        if (month === undefined) return null;
        return toYmd(Number(m[1]), month, Number(m[3]));
      },
    },
    {
      // 15th-set-2024 / 15-sep-2024
      re: new RegExp(`(\\d{1,2})${ORDINAL_RE}-([a-z]+)-(\\d{4})(?:\\D|$)`, "i"),
      pick: (m) => {
        const month = MONTH_MAP[m[2]!.toLowerCase()];
        if (month === undefined) return null;
        return toYmd(Number(m[3]), month, Number(m[1]));
      },
    },
    {
      // set-15th-2024 / jun-5th-2026 / out-4th-2024 / july-31st-2025
      re: new RegExp(`([a-z]+)-(\\d{1,2})${ORDINAL_RE}-(\\d{4})(?:\\D|$)`, "i"),
      pick: (m) => {
        const month = MONTH_MAP[m[1]!.toLowerCase()];
        if (month === undefined) return null;
        return toYmd(Number(m[3]), month, Number(m[2]));
      },
    },
    {
      // MMDDYY no fim do slug: personal-chart-031425 / personal-chart-052325-0
      re: /(?:^|-)(\d{2})(\d{2})(\d{2})(?:-\d+)?$/i,
      pick: (m) => {
        const month = Number(m[1]) - 1;
        const day = Number(m[2]);
        const year = 2000 + Number(m[3]);
        if (month < 0 || month > 11 || day < 1 || day > 31) return null;
        return toYmd(year, month, day);
      },
    },
  ];

  for (const { re, pick } of patterns) {
    const match = slug.match(re);
    if (match) {
      const date = pick(match);
      if (date) return date;
    }
  }
  return null;
}

/** Extrai mês/dia de slugs sem ano (`personal-chart-mar-20th`). */
export function parseMonthDayFromChartSlug(slug: string): { month: number; day: number } | null {
  const match = slug.match(new RegExp(`([a-z]+)-(\\d{1,2})${ORDINAL_RE}$`, "i"));
  if (!match) return null;
  const month = MONTH_MAP[match[1]!.toLowerCase()];
  if (month === undefined) return null;
  const day = Number(match[2]);
  if (day < 1 || day > 31) return null;
  return { month, day };
}

/**
 * Completa data Crownnote: usa `parseDateFromChartSlug`, ou infere o ano a partir
 * da semana anterior quando o slug só tem mês/dia.
 */
export function resolveCrownnoteChartDate(
  slug: string,
  explicitDate: string | null,
  previousYmd: string | null,
): string | null {
  if (explicitDate && /^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) return explicitDate;

  const full = parseDateFromChartSlug(slug);
  if (full) return full;

  const md = parseMonthDayFromChartSlug(slug);
  if (!md || !previousYmd) return null;

  const prevYear = Number(previousYmd.slice(0, 4));
  let candidate = toYmd(prevYear, md.month, md.day);
  if (candidate <= previousYmd) {
    candidate = toYmd(prevYear + 1, md.month, md.day);
  }
  return candidate;
}

function parsePlainTextChart(plainText: string, url: string): Omit<CrownnoteChartExport, "url" | "slug"> {
  const lines = plainText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const entries: CrownnoteChartEntry[] = [];
  const dropouts: CrownnoteDropout[] = [];
  let inDropouts = false;

  for (const line of lines) {
    if (DROPOUTS_RE.test(line)) {
      inDropouts = true;
      continue;
    }
    if (/^https?:\/\//i.test(line)) continue;

    if (inDropouts) {
      const dropoutMatch = line.match(
        /^(\d+)\s+--\s+(.+?)\s+[–—-]\s+"([^"]+)"(?:\s+(\d+))?\s*(\d+)?\s*$/,
      );
      if (dropoutMatch) {
        dropouts.push({
          prevPosition: Number(dropoutMatch[1]),
          artist: dropoutMatch[2]!.trim(),
          title: dropoutMatch[3]!.trim(),
          peak: dropoutMatch[4] ? Number(dropoutMatch[4]) : null,
          weeksOnChart: dropoutMatch[5] ? Number(dropoutMatch[5]) : null,
        });
      }
      continue;
    }

    const entryMatch = line.match(ENTRY_LINE_RE);
    if (!entryMatch) continue;

    const [, prevRaw, positionRaw, artist, title, peakRaw, weeksRaw] = entryMatch;
    const prevPosition =
      prevRaw === "NE" || prevRaw === "RE" ? prevRaw : Number(prevRaw);

    entries.push({
      prevPosition,
      position: Number(positionRaw),
      artist: artist.trim(),
      title: title.trim(),
      peak: peakRaw ? Number(peakRaw) : null,
      peakWeeks: null,
      weeksOnChart: weeksRaw ? Number(weeksRaw) : null,
    });
  }

  const slug = url.split("/").pop() ?? "";
  const date = parseDateFromChartSlug(slug);

  return { date, entries, dropouts, plainText };
}

async function fetchCrownnoteHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    cache: "no-store",
  });
  if (res.status === 404) {
    throw new Error(`Página não encontrada: ${url}`);
  }
  if (!res.ok) {
    throw new Error(`Erro ao acessar Crownnote (${res.status}).`);
  }
  return res.text();
}

export function extractPlainTextFromChartHtml(html: string): string | null {
  const container = html.match(
    /id="plainTextChart"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<div/i,
  );
  if (!container) {
    const fallback = html.match(/id="plainTextChart"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
    if (!fallback) return null;
    return htmlFragmentToText(fallback[1]!);
  }

  const fragment = container[1]!;
  const header = fragment.replace(/<div>[\s\S]*$/i, "").trim();
  const entryLines = [...fragment.matchAll(/<div>([^<]*)<\/div>/gi)].map((m) =>
    decodeHtml(m[1]!.trim()),
  );

  const parts = [htmlFragmentToText(header), ...entryLines].filter(Boolean);
  return parts.join("\n").trim() || null;
}

export function extractOlderChartPath(html: string): string | null {
  const anchorIdx = html.search(/Older chart\s*<\/a>/i);
  if (anchorIdx >= 0) {
    const slice = html.slice(Math.max(0, anchorIdx - 600), anchorIdx);
    const matches = [...slice.matchAll(/href="(\/charts\/[^"]+)"/g)];
    const last = matches.at(-1)?.[1];
    if (last) return last.replace(/&amp;/g, "&");
  }

  const patterns = [
    /href="(\/charts\/[^"]+)"[^>]*>[\s\S]*?Older chart/i,
    /Older chart[\s\S]{0,200}?href="(\/charts\/[^"]+)"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].replace(/&amp;/g, "&");
  }
  return null;
}

export function extractLatestChartUrl(profileHtml: string, username: string): string | null {
  const sectionMatch = profileHtml.match(
    /Latest Chart[\s\S]{0,12000}?href="((?:https:\/\/www\.crownnote\.com)?\/charts\/[^"]+)"/i,
  );
  if (sectionMatch?.[1]) {
    const href = sectionMatch[1].replace(/&amp;/g, "&");
    return href.startsWith("http") ? href : `${CROWNNOTE_ORIGIN}${href}`;
  }

  const fallback = profileHtml.match(
    new RegExp(`href="((?:https://www\\.crownnote\\.com)?/charts/${username}/[^"]+)"`, "i"),
  );
  if (!fallback?.[1]) return null;
  const href = fallback[1].replace(/&amp;/g, "&");
  return href.startsWith("http") ? href : `${CROWNNOTE_ORIGIN}${href}`;
}

function chartSeriesSlugFromUrl(url: string, username: string): string | null {
  const parts = url.split("/");
  const userIdx = parts.findIndex((p) => p === username);
  if (userIdx >= 0 && parts[userIdx + 1]) return parts[userIdx + 1]!;
  return null;
}

export async function exportCrownnoteUser(
  rawUsername: string,
  options: ExportOptions = {},
): Promise<CrownnoteUserExport> {
  const username = normalizeUsername(rawUsername);
  const profileUrl = `${CROWNNOTE_ORIGIN}/users/${username}`;
  const maxCharts = options.maxCharts ?? 2000;
  const delayMs = options.delayMs ?? 120;

  const profileHtml = await fetchCrownnoteHtml(profileUrl);
  if (/page-title--user heading--user">\s*Page not found/i.test(profileHtml)) {
    throw new Error(`Usuário @${username} não encontrado no Crownnote.`);
  }

  let chartUrl = extractLatestChartUrl(profileHtml, username);
  if (!chartUrl) {
    throw new Error(`Nenhuma parada encontrada para @${username}.`);
  }

  const charts: CrownnoteChartExport[] = [];
  const seen = new Set<string>();
  let chartSeriesSlug: string | null = null;

  while (chartUrl && !seen.has(chartUrl) && charts.length < maxCharts) {
    seen.add(chartUrl);
    const html = await fetchCrownnoteHtml(chartUrl);
    const plainText = extractPlainTextFromChartHtml(html);
    if (!plainText) {
      throw new Error(`Não foi possível ler a parada: ${chartUrl}`);
    }

    const slug = chartUrl.split("/").pop() ?? "";
    chartSeriesSlug ??= chartSeriesSlugFromUrl(chartUrl, username);

    const parsed = parsePlainTextChart(plainText, chartUrl);
    charts.push({
      url: chartUrl,
      slug,
      ...parsed,
    });

    options.onProgress?.({
      current: charts.length,
      slug,
      entries: parsed.entries.length,
      url: chartUrl,
    });

    const olderPath = extractOlderChartPath(html);
    chartUrl = olderPath ? `${CROWNNOTE_ORIGIN}${olderPath}` : null;

    if (chartUrl) await sleep(delayMs);
  }

  charts.reverse();

  const crownnoteText = charts
    .map((chart) => chart.plainText)
    .join("\n\n")
    .trim();

  const datedCharts = charts.filter((c) => c.date);
  const dates = datedCharts.map((c) => c.date!).sort();

  return {
    source: "crownnote",
    username,
    profileUrl,
    exportedAt: new Date().toISOString(),
    chartSeriesSlug,
    charts,
    crownnoteText,
    stats: {
      chartCount: charts.length,
      entryCount: charts.reduce((sum, c) => sum + c.entries.length, 0),
      oldestDate: dates[0] ?? null,
      newestDate: dates.at(-1) ?? null,
    },
  };
}
