/**
 * Normaliza comments.json (Facebook) → planilha UCC 2026.
 *
 * - Semanas a partir de 202601 (semana que inclui 02/01/2026)
 * - Top 20 por parada; extras ignorados
 * - Colunas: Pessoa, Parada, Data, Posição, Artista, Feat, Música, songId, spotifyId, baixa_confianca, match
 *
 * Usage:
 *   npx tsx scripts/_tmp_normalize-fb-paradas.ts --parse-only
 *   npx tsx scripts/_tmp_normalize-fb-paradas.ts --dry-run
 *   npx tsx scripts/_tmp_normalize-fb-paradas.ts
 */

import { PrismaClient } from "@prisma/client";
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { buildWeekIndexFromDate } from "../lib/chart-week";
import { upsertSongFromSpotify } from "../lib/mytrl-weekly-chart";
import { getSpotifyTrackMetadataById, searchSpotifyTracks } from "../lib/spotify-server";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

const prisma = new PrismaClient();

const PARSE_ONLY = process.argv.includes("--parse-only");
const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_SPOTIFY = process.argv.includes("--skip-spotify");
const VERBOSE = process.argv.includes("--verbose");
const MIN_WEEK = 202601;
const MAX_WEEK = 202630; // até ~jul/2026 (export)
const SPOTIFY_DELAY_MS = 300;
const TODAY = new Date(2026, 6, 25); // referência do export (jul/2026)

const INPUT = join(process.cwd(), "uploads", "comments.json");
const OUT_JSON = join(process.cwd(), "uploads", "_tmp_fb_paradas_rows.json");
const OUT_XLSX = join(process.cwd(), "uploads", "paradas.xlsx");
const OUT_REPORT = join(process.cwd(), "uploads", "_tmp_fb_paradas_report.json");

type RawComment = { author: string; text: string };
type ParsedEntry = {
  position: number;
  artistRaw: string;
  titleRaw: string;
};
type ChartRow = {
  pessoa: string;
  parada: string;
  data: string; // DD/MM/YYYY
  dataIso: string; // YYYY-MM-DD
  weekIndex: number;
  posicao: number;
  artista: string;
  feat: string;
  musica: string;
  songId: string;
  spotifyId: string;
  baixa_confianca: boolean;
  match: string;
  sourceAuthor: string;
};

