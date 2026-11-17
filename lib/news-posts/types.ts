/**
 * Tipos e regras da central de notícias (/admin/noticias). Arquivo puro —
 * usado tanto no editor (cliente) quanto nas rotas de API.
 *
 * Limites de texto vêm do design "Posts de notícias para o Instagram":
 * passou disso, o texto não cabe nas linhas previstas da arte.
 */

export const NEWS_POST_FORMATS = ["SINGLE", "CAROUSEL", "VIDEO"] as const;
export type NewsPostFormatValue = (typeof NEWS_POST_FORMATS)[number];

export const NEWS_THEMES = ["light", "dark"] as const;
export type NewsTheme = (typeof NEWS_THEMES)[number];

export type NewsContentSlide = {
  kind: "content";
  eyebrow: string;
  title: string;
  /** Parágrafos separados por linha em branco; o último sai em cor secundária quando há mais de um. */
  body: string;
};

export type NewsStat = { label: string; value: string };

export type NewsHighlightSlide = {
  kind: "highlight";
  eyebrow: string;
  label: string;
  value: string;
  caption: string;
  stats: NewsStat[];
};

export type NewsMiddleSlide = NewsContentSlide | NewsHighlightSlide;

export type NewsClosingSlide = {
  eyebrow: string;
  title: string;
  text: string;
  cta: string;
};

export type NewsPostContent = {
  slides: NewsMiddleSlide[];
  closing: NewsClosingSlide;
};

/** Forma editável de um post — o que o editor manda para a API. */
export type NewsPostInput = {
  format: NewsPostFormatValue;
  theme: NewsTheme;
  eyebrow: string;
  title: string;
  summary: string;
  /** YYYY-MM-DD */
  newsDate: string;
  content: NewsPostContent;
  caption: string;
};

export const NEWS_LIMITS = {
  eyebrow: 24,
  singleTitle: 70,
  singleSummary: 110,
  coverTitle: 60,
  coverSummary: 110,
  contentTitle: 55,
  contentBody: 260,
  highlightLabel: 24,
  highlightValue: 6,
  highlightCaption: 40,
  statLabel: 20,
  statValue: 8,
  maxStats: 2,
  closingTitle: 40,
  closingText: 110,
  cta: 24,
  videoTitle: 70,
  caption: 2200,
  /** Instagram aceita até 10 itens; capa + fechamento ocupam 2. */
  maxMiddleSlides: 8,
} as const;

export const DEFAULT_CLOSING: NewsClosingSlide = {
  eyebrow: "Continue lendo",
  title: "A matéria completa está no site",
  text: "",
  cta: "chartfm.com.br",
};

export function emptyContentSlide(): NewsContentSlide {
  return { kind: "content", eyebrow: "", title: "", body: "" };
}

export function emptyHighlightSlide(): NewsHighlightSlide {
  return { kind: "highlight", eyebrow: "Em números", label: "", value: "", caption: "", stats: [] };
}

function str(v: unknown, max = 5000): string {
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").slice(0, max) : "";
}

/** Converte o JSON do banco (ou do corpo da requisição) em conteúdo bem formado. */
export function normalizeNewsContent(raw: unknown): NewsPostContent {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawSlides = Array.isArray(obj.slides) ? obj.slides : [];
  const slides: NewsMiddleSlide[] = [];
  for (const s of rawSlides.slice(0, NEWS_LIMITS.maxMiddleSlides)) {
    if (!s || typeof s !== "object") continue;
    const r = s as Record<string, unknown>;
    if (r.kind === "highlight") {
      const stats = (Array.isArray(r.stats) ? r.stats : [])
        .slice(0, NEWS_LIMITS.maxStats)
        .map((st) => {
          const x = (st && typeof st === "object" ? st : {}) as Record<string, unknown>;
          return { label: str(x.label, 200), value: str(x.value, 200) };
        });
      slides.push({
        kind: "highlight",
        eyebrow: str(r.eyebrow, 200),
        label: str(r.label, 200),
        value: str(r.value, 200),
        caption: str(r.caption, 200),
        stats,
      });
    } else {
      slides.push({ kind: "content", eyebrow: str(r.eyebrow, 200), title: str(r.title, 500), body: str(r.body, 3000) });
    }
  }
  const c = (obj.closing && typeof obj.closing === "object" ? obj.closing : {}) as Record<string, unknown>;
  return {
    slides,
    closing: {
      eyebrow: typeof c.eyebrow === "string" ? str(c.eyebrow, 200) : DEFAULT_CLOSING.eyebrow,
      title: typeof c.title === "string" ? str(c.title, 500) : DEFAULT_CLOSING.title,
      text: str(c.text, 1000),
      cta: typeof c.cta === "string" ? str(c.cta, 200) : DEFAULT_CLOSING.cta,
    },
  };
}

export function isNewsFormat(v: unknown): v is NewsPostFormatValue {
  return typeof v === "string" && (NEWS_POST_FORMATS as readonly string[]).includes(v);
}

export function normalizeNewsInput(raw: unknown): NewsPostInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isNewsFormat(r.format)) return null;
  const date = str(r.newsDate, 10);
  return {
    format: r.format,
    theme: r.theme === "dark" ? "dark" : "light",
    eyebrow: str(r.eyebrow, 200).trim(),
    title: str(r.title, 500).trim(),
    summary: str(r.summary, 1000).trim(),
    newsDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10),
    content: normalizeNewsContent(r.content),
    caption: str(r.caption, 10000),
  };
}

/** Erro de validação: `field` é um caminho estável (ex.: "slides.2.title"), `code` vira chave de i18n. */
export type NewsValidationIssue = {
  field: string;
  code: "required" | "tooLong" | "tooManySlides";
  max?: number;
};

function checkText(issues: NewsValidationIssue[], field: string, value: string, max: number, required: boolean) {
  const len = [...value].length;
  if (required && !value.trim()) issues.push({ field, code: "required" });
  else if (len > max) issues.push({ field, code: "tooLong", max });
}

/**
 * Valida contra os limites do design. Retorna lista vazia quando o post pode
 * gerar artes/publicar. Rascunhos podem ser salvos mesmo com problemas.
 */
export function validateNewsPost(input: NewsPostInput): NewsValidationIssue[] {
  const issues: NewsValidationIssue[] = [];
  const L = NEWS_LIMITS;
  checkText(issues, "eyebrow", input.eyebrow, L.eyebrow, false);
  checkText(issues, "caption", input.caption, L.caption, false);

  if (input.format === "SINGLE") {
    checkText(issues, "title", input.title, L.singleTitle, true);
    checkText(issues, "summary", input.summary, L.singleSummary, false);
  } else if (input.format === "VIDEO") {
    checkText(issues, "title", input.title, L.videoTitle, true);
  } else {
    checkText(issues, "title", input.title, L.coverTitle, true);
    checkText(issues, "summary", input.summary, L.coverSummary, false);
    const { slides, closing } = input.content;
    if (slides.length > L.maxMiddleSlides) issues.push({ field: "slides", code: "tooManySlides", max: L.maxMiddleSlides });
    slides.forEach((s, i) => {
      const p = `slides.${i}`;
      checkText(issues, `${p}.eyebrow`, s.eyebrow, L.eyebrow, false);
      if (s.kind === "content") {
        checkText(issues, `${p}.title`, s.title, L.contentTitle, true);
        checkText(issues, `${p}.body`, s.body, L.contentBody, false);
      } else {
        checkText(issues, `${p}.value`, s.value, L.highlightValue, true);
        checkText(issues, `${p}.label`, s.label, L.highlightLabel, false);
        checkText(issues, `${p}.caption`, s.caption, L.highlightCaption, false);
        s.stats.forEach((st, j) => {
          checkText(issues, `${p}.stats.${j}.label`, st.label, L.statLabel, true);
          checkText(issues, `${p}.stats.${j}.value`, st.value, L.statValue, true);
        });
      }
    });
    checkText(issues, "closing.eyebrow", closing.eyebrow, L.eyebrow, false);
    checkText(issues, "closing.title", closing.title, L.closingTitle, true);
    checkText(issues, "closing.text", closing.text, L.closingText, false);
    checkText(issues, "closing.cta", closing.cta, L.cta, true);
  }
  return issues;
}

/** Quantas artes o post gera (carrossel: capa + meio + fechamento). */
export function newsSlideCount(format: NewsPostFormatValue, content: NewsPostContent): number {
  return format === "CAROUSEL" ? content.slides.length + 2 : 1;
}

/** "08 nov 2026" (pt) / "Nov 08, 2026" (en) a partir de YYYY-MM-DD, sem depender de fuso. */
export function formatNewsDate(isoDate: string, locale: "pt-BR" | "en" = "pt-BR"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  const [, y, mo, d] = m;
  const idx = Number(mo) - 1;
  const pt = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const en = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (idx < 0 || idx > 11) return isoDate;
  return locale === "en" ? `${en[idx]} ${d}, ${y}` : `${d} ${pt[idx]} ${y}`;
}

/** Campos que, se mudarem, invalidam as artes já geradas. */
export function newsVisualFingerprint(input: Omit<NewsPostInput, "caption"> & { photoUrl?: string | null; videoUrl?: string | null }): string {
  return JSON.stringify([
    input.format,
    input.theme,
    input.eyebrow,
    input.title,
    input.summary,
    input.newsDate,
    input.content,
    input.photoUrl ?? null,
    input.videoUrl ?? null,
  ]);
}

export type NewsPostStatusValue = "DRAFT" | "PUBLISHING" | "PUBLISHED" | "FAILED";

/** Post como a API devolve para o editor. */
export type NewsPostDTO = NewsPostInput & {
  id: string;
  status: NewsPostStatusValue;
  photoUrl: string | null;
  videoUrl: string | null;
  renderedImages: string[];
  renderedVideo: string | null;
  renderedAt: string | null;
  instagramMediaId: string | null;
  publishedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export function newsDtoFingerprint(dto: NewsPostDTO): string {
  return newsVisualFingerprint(dto);
}

/** Legenda inicial sugerida a partir do texto do post (o admin edita antes de publicar). */
export function suggestNewsCaption(input: Pick<NewsPostInput, "format" | "eyebrow" | "title" | "summary">): string {
  const lines = [input.title.trim()];
  if (input.summary.trim()) lines.push("", input.summary.trim());
  lines.push("", input.format === "VIDEO" ? "Mais no link da bio." : "Leia na íntegra no link da bio.");
  const tags = ["#ChartFM", "#Notícias"];
  const eyebrowTag = input.eyebrow.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "");
  if (eyebrowTag) tags.push(`#${eyebrowTag}`);
  lines.push("", tags.join(" "));
  return lines.join("\n");
}