/** Só seções claramente pós-ranking (não “DESTAQUE” no meio da lista). */
const EXTRA_START_RE =
  /^(melhor da semana|mds\b:?|flashback\b|midback\b|chart retr|chart review|fora\b:?|out:?|outs?:|offs?\b:?|a melhor da semana|principais lan[cç]amentos|a hora dos who|outras estreias|\*+\s*flash|🅴|\[extras\]|\[retr|off:)/i;

const SKIP_LABEL_RE =
  /^(destaque|destaque nacional|indica[cç][aã]o|dns|who|destaque who)\s*:?\s*\*?$/i;

/** Duos/bandas cujo & / and / + não deve virar Feat. */
const KEEP_ARTIST_RE: RegExp[] = [
  /\bflorence\s*[&+]\s*the\s*machine\b/i,
  /\btones\s*(?:and|&)\s*i\b/i,
  /\bmumford\s*&\s*sons\b/i,
  /\bsimon\s*&\s*garfunkel\b/i,
  /\bhall\s*&\s*oates\b/i,
  /\bearth,?\s*wind\s*&\s*fire\b/i,
  /\bblood,?\s*sweat\s*&\s*tears\b/i,
  /\bcrosby,?\s*stills\s*(?:&|and)\s*nash\b/i,
  /\bemerson,?\s*lake\s*&\s*palmer\b/i,
  /\bportugal\.?\s*the\s*man\b/i,
  /\bhuntr\s*\/?\s*x\b/i,
  /\bhuntrix\b/i,
  /\bjorge\s*&\s*mateus\b/i,
  /\bmaiara\s*&\s*maraisa\b/i,
  /\bsimone\s*&\s*simaria\b/i,
  /\bzez[eé]\s*di\s*camargo\s*&\s*luciano\b/i,
  /\bchit[aã]ozinho\s*&\s*xoror[oó]\b/i,
  /\bsandy\s*&\s*junior\b/i,
  /\bguilherme\s*&\s*benuto\b/i,
  /\bhenrique\s*&\s*juliano\b/i,
  /\bhugo\s*&\s*guilherme\b/i,
  /\bmatheus\s*&\s*kauan\b/i,
  /\bbruno\s*&\s*marrone\b/i,
  /\bvictor\s*&\s*leo\b/i,
  /\bfernando\s*&\s*sorocaba\b/i,
  /\bisrael\s*&\s*rodolffo\b/i,
  /\bdiego\s*&\s*victor\s*hugo\b/i,
  /\bjo[aã]o\s*neto\s*&\s*frederico\b/i,
  /\bmunhoz\s*&\s*mariano\b/i,
  /\bjo[aã]o\s*bosco\s*&\s*vin[ií]cius\b/i,
  /\bc[eé]sar\s*menotti\s*&\s*fabiano\b/i,
  /\bgeorge\s*henrique\s*&\s*rodrigo\b/i,
  /\bthaeme\s*&\s*thiago\b/i,
  /\bmaria\s*cec[ií]lia\s*&\s*rodolfo\b/i,
  /\bchrystian\s*&\s*ralf\b/i,
  /\brick\s*&\s*renner\b/i,
  /\bp[eé]ricles\s*&\s*ferrugem\b/i,
  /\bjefferson\s*&\s*suellen\b/i,
  /\bguns\s*n'?\s*roses\b/i,
  /\bbooker\s*t\.?\s*&\s*the\s*m\.?g\.?'?s\b/i,
  /\bsly\s*&\s*the\s*family\s*stone\b/i,
  /\bkc\s*&\s*the\s*sunshine\s*band\b/i,
  /\bgladys\s*knight\s*&\s*the\s*pips\b/i,
  /\bderek\s*&\s*the\s*dominos\b/i,
  /\bsonny\s*&\s*cher\b/i,
  /\bcaptain\s*&\s*tennille\b/i,
  /\bike\s*&\s*tina(?:\s*turner)?\b/i,
  /\bbrooks\s*&\s*dunn\b/i,
  /\bteodoro\s*&\s*sampaio\b/i,
  /\byan\s*&\s*sorriso\s*maroto\b/i,
  /\bgabrielzinho\s*&\s*gamadinho\b/i,
  /\bgrupo\s*chocolate\s*&\s*turma\s*do\s*pagode\b/i,
];

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanAuthor(author: string): string {
  return author.replace(/\s+há\s+.+$/i, "").trim();
}

function stripChrome(text: string): string {
  let s = text.replace(/\u00a0/g, " ").replace(/Curtir\s*$/i, "").trim();
  // Remove cabeçalho Facebook: nome + · + N sem / Seguir
  const markers = [
    /·\s*\d+\s*sem\b/i,
    /·\s*Seguir\b/i,
    /\b\d+\s*sem\b/i,
  ];
  for (const re of markers) {
    const m = s.match(re);
    if (m?.index != null) {
      s = s.slice(m.index + m[0].length);
      break;
    }
  }
  // Se ainda começa com o nome do autor duplicado numa linha, tira
  s = s.replace(/^[^\n]{0,80}\n+/, (first) => {
    // só remove se a primeira linha parece metadado curto
    return first.length < 60 && !/\d/.test(first) ? "" : first;
  });
  return s.replace(/^\s+/, "").trim();
}

function estimateDateFromRelative(text: string): Date | null {
  const m = text.match(/·\s*(\d+)\s*sem\b/i) || text.match(/\b(\d+)\s*sem\b/i);
  if (!m) return null;
  const weeks = Number(m[1]);
  const d = new Date(TODAY);
  d.setDate(d.getDate() - weeks * 7);
  return d;
}

function parseLooseDate(raw: string, hint: Date | null): Date | null {
  const t = raw.trim();
  // DD/MM/YYYY or DD/MM/YY or DD.MM.YYYY — (?!\d) evita colar no "01" da posição seguinte
  let m = t.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?!\d)/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (y < 2024 || y > 2027) return null;
    return new Date(y, Number(m[2]) - 1, Number(m[1]), 12);
  }
  // DD/MM or DD.MM (sem ano)
  m = t.match(/\b(\d{1,2})[./](\d{1,2})(?!\d)/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    let year = hint?.getFullYear() ?? 2026;
    let candidate = new Date(year, month - 1, day, 12);
    if (hint) {
      const delta = candidate.getTime() - hint.getTime();
      if (delta > 21 * 86400000) {
        year -= 1;
        candidate = new Date(year, month - 1, day, 12);
      } else if (delta < -400 * 86400000) {
        year += 1;
        candidate = new Date(year, month - 1, day, 12);
      }
    }
    if (candidate.getFullYear() < 2024 || candidate.getFullYear() > 2027) return null;
    return candidate;
  }
  // "21 de Dezembro de 2025" / "29 de Março de 2026" / "13 de fevereiro de 2026"
  m = t.match(
    /\b(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})\b/i,
  );
  if (m) {
    const months: Record<string, number> = {
      janeiro: 0,
      fevereiro: 1,
      marco: 2,
      março: 2,
      abril: 3,
      maio: 4,
      junho: 5,
      julho: 6,
      agosto: 7,
      setembro: 8,
      outubro: 9,
      novembro: 10,
      dezembro: 11,
    };
    const key = normalizeText(m[2]).replace("c", "c"); // março → marco via NFD already in normalize? use raw
    const mk = m[2]
      .normalize("NFD")
      .replace(/\p{Diacritic}+/gu, "")
      .toLowerCase();
    return new Date(Number(m[3]), months[mk] ?? 0, Number(m[1]), 12);
  }
  // "20 MAR 26" / "22/12/25"
  m = t.match(/\b(\d{1,2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(\d{2,4})\b/i);
  if (m) {
    const map: Record<string, number> = {
      jan: 0,
      fev: 1,
      mar: 2,
      abr: 3,
      mai: 4,
      jun: 5,
      jul: 6,
      ago: 7,
      set: 8,
      out: 9,
      nov: 10,
      dez: 11,
    };
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return new Date(y, map[m[2].toLowerCase()] ?? 0, Number(m[1]), 12);
  }
  // WEEK N/YYYY or WEEKS N e M/YYYY
  m = t.match(/\bWEEKS?\s+(\d+)(?:\s*e\s*\d+)?\/(\d{4})\b/i);
  if (m) {
    // aproximar: semana ISO N do ano → segunda da semana
    const week = Number(m[1]);
    const year = Number(m[2]);
    const jan4 = new Date(year, 0, 4, 12);
    const day = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - day + 1 + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday;
  }
  // (14ª WEEK 2026) / 52ª WEEK 2025
  m = t.match(/\b(\d+)\s*ª?\s*WEEK\s+(\d{4})\b/i);
  if (m) {
    const week = Number(m[1]);
    const year = Number(m[2]);
    const jan4 = new Date(year, 0, 4, 12);
    const day = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - day + 1 + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday;
  }
  // Semana #18 | 2026 (não casar "Melhor da Semana")
  m = t.match(/(?:^|[|\n])\s*Semana\s*#?\s*(\d+)/i) || t.match(/\bSemana\s*#\s*(\d+)/i);
  if (m) {
    const week = Number(m[1]);
    const yearM = t.match(/\b(20\d{2})\b/);
    const year = yearM ? Number(yearM[1]) : hint?.getFullYear() ?? 2026;
    const jan4 = new Date(year, 0, 4, 12);
    const day = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - day + 1 + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday;
  }
  return null;
}

function formatPt(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function formatIso(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function protectArtists(input: string): { text: string; tokens: string[] } {
  let text = input;
  const tokens: string[] = [];
  for (const re of KEEP_ARTIST_RE) {
    text = text.replace(re, (hit) => {
      const idx = tokens.length;
      tokens.push(hit);
      return `__KEEP${idx}__`;
    });
  }
  // genérico: "X & the Y" / "X + the Y" / "X and the Y"
  text = text.replace(
    /\b([\w'.]+)\s*(?:&|\+|and)\s+the\s+([\w'.]+(?:\s+[\w'.]+){0,3})\b/gi,
    (hit) => {
      const idx = tokens.length;
      tokens.push(hit);
      return `__KEEP${idx}__`;
    },
  );
  return { text, tokens };
}

function restoreArtists(text: string, tokens: string[]): string {
  return text.replace(/__KEEP(\d+)__/g, (_, i) => tokens[Number(i)] ?? "");
}

const FEAT_IN_TITLE_RE =
  /\s*[([（]\s*(?:feat\.?|ft\.?|featuring|part\.?|with|w\/)\s+([^)\]）]+)[)\]）]\s*$/i;

function splitTitleFeat(title: string): { title: string; featFromTitle: string | null } {
  const m = title.match(FEAT_IN_TITLE_RE);
  if (!m) return { title: title.trim(), featFromTitle: null };
  return {
    title: title.slice(0, m.index).trim(),
    featFromTitle: m[1].trim(),
  };
}

/** Separa artista principal vs feats (&, x, +, vírgula, feat/ft/part/with). */
function splitArtistAndFeat(artistRaw: string, titleRaw: string): {
  artist: string;
  feat: string;
  title: string;
} {
  const { title, featFromTitle } = splitTitleFeat(stripMovement(titleRaw.trim()));
  let artistPart = stripMovement(artistRaw.trim());

  // feat explícito no artista: "A feat. B" / "A ft B"
  const featSplit = artistPart.split(
    /\s+(?:feat\.?|ft\.?|featuring|part\.?|with|w\/)\s+/i,
  );
  const feats: string[] = [];
  if (featSplit.length > 1) {
    artistPart = featSplit[0].trim();
    feats.push(...featSplit.slice(1).map((s) => s.trim()).filter(Boolean));
  }

  const { text: protectedText, tokens } = protectArtists(artistPart);
  // split em , & x + (com espaços) — "x" só como token isolado
  const chunks = protectedText
    .split(/\s*(?:,|&|\+|\/|\bx\b)\s*/i)
    .map((c) => restoreArtists(c.trim(), tokens))
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const primary = chunks[0] ?? artistPart;
  if (chunks.length > 1) feats.push(...chunks.slice(1));
  if (featFromTitle) {
    // feats no título também podem ter & / x
    const { text: p2, tokens: t2 } = protectArtists(featFromTitle);
    const more = p2
      .split(/\s*(?:,|&|\+|\/|\bx\b|\be\b)\s*/i)
      .map((c) => restoreArtists(c.trim(), t2))
      .filter(Boolean);
    feats.push(...more);
  }

  // limpar restos de pontuação
  const clean = (s: string) =>
    s
      .replace(/^[,&+/]+|[,&+/]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const uniqFeats: string[] = [];
  const seen = new Set<string>();
  for (const f of feats.map(clean).filter(Boolean)) {
    const k = normalizeText(f);
    if (k === normalizeText(primary)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    uniqFeats.push(f);
  }

  return {
    artist: clean(primary),
    feat: uniqFeats.join(", "),
    title: title.replace(/^["“]|["”]$/g, "").trim(),
  };
}

function cutExtras(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (SKIP_LABEL_RE.test(t)) continue; // rótulo no meio do chart
    if (/^\*\s+\d{1,2}\b/.test(t)) {
      // Wyll: "* 06 ARTISTA - MUSICA"
      out.push(t.replace(/^\*\s+/, ""));
      continue;
    }
    if (EXTRA_START_RE.test(t)) break;
    // extras no fim no formato "Flashback: song" / "Destaque Who: song" (sem posição)
    if (
      /^(destaque(?:\s+(?:nacional|who))?|indica[cç][aã]o|d\.?\s*nacional|dns|who)\s*:/i.test(t) &&
      !/\b\d{1,2}\s*[).º|-]/.test(t)
    ) {
      break;
    }
    if (/^-{2,}|—{2,}|=+$/.test(t)) break;
    if (/^OUTRAS ESTREIAS/i.test(t)) break;
    out.push(t);
  }
  return out;
}

function linesOf(body: string): string[] {
  // Se veio compactado sem \n, tenta inserir quebras antes de posições
  let text = body;
  if ((text.match(/\n/g) || []).length < 3) {
    text = text
      .replace(/(?=#\d{1,2}\b)/g, "\n")
      .replace(/(?=\b\d{1,2}[.)º°]\s)/g, "\n")
      .replace(/(?=\b\d{2}\s*[|.-]\s)/g, "\n")
      .replace(/(?=Melhor da Semana|Flashback|Destaque|Indica|MDS\b|OUT:|Fora:)/gi, "\n");
  }
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

type Order = "artist-title" | "title-artist";

function splitDash(line: string): { left: string; right: string } | null {
  // prioriza en-dash/em-dash; depois " - "
  const parts = line.split(/\s+[–—]\s+/);
  if (parts.length >= 2) {
    return { left: parts[0].trim(), right: parts.slice(1).join(" – ").trim() };
  }
  const idx = line.indexOf(" - ");
  if (idx >= 0) {
    return { left: line.slice(0, idx).trim(), right: line.slice(idx + 3).trim() };
  }
  // aspas: "Title": Artist
  const q = line.match(/^["“](.+?)["”]\s*:\s*(.+)$/);
  if (q) return { left: q[1].trim(), right: q[2].trim() };
  return null;
}

function parsePosPrefix(line: string): { pos: number; rest: string } | null {
  // Bruno às vezes escreve 1O. (letra O) no lugar de 10.
  const normalized = line.replace(/^(\d)[Oo]([.)º°|-])/, "10$2").replace(/^#[Oo]\b/, "#10");
  // #01) #01 #1 01. 01) 1. 1º 01 | 01-
  let m = normalized.match(/^#?\s*(\d{1,2})\s*[).º°|-]\s*(.+)$/);
  if (m) return { pos: Number(m[1]), rest: m[2].trim() };
  m = normalized.match(/^#?\s*(\d{1,2})\s+(.+)$/);
  if (m) return { pos: Number(m[1]), rest: m[2].trim() };
  return null;
}

function stripMovement(rest: string): string {
  let s = rest;
  // remove blocos [ ... ] inteiros primeiro (Leonardo/Damaceno/Franklin)
  s = s.replace(/\s*\[[^\]]*\]\s*/g, " ");
  // Damaceno às vezes: "ROSALÍA [ = | WC: 03 | PP: 01 [2x] ]" com colchete aninhado quebrado
  s = s.replace(/\s*[\[|]\s*(?:NEW|RET|=|[+\-]\d+|WC:|PP:).*$/i, "");
  s = s.replace(/\s*\|\s*WC:\s*\d+.*$/i, "");
  s = s.replace(/\s*\|\s*\d+[ªa]?\s*sem.*$/i, "");
  s = s.replace(/\s*PP:\S+.*$/i, "");
  s = s.replace(/\s*\/\s*\d+\s*Semanas.*$/i, "");
  s = s.replace(/\s*\((?:peak|#|PP:|WC:|SEMANAS|PICO|MP:|NEW|RET|=|[+\-]\d+).*$/i, "");
  s = s.replace(/\s*\*new peak\*.*$/i, "");
  s = s.replace(/\s*[\[\]]+\s*$/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function entryFromParts(pos: number, artistSide: string, titleSide: string, order: Order): ParsedEntry | null {
  if (pos < 1 || pos > 40) return null;
  let artistRaw = order === "artist-title" ? artistSide : titleSide;
  let titleRaw = order === "artist-title" ? titleSide : artistSide;
  // JR às vezes: "Title" - Artist
  artistRaw = artistRaw.replace(/^["“]|["”]$/g, "").trim();
  titleRaw = titleRaw.replace(/^["“]|["”]$/g, "").trim();
  artistRaw = stripMovement(artistRaw);
  titleRaw = stripMovement(titleRaw);
  if (!artistRaw || !titleRaw) return null;
  return { position: pos, artistRaw, titleRaw };
}

function parseGenericLines(lines: string[], order: Order): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const seen = new Set<number>();
  for (const line of cutExtras(lines)) {
    const pref = parsePosPrefix(line);
    if (!pref) continue;
    if (seen.has(pref.pos)) continue;
    const cleaned = stripMovement(pref.rest);
    const dash = splitDash(cleaned);
    if (!dash) continue;
    // remove stats trailing from right
    let right = dash.right.replace(/\s*\([^)]*(?:peak|week|sem|PP|WC)[^)]*\)\s*$/i, "").trim();
    right = stripMovement(right);
    const left = stripMovement(dash.left);
    const e = entryFromParts(pref.pos, left, right, order);
    if (e) {
      // rejeita sangramento de posição no título/artista (ex.: "3 The Dead Dance")
      if (/^\d{1,2}\s/.test(e.titleRaw) || /^\d{1,2}\s/.test(e.artistRaw)) continue;
      if (e.titleRaw.length < 1 || e.artistRaw.length < 1) continue;
      seen.add(e.position);
      entries.push(e);
    }
  }
  return entries;
}

/** Baltasar: TITLE - Artist no fim; prefixo com stats TW LW ... */
function parseBaltasar(lines: string[]): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const seen = new Set<number>();
  for (const line of cutExtras(lines)) {
    if (/^POSITION|TW LW|^\+{2,}/i.test(line)) continue;
    const m = line.match(/^(\d{1,2})\s+(.+)$/);
    if (!m) continue;
    const pos = Number(m[1]);
    if (pos < 1 || pos > 40 || seen.has(pos)) continue;
    let rest = m[2].trim();
    // remove leading LW/2W/WC tokens
    rest = rest.replace(/^(?:NEW|REE|RE|[\d]+)\s+/i, "");
    rest = rest.replace(/^(?:NEW|REE|RE|[\d]+)\s+/i, "");
    rest = rest.replace(/^(?:NEW|REE|RE|[\d]+)\s+/i, "");
    // "TITLE - N wks at #1 - Artist" ou "TITLE - Artist"
    let title: string;
    let artist: string;
    const peak = rest.match(/^(.*?)\s+-\s+\d+\s+wks?\s+at\s+#?\d+\s+-\s+(.+)$/i);
    if (peak) {
      title = peak[1].trim();
      artist = peak[2].trim();
    } else {
      const dash = splitDash(rest);
      if (!dash) continue;
      title = dash.left;
      artist = dash.right;
    }
    title = title.replace(/^\d+\s+/, "").trim();
    const e = entryFromParts(pos, artist, title, "title-artist");
    if (e) {
      seen.add(pos);
      entries.push(e);
    }
  }
  return entries;
}

/** Edilson: #20 "Title": Artist [stats] */
function parseEdilson(lines: string[]): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const seen = new Set<number>();
  for (const raw of cutExtras(lines)) {
    // normaliza dígitos estilizados
    const line = raw.normalize("NFKC");
    if (/^main\b|flashback/i.test(line)) continue;
    const m = line.match(/^#?\s*(\d{1,2})\s+["“](.+?)["”]\s*:\s*(.+)$/i);
    if (!m) continue;
    const pos = Number(m[1]);
    if (seen.has(pos)) continue;
    let artist = m[3].replace(/\s*[\[].*$/, "").replace(/\s*\*new peak\*.*$/i, "").trim();
    artist = stripMovement(artist);
    const e = entryFromParts(pos, artist, m[2], "title-artist");
    if (e) {
      seen.add(pos);
      entries.push(e);
    }
  }
  return entries;
}

/** Mauricio: 1 Title (Artist) (stats) */
function parseMauricio(lines: string[]): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  for (const line of cutExtras(lines)) {
    const m = line.match(/^(\d{1,2})\s+(.+?)\s*\(([^)]+)\)\s*(?:\(|$)/);
    if (!m) continue;
    const pos = Number(m[1]);
    const title = m[2].trim();
    let artist = m[3].trim();
    // se artist tem "feat ..."
    artist = artist.replace(/\s*feat\.?\s+/i, " feat. ");
    const e = entryFromParts(pos, artist, title, "artist-title");
    if (e) entries.push(e);
  }
  return entries;
}

/** Rodolfo: 01-07-01(1x)-Artist – Title (+21) */
function parseRodolfo(lines: string[]): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  for (const line of cutExtras(lines)) {
    const m = line.match(
      /^(\d{2})-\d{2}-\d{2}(?:\([^)]*\))?-(.+?)\s+[–—-]\s+(.+?)(?:\s*\([+=\-]|\s*$)/,
    );
    if (!m) continue;
    const pos = Number(m[1]);
    let artist = m[2].trim();
    let title = m[3].trim();
    // title pode continuar na linha seguinte já juntada; limpar remix notes no fim
    title = title.replace(/\s*\(\+[^)]*Version\)\s*/gi, " ").trim();
    const e = entryFromParts(pos, artist, title, "artist-title");
    if (e) entries.push(e);
  }
  return entries;
}

/** Daniel: [ = ] ( 1 ) Artist – Title */
function parseDaniel(lines: string[]): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  for (const line of cutExtras(lines)) {
    const m = line.match(
      /^\[[^\]]*\]\s*\(\s*(\d{1,2})\s*\)\s+(.+?)\s+[–—-]\s+(.+)$/,
    );
    if (!m) continue;
    const e = entryFromParts(Number(m[1]), m[2].trim(), m[3].trim(), "artist-title");
    if (e) entries.push(e);
  }
  return entries;
}

/** Gabriel: 1º Artist - "Title" [=] / ... */
function parseGabriel(lines: string[]): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  for (const line of cutExtras(lines)) {
    const m = line.match(/^(\d{1,2})\s*º\s+(.+?)\s+-\s+["“](.+?)["”]/);
    if (!m) continue;
    const e = entryFromParts(Number(m[1]), m[2].trim(), m[3].trim(), "artist-title");
    if (e) entries.push(e);
  }
  return entries;
}

/** Luiz: 01º Artist – "Title" [ stats ] */
function parseLuiz(lines: string[]): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  for (const line of cutExtras(lines)) {
    const m = line.match(/^(\d{1,2})\s*º\s+(.+?)\s+[–—-]\s+["“](.+?)["”]/);
    if (!m) continue;
    let artist = m[2].trim();
    let title = m[3].trim();
    // featuring no título às vezes após aspas: (featuring X) — já no resto da linha
    const featAfter = line.match(/["”]\s*\((featuring|feat\.?|ft\.?)\s+([^)]+)\)/i);
    if (featAfter) {
      title = `${title} (${featAfter[1]} ${featAfter[2]})`;
    }
    const e = entryFromParts(Number(m[1]), artist, title, "artist-title");
    if (e) entries.push(e);
  }
  return entries;
}

function detectParadaName(lines: string[], author: string): string {
  for (const line of lines.slice(0, 8)) {
    if (EXTRA_START_RE.test(line)) continue;
    if (parsePosPrefix(line)) continue;
    if (line.length > 8 && line.length < 120) return line.slice(0, 100);
  }
  return `Parada de ${author}`;
}

function parseChart(author: string, body: string, rawText: string): {
  parada: string;
  date: Date | null;
  entries: ParsedEntry[];
} {
  const hint = estimateDateFromRelative(rawText);
  const lines = linesOf(body);
  // cabeçalho = linhas antes da primeira posição
  const firstPosIdx = lines.findIndex((l) => parsePosPrefix(l) != null);
  const headerLines = (firstPosIdx >= 0 ? lines.slice(0, firstPosIdx) : lines.slice(0, 6)).slice(0, 8);
  const headerBlob = headerLines.join(" | ");
  // não varrer linhas de posição: stats tipo (1/11/1) viram data falsa
  let date = parseLooseDate(headerBlob, hint) || hint;

  // Bruno: "B PARADE 19/04" — reforça
  const bruno = body.match(/B\s*PARADE\s+(\d{1,2}\/\d{1,2})/i);
  if (bruno) date = parseLooseDate(bruno[1], hint) ?? date;

  const parada = detectParadaName(lines, author);
  let entries: ParsedEntry[] = [];

  switch (author) {
    case "M Assuncao Baltasar":
      entries = parseBaltasar(lines);
      break;
    case "Edilson Gracci":
      entries = parseEdilson(lines);
      break;
    case "Mauricio Franco":
      entries = parseMauricio(lines);
      break;
    case "Rodolfo Leitão":
      entries = parseRodolfo(lines);
      break;
    case "Daniel Valladão":
      entries = parseDaniel(lines);
      break;
    case "Gabriel Riggo":
      entries = parseGabriel(lines);
      break;
    case "Luiz Felipe Rodrigues":
      entries = parseLuiz(lines);
      break;
    case "José Roberto Moura":
      entries = parseGenericLines(lines, "title-artist");
      break;
    case "Rodrigo Damaceno":
      entries = parseGenericLines(lines, "title-artist");
      break;
    case "Marcos Nunes":
      entries = parseGenericLines(lines, "title-artist");
      break;
    default:
      entries = parseGenericLines(lines, "artist-title");
      break;
  }

  // top 20
  entries = entries
    .filter((e) => e.position >= 1 && e.position <= 20)
    .sort((a, b) => a.position - b.position);

  // dedupe posição
  const byPos = new Map<number, ParsedEntry>();
  for (const e of entries) if (!byPos.has(e.position)) byPos.set(e.position, e);
  entries = [...byPos.values()].sort((a, b) => a.position - b.position);

  return { parada, date, entries };
}

function dedupeComments(raw: RawComment[]): { author: string; text: string; body: string }[] {
  const map = new Map<string, { author: string; text: string; body: string; score: number }>();
  for (const c of raw) {
    const author = cleanAuthor(c.author);
    if (!author || author.length < 2) continue;
    const body = stripChrome(c.text);
    // fingerprint estável: autor + início do corpo normalizado (ignora compact vs multiline)
    const fp = `${author}|${body.replace(/\s+/g, " ").slice(0, 160)}`;
    const newlines = (c.text.match(/\n/g) || []).length;
    // penaliza textos colados do Facebook (quase sem quebra)
    const score = newlines * 5000 + c.text.length - (newlines < 5 ? 100000 : 0);
    const prev = map.get(fp);
    if (!prev || score > prev.score) map.set(fp, { author, text: c.text, body, score });
  }
  return [...map.values()]
    .filter((x) => (x.text.match(/\n/g) || []).length >= 3 || x.body.length < 400)
    .map(({ author, text, body }) => ({ author, text, body }));
}

function cleanArtistForLookup(input: string): string {
  let text = input.trim();
  text = text.replace(/\s+(feat\.?|featuring|ft\.?|f\/|with|w\/)\s+.*$/i, "").trim();
  text = text.replace(/\s*[,/&]\s*$/g, "").trim();
  return text || input.trim();
}

async function resolveSongFromDb(title: string, artistRaw: string) {
  const artistClean = cleanArtistForLookup(artistRaw);
  for (const titleCandidate of [title, title.replace(/\s*\(.*?\)\s*$/, "").trim()]) {
    const candidates = await prisma.song.findMany({
      where: {
        title: { equals: titleCandidate, mode: "insensitive" },
        OR: [
          { artist: { equals: artistClean, mode: "insensitive" } },
          { artist: { contains: artistClean.split(/\s+/)[0] ?? artistClean, mode: "insensitive" } },
        ],
      },
      select: { id: true, spotifyId: true, artist: true, title: true },
      take: 25,
    });
    const target = normalizeText(artistClean);
    const match =
      candidates.find((c) => normalizeText(c.artist) === target) ??
      candidates.find((c) => normalizeText(c.artist).startsWith(target)) ??
      candidates.find((c) => normalizeText(c.artist).includes(target) || target.includes(normalizeText(c.artist))) ??
      null;
    if (match) return match;
  }
  return null;
}

function buildSearchQueries(artist: string, title: string, feat: string): string[] {
  const a = cleanArtistForLookup(artist);
  const q = [`${title} ${a}`, `${title} ${a}${feat ? ` ${feat.split(",")[0]}` : ""}`];
  if (feat) q.push(`${title} ${feat.split(",")[0].trim()}`);
  return [...new Set(q.map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

async function resolveWithSpotify(title: string, artist: string, feat: string) {
  for (const market of ["BR", "US"]) {
    for (const query of buildSearchQueries(artist, title, feat).slice(0, 2)) {
      await sleep(SPOTIFY_DELAY_MS);
      const hits = await searchSpotifyTracks(query, 6, market);
      const target = normalizeText(cleanArtistForLookup(artist));
      const titleN = normalizeText(title);
      const best =
        hits.find((h) => {
          const ha = normalizeText(h.artist);
          const ht = normalizeText(h.title);
          const artistOk =
            ha === target || ha.includes(target) || target.includes(ha.split(",")[0]);
          const titleOk = ht === titleN || ht.includes(titleN) || titleN.includes(ht);
          return artistOk && titleOk;
        }) ??
        hits.find((h) => {
          const ha = normalizeText(h.artist);
          return ha === target || ha.includes(target) || target.includes(ha);
        }) ??
        hits[0];
      if (!best?.spotifyId) continue;

      const bySp = await prisma.song.findUnique({
        where: { spotifyId: best.spotifyId },
        select: { id: true, spotifyId: true, artist: true, title: true },
      });
      if (bySp) return { ...bySp, via: "spotify-db" as const };

      if (DRY_RUN) {
        return {
          id: `dry:${best.spotifyId}`,
          spotifyId: best.spotifyId,
          artist: best.artist,
          title: best.title,
          via: "spotify-dry" as const,
        };
      }

      try {
        const meta = await getSpotifyTrackMetadataById(best.spotifyId, market);
        if (!meta) continue;
        const song = await upsertSongFromSpotify(best.spotifyId, {
          track: title,
          artist: cleanArtistForLookup(artist),
          album: meta.album.title ?? "",
        });
        return {
          id: song.id,
          spotifyId: song.spotifyId,
          artist: song.artist,
          title: song.title,
          via: "spotify-upsert" as const,
        };
      } catch (err) {
        if (VERBOSE) console.warn(`[spotify] upsert falhou ${best.spotifyId}:`, err);
      }
    }
  }
  return null;
}

function writeExcel(rows: ChartRow[]) {
  const payloadPath = OUT_JSON;
  writeFileSync(payloadPath, JSON.stringify(rows, null, 2), "utf-8");
  const py = `
import json, sys
from openpyxl import Workbook
from openpyxl.styles import Font

rows = json.load(open(r"${payloadPath.replace(/\\/g, "\\\\")}", encoding="utf-8"))
wb = Workbook()
ws = wb.active
ws.title = "Paradas"
headers = ["Pessoa","Parada","Data","Posição","Artista","Feat","Música","songId","spotifyId","baixa_confianca","match","weekIndex"]
ws.append(headers)
for c in ws[1]:
    c.font = Font(bold=True)
for r in rows:
    ws.append([
        r.get("pessoa"), r.get("parada"), r.get("data"), r.get("posicao"),
        r.get("artista"), r.get("feat"), r.get("musica"),
        r.get("songId"), r.get("spotifyId"),
        bool(r.get("baixa_confianca")), r.get("match"), r.get("weekIndex"),
    ])
# abas de resumo
ws2 = wb.create_sheet("Por pessoa")
from collections import Counter, defaultdict
ws2.append(["Pessoa","Paradas","Entradas","Sem songId","Sem Spotify"])
by = defaultdict(lambda: {"charts": set(), "n": 0, "noSong": 0, "noSp": 0})
for r in rows:
    b = by[r["pessoa"]]
    b["charts"].add(r["data"])
    b["n"] += 1
    if not r.get("songId"): b["noSong"] += 1
    if not r.get("spotifyId"): b["noSp"] += 1
for p, b in sorted(by.items(), key=lambda x: (-len(x[1]["charts"]), x[0])):
    ws2.append([p, len(b["charts"]), b["n"], b["noSong"], b["noSp"]])

ws3 = wb.create_sheet("Pendentes")
ws3.append(headers)
for r in rows:
    if not r.get("songId") or not r.get("spotifyId") or r.get("baixa_confianca"):
        ws3.append([
            r.get("pessoa"), r.get("parada"), r.get("data"), r.get("posicao"),
            r.get("artista"), r.get("feat"), r.get("musica"),
            r.get("songId"), r.get("spotifyId"),
            bool(r.get("baixa_confianca")), r.get("match"), r.get("weekIndex"),
        ])

wb.save(r"${OUT_XLSX.replace(/\\/g, "\\\\")}")
print("saved", ${JSON.stringify(OUT_XLSX)}, "rows", len(rows))
`;
  const pyPath = join(process.cwd(), "scripts", "_tmp_write_paradas_xlsx.py");
  writeFileSync(pyPath, py, "utf-8");
  execFileSync("python", [pyPath], { stdio: "inherit" });
}

async function main() {
  console.log(`[info] Lendo ${INPUT}`);
  const raw = JSON.parse(readFileSync(INPUT, "utf-8")) as RawComment[];
  const comments = dedupeComments(raw);
  console.log(`[info] Comentários únicos: ${comments.length}`);

  const parsedRows: Omit<ChartRow, "songId" | "spotifyId" | "baixa_confianca" | "match">[] = [];
  const parseStats: Record<string, { charts: number; entries: number; skippedDate: number; empty: number }> = {};

  for (const c of comments) {
    const st = (parseStats[c.author] ??= { charts: 0, entries: 0, skippedDate: 0, empty: 0 });
    const parsed = parseChart(c.author, c.body, c.text);
    if (!parsed.date) {
      st.skippedDate++;
      if (VERBOSE) console.warn(`[warn] sem data: ${c.author} | ${parsed.parada}`);
      continue;
    }
    const weekIndex = buildWeekIndexFromDate(parsed.date);
    if (weekIndex < MIN_WEEK || weekIndex > MAX_WEEK) {
      st.skippedDate++;
      continue;
    }
    if (!parsed.entries.length) {
      st.empty++;
      if (VERBOSE) console.warn(`[warn] sem entradas: ${c.author} | ${formatPt(parsed.date)}`);
      continue;
    }
    st.charts++;
    st.entries += parsed.entries.length;
    for (const e of parsed.entries) {
      const split = splitArtistAndFeat(e.artistRaw, e.titleRaw);
      parsedRows.push({
        pessoa: c.author,
        parada: parsed.parada,
        data: formatPt(parsed.date),
        dataIso: formatIso(parsed.date),
        weekIndex,
        posicao: e.position,
        artista: split.artist,
        feat: split.feat,
        musica: split.title,
        sourceAuthor: c.author,
      });
    }
  }

  console.log("[info] Parse por pessoa:");
  for (const [a, s] of Object.entries(parseStats).sort((x, y) => y[1].charts - x[1].charts)) {
    console.log(
      `  ${a}: ${s.charts} paradas, ${s.entries} entradas, skipDate=${s.skippedDate}, empty=${s.empty}`,
    );
  }
  console.log(`[info] Linhas parseadas (top20, >=${MIN_WEEK}): ${parsedRows.length}`);

  if (PARSE_ONLY) {
    writeFileSync(
      OUT_JSON,
      JSON.stringify(
        parsedRows.map((r) => ({ ...r, songId: "", spotifyId: "", baixa_confianca: false, match: "parse" })),
        null,
        2,
      ),
      "utf-8",
    );
    writeExcel(
      parsedRows.map((r) => ({
        ...r,
        songId: "",
        spotifyId: "",
        baixa_confianca: false,
        match: "parse-only",
      })),
    );
    writeFileSync(OUT_REPORT, JSON.stringify({ parseStats, total: parsedRows.length }, null, 2));
    console.log(`[ok] parse-only → ${OUT_XLSX}`);
    return;
  }

  const cachePath = join(process.cwd(), "uploads", "_tmp_fb_song_cache.json");
  const cache = new Map<string, { id: string; spotifyId: string | null; via: string } | null>();
  if (existsSync(cachePath)) {
    try {
      const prev = JSON.parse(readFileSync(cachePath, "utf-8")) as Record<
        string,
        { id: string; spotifyId: string | null; via: string } | null
      >;
      for (const [k, v] of Object.entries(prev)) cache.set(k, v);
      console.log(`[info] cache de músicas: ${cache.size}`);
    } catch {
      /* ignore */
    }
  }
  const out: ChartRow[] = [];
  let i = 0;
  for (const r of parsedRows) {
    i++;
    const key = `${normalizeText(r.musica)}|${normalizeText(r.artista)}|${normalizeText(r.feat)}`;
    let resolved = cache.has(key) ? cache.get(key)! : undefined;
    if (resolved === undefined) {
      const db = await resolveSongFromDb(r.musica, r.artista);
      if (db) {
        resolved = { id: db.id, spotifyId: db.spotifyId, via: "db" };
      } else if (!SKIP_SPOTIFY) {
        const sp = await resolveWithSpotify(r.musica, r.artista, r.feat);
        resolved = sp
          ? { id: sp.id, spotifyId: sp.spotifyId, via: sp.via }
          : null;
      } else {
        resolved = null;
      }
      cache.set(key, resolved);
      if (i % 25 === 0) console.log(`[info] resolve ${i}/${parsedRows.length}...`);
    }

    const baixa = !resolved?.id || !resolved.spotifyId;
    out.push({
      ...r,
      songId: resolved?.id ?? "",
      spotifyId: resolved?.spotifyId ?? "",
      baixa_confianca: baixa,
      match: resolved?.via ?? "not-found",
    });
  }

  writeFileSync(
    cachePath,
    JSON.stringify(Object.fromEntries(cache.entries()), null, 2),
    "utf-8",
  );

  writeExcel(out);
  const found = out.filter((r) => r.songId).length;
  const withSp = out.filter((r) => r.spotifyId).length;
  writeFileSync(
    OUT_REPORT,
    JSON.stringify(
      {
        parseStats,
        total: out.length,
        withSongId: found,
        withSpotifyId: withSp,
        missing: out.length - found,
        dryRun: DRY_RUN,
      },
      null,
      2,
    ),
  );
  console.log(`[ok] ${out.length} linhas | songId=${found} | spotifyId=${withSp} → ${OUT_XLSX}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
