"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Download, Image as ImageIcon, LayoutGrid, Plus, Save, Send, Sparkles, Trash2, Video, X } from "lucide-react";
import { useTranslations } from "@/hooks/useTranslations";
import { useIsMobile } from "@/hooks/useIsMobile";
import { NewsPostArtPreview, newsArtSlideKinds } from "@/components/news-posts/NewsPostArt";
import { captureVideoFrame, exportNewsArt } from "@/components/news-posts/export-art";
import {
  NEWS_LIMITS,
  emptyContentSlide,
  emptyHighlightSlide,
  newsDtoFingerprint,
  newsSlideCount,
  suggestNewsCaption,
  validateNewsPost,
  type NewsMiddleSlide,
  type NewsPostDTO,
  type NewsPostFormatValue,
  type NewsPostStatusValue,
  type NewsValidationIssue,
} from "@/lib/news-posts/types";

type Filter = "all" | "DRAFT" | "PUBLISHED" | "FAILED";
type Busy = null | "save" | "upload" | "generate" | "download" | "publish" | "delete" | "duplicate" | "create";

const API = "/api/admin/news-posts";
const FORMATS: NewsPostFormatValue[] = ["SINGLE", "CAROUSEL", "VIDEO"];

class ApiError extends Error {
  constructor(
    public code: string,
    public post?: NewsPostDTO,
  ) {
    super(code);
  }
}

async function api(url: string, init?: RequestInit): Promise<{ post?: NewsPostDTO; posts?: NewsPostDTO[] }> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(typeof json.error === "string" ? json.error : "generic", json.post);
  return json;
}

function editableSnapshot(p: NewsPostDTO): string {
  return JSON.stringify([p.theme, p.eyebrow, p.title, p.summary, p.newsDate, p.content, p.caption]);
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function charCount(v: string): number {
  return [...v].length;
}

// ───────────────────────── estilos ─────────────────────────

const card: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--divider)",
  borderRadius: 16,
  padding: 18,
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--fill-inset, var(--surface))",
  color: "var(--text)",
  border: "1px solid var(--divider-strong)",
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

const sectionTitle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-subtle)",
  marginBottom: 12,
};

function btn(kind: "primary" | "dark" | "ghost" | "danger" = "ghost"): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 700,
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  };
  if (kind === "primary") return { ...base, background: "var(--accent)", color: "#fff" };
  if (kind === "dark") return { ...base, background: "var(--btn-dark-bg)", color: "var(--btn-dark-fg)" };
  if (kind === "danger") return { ...base, background: "transparent", color: "var(--down-fg, #C5291C)", borderColor: "var(--divider-strong)" };
  return { ...base, background: "var(--surface)", color: "var(--text)", borderColor: "var(--divider-strong)" };
}

const STATUS_COLORS: Record<NewsPostStatusValue, { bg: string; fg: string }> = {
  DRAFT: { bg: "var(--same-bg)", fg: "var(--same-fg)" },
  PUBLISHING: { bg: "var(--accent-tint)", fg: "var(--accent)" },
  PUBLISHED: { bg: "var(--up-bg)", fg: "var(--up-fg)" },
  FAILED: { bg: "var(--down-bg)", fg: "var(--down-fg)" },
};

function Chip({ children, bg, fg }: { children: ReactNode; bg: string; fg: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 700, background: bg, color: fg }}>
      {children}
    </span>
  );
}

// ───────────────────────── campos ─────────────────────────

function Field({
  label,
  value,
  onChange,
  max,
  multiline,
  rows = 3,
  issue,
  hint,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  multiline?: boolean;
  rows?: number;
  issue?: string | null;
  hint?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { t } = useTranslations();
  const count = charCount(value);
  const over = max !== undefined && count > max;
  const style: CSSProperties = { ...inputStyle, borderColor: issue || over ? "var(--accent)" : "var(--divider-strong)", resize: "vertical" };
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 600, color: "var(--text-subtle)", marginBottom: 5 }}>
        <span>{label}</span>
        {max !== undefined && (
          <span style={{ fontVariantNumeric: "tabular-nums", color: over ? "var(--accent)" : "var(--text-muted)" }}>{t("adminNews.limit", { count, max })}</span>
        )}
      </span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} style={style} disabled={disabled} placeholder={placeholder} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} style={style} disabled={disabled} placeholder={placeholder} />
      )}
      {issue && <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--accent)" }}>{issue}</span>}
      {hint && !issue && <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>{hint}</span>}
    </label>
  );
}

// ───────────────────────── componente principal ─────────────────────────

export function NewsCenterClient() {
  const { t, locale } = useTranslations();
  const isMobile = useIsMobile(1100);
  const [posts, setPosts] = useState<NewsPostDTO[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [choosing, setChoosing] = useState(false);
  const [draft, setDraft] = useState<NewsPostDTO | null>(null);
  const [saved, setSaved] = useState<NewsPostDTO | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", { dateStyle: "short", timeStyle: "short" }),
    [locale],
  );
  const fmt = useCallback((iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : ""), [dateFmt]);

  const errorText = useCallback(
    (code: string) => {
      const key = `adminNews.err_${code}`;
      const text = t(key);
      return text === key ? t("adminNews.err_generic") : text;
    },
    [t],
  );

  const load = useCallback(async () => {
    try {
      const json = await api(API);
      setPosts(json.posts ?? []);
    } catch (err) {
      setPosts([]);
      setMessage({ kind: "error", text: errorText(err instanceof ApiError ? err.code : "generic") });
    }
  }, [errorText]);

  useEffect(() => {
    void load();
  }, [load]);

  const replacePost = useCallback((p: NewsPostDTO) => {
    setPosts((list) => {
      if (!list) return [p];
      const others = list.filter((x) => x.id !== p.id);
      return [p, ...others];
    });
  }, []);

  function open(p: NewsPostDTO) {
    setDraft(p);
    setSaved(p);
    setMessage(null);
    setShowIssues(false);
    window.scrollTo({ top: 0 });
  }

  function close() {
    if (dirty && !window.confirm(t("adminNews.unsaved") + " — " + t("adminNews.back") + "?")) return;
    setDraft(null);
    setSaved(null);
    setMessage(null);
  }

  async function run<T>(kind: Busy, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(kind);
    setMessage(null);
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.post) {
          setDraft(err.post);
          setSaved(err.post);
          replacePost(err.post);
        }
        setMessage({ kind: "error", text: err.post?.lastError ? t("adminNews.lastError", { error: err.post.lastError }) : errorText(err.code) });
      } else {
        console.error("[admin/noticias]", err);
        setMessage({ kind: "error", text: kind === "generate" ? t("adminNews.err_export") : t("adminNews.err_generic") });
      }
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function create(format: NewsPostFormatValue) {
    setChoosing(false);
    await run("create", async () => {
      const json = await api(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          title: "",
          newsDate: todayIso(),
          content: format === "CAROUSEL" ? { slides: [emptyContentSlide(), emptyHighlightSlide()] } : {},
        }),
      });
      replacePost(json.post!);
      open(json.post!);
    });
  }

  const dirty = !!draft && !!saved && editableSnapshot(draft) !== editableSnapshot(saved);
  const locked = !!draft && (draft.status === "PUBLISHED" || draft.status === "PUBLISHING");
  const issues = useMemo(() => (draft ? validateNewsPost(draft) : []), [draft]);

  function issueFor(field: string): string | null {
    if (!showIssues && !issues.some((i) => i.field === field && i.code === "tooLong")) return null;
    const i = issues.find((x) => x.field === field);
    return i ? t(`adminNews.issue_${i.code}`, { max: i.max ?? 0 }) : null;
  }

  function patch(p: Partial<NewsPostDTO>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }

  function patchSlides(fn: (slides: NewsMiddleSlide[]) => NewsMiddleSlide[]) {
    setDraft((d) => (d ? { ...d, content: { ...d.content, slides: fn(d.content.slides) } } : d));
  }

  function patchSlide(i: number, p: Partial<NewsMiddleSlide>) {
    patchSlides((s) => s.map((x, j) => (j === i ? ({ ...x, ...p } as NewsMiddleSlide) : x)));
  }

  async function save(): Promise<NewsPostDTO | undefined> {
    if (!draft) return undefined;
    if (!dirty) return saved ?? draft;
    return run("save", async () => {
      const json = await api(`${API}/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: draft.theme,
          eyebrow: draft.eyebrow,
          title: draft.title,
          summary: draft.summary,
          newsDate: draft.newsDate,
          content: draft.content,
          caption: draft.caption,
        }),
      });
      setDraft(json.post!);
      setSaved(json.post!);
      replacePost(json.post!);
      return json.post!;
    });
  }

  async function upload(file: File) {
    if (!draft) return;
    const current = await save();
    if (!current) return;
    await run("upload", async () => {
      const fd = new FormData();
      fd.append("file", file);
      const json = await api(`${API}/${draft.id}/media`, { method: "POST", body: fd });
      setDraft(json.post!);
      setSaved(json.post!);
      replacePost(json.post!);
    });
  }

  async function removeMedia() {
    if (!draft) return;
    await run("upload", async () => {
      const json = await api(`${API}/${draft.id}/media`, { method: "DELETE" });
      setDraft((d) => (d ? { ...json.post!, ...pickEditable(d) } : json.post!));
      setSaved(json.post!);
      replacePost(json.post!);
    });
  }

  async function generate() {
    if (!draft) return;
    if (issues.length > 0) {
      setShowIssues(true);
      setMessage({ kind: "error", text: t("adminNews.issuesTitle") });
      return;
    }
    if (draft.format === "VIDEO" && !draft.videoUrl) {
      setMessage({ kind: "error", text: errorText("missing_video") });
      return;
    }
    const current = await save();
    if (!current) return;
    await run("generate", async () => {
      const frame = current.format === "VIDEO" && current.videoUrl ? await captureVideoFrame(current.videoUrl) : null;
      const blobs = await exportNewsArt(current, newsSlideCount(current.format, current.content), frame);
      const fd = new FormData();
      fd.append("fingerprint", newsDtoFingerprint(current));
      blobs.forEach((b, i) => fd.append(`slide-${i}`, b, `slide-${i}.png`));
      const json = await api(`${API}/${current.id}/render`, { method: "POST", body: fd });
      setDraft(json.post!);
      setSaved(json.post!);
      replacePost(json.post!);
    });
  }

  async function download() {
    if (!saved || saved.renderedImages.length === 0) return;
    await run("download", async () => {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const files = saved.renderedImages.map((url, i) => ({ url, name: `slide-${String(i + 1).padStart(2, "0")}.png` }));
      if (saved.renderedVideo) files.push({ url: saved.renderedVideo, name: "video.mp4" });
      for (const f of files) {
        const res = await fetch(f.url);
        if (!res.ok) throw new Error(`download ${f.name}`);
        zip.file(f.name, await res.blob());
      }
      if (saved.caption) zip.file("legenda.txt", saved.caption);
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const slug = saved.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-|-$/g, "");
      a.download = `chartfm-noticia-${slug || saved.id}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
  }

  async function publish() {
    if (!draft) return;
    if (!draft.caption.trim()) {
      setMessage({ kind: "error", text: errorText("missing_caption") });
      return;
    }
    const current = await save();
    if (!current) return;
    if (current.renderedImages.length === 0) {
      setMessage({ kind: "error", text: errorText("not_rendered") });
      return;
    }
    if (!window.confirm(t("adminNews.confirmPublish"))) return;
    patch({ status: "PUBLISHING" });
    const result = await run("publish", async () => {
      const json = await api(`${API}/${current.id}/publish`, { method: "POST" });
      setDraft(json.post!);
      setSaved(json.post!);
      replacePost(json.post!);
      return json.post!;
    });
    if (result) setMessage({ kind: "ok", text: t("adminNews.publishedOk") });
  }

  async function duplicate() {
    if (!draft) return;
    await run("duplicate", async () => {
      const json = await api(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicateOf: draft.id }),
      });
      replacePost(json.post!);
      open(json.post!);
    });
  }

  async function remove() {
    if (!draft || !window.confirm(t("adminNews.confirmDelete"))) return;
    await run("delete", async () => {
      await api(`${API}/${draft.id}`, { method: "DELETE" });
      setPosts((list) => (list ?? []).filter((p) => p.id !== draft.id));
      setDraft(null);
      setSaved(null);
    });
  }

  // ───────────── lista ─────────────

  if (!draft) {
    const visible = (posts ?? []).filter((p) => filter === "all" || p.status === filter || (filter === "DRAFT" && p.status === "PUBLISHING"));
    return (
      <div style={{ padding: isMobile ? "0 16px" : "0 40px", maxWidth: 1200 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["all", "DRAFT", "PUBLISHED", "FAILED"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  ...btn(),
                  padding: "6px 12px",
                  background: filter === f ? "var(--btn-dark-bg)" : "var(--surface)",
                  color: filter === f ? "var(--btn-dark-fg)" : "var(--text-subtle)",
                }}
              >
                {t(`adminNews.filter_${f}`)}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setChoosing(true)} style={btn("primary")} disabled={busy === "create"}>
            <Plus size={15} />
            {t("adminNews.newPost")}
          </button>
        </div>

        {message && <Banner kind={message.kind}>{message.text}</Banner>}

        {choosing && (
          <div style={{ ...card, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={sectionTitle}>{t("adminNews.chooseFormat")}</div>
              <button type="button" onClick={() => setChoosing(false)} style={{ ...btn(), padding: 6 }} aria-label={t("adminNews.cancel")}>
                <X size={14} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => void create(f)}
                  style={{
                    textAlign: "left",
                    background: "var(--bg)",
                    color: "var(--text)",
                    border: "1px solid var(--divider-strong)",
                    borderRadius: 14,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 15 }}>
                    <FormatIcon format={f} />
                    {t(`adminNews.format_${f}`)}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text-subtle)", lineHeight: 1.45 }}>{t(`adminNews.formatDesc_${f}`)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {posts === null ? (
          <div style={{ color: "var(--text-muted)" }}>{t("adminNews.loading")}</div>
        ) : visible.length === 0 ? (
          <div style={{ ...card, color: "var(--text-muted)", textAlign: "center", padding: 40 }}>{t("adminNews.empty")}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {visible.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => open(p)}
                style={{ ...card, padding: 12, textAlign: "left", color: "var(--text)", display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                {p.renderedImages[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.renderedImages[0]} alt="" style={{ width: 84, aspectRatio: "3 / 4", borderRadius: 6, border: "1px solid var(--divider-strong)", flex: "none" }} />
                ) : (
                  <NewsPostArtPreview post={{ ...p, videoUrl: null }} index={0} width={84} />
                )}
                <span style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Chip bg={STATUS_COLORS[p.status].bg} fg={STATUS_COLORS[p.status].fg}>
                      {t(`adminNews.status_${p.status}`)}
                    </Chip>
                    <Chip bg="var(--fill-subtle)" fg="var(--text-subtle)">
                      {t(`adminNews.format_${p.format}`)}
                    </Chip>
                  </span>
                  <span className="line-clamp-3" style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>
                    {p.title || t("adminNews.untitled")}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("adminNews.updatedAt", { date: fmt(p.updatedAt) })}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ───────────── editor ─────────────

  const L = NEWS_LIMITS;
  const kinds = newsArtSlideKinds(draft);
  const renderedFresh = !!saved && saved.renderedImages.length > 0 && !dirty;
  const isCarousel = draft.format === "CAROUSEL";
  const titleMax = draft.format === "SINGLE" ? L.singleTitle : draft.format === "VIDEO" ? L.videoTitle : L.coverTitle;
  const summaryMax = draft.format === "SINGLE" ? L.singleSummary : L.coverSummary;
  const previewWidth = isMobile ? 300 : isCarousel ? 270 : 400;

  return (
    <div style={{ padding: isMobile ? "0 16px" : "0 40px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <button type="button" onClick={close} style={btn()}>
          <ArrowLeft size={14} />
          {t("adminNews.back")}
        </button>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 16 }}>
          <FormatIcon format={draft.format} />
          {t(`adminNews.format_${draft.format}`)}
        </span>
        <Chip bg={STATUS_COLORS[draft.status].bg} fg={STATUS_COLORS[draft.status].fg}>
          {t(`adminNews.status_${draft.status}`)}
        </Chip>
        {dirty && <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{t("adminNews.unsaved")}</span>}
      </div>

      {locked && (
        <Banner kind="ok">
          {draft.status === "PUBLISHING" ? t("adminNews.lockedPublishing") : t("adminNews.lockedPublished", { date: fmt(draft.publishedAt) })}
        </Banner>
      )}
      {draft.status === "FAILED" && draft.lastError && !message && <Banner kind="error">{t("adminNews.lastError", { error: draft.lastError })}</Banner>}
      {message && <Banner kind={message.kind}>{message.text}</Banner>}

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 24, alignItems: "flex-start" }}>
        {/* Formulário */}
        <fieldset disabled={locked || busy !== null} style={{ border: 0, padding: 0, margin: 0, width: isMobile ? "100%" : 440, flex: "none", minWidth: 0 }}>
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={sectionTitle}>{isCarousel ? t("adminNews.slideCover") : t("adminNews.preview")}</div>
            {draft.format !== "VIDEO" && (
              <div style={{ marginBottom: 12 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-subtle)", marginBottom: 5 }}>{t("adminNews.theme")}</span>
                <div style={{ display: "inline-flex", border: "1px solid var(--divider-strong)", borderRadius: 999, padding: 2 }}>
                  {(["light", "dark"] as const).map((th) => (
                    <button
                      key={th}
                      type="button"
                      onClick={() => patch({ theme: th })}
                      style={{
                        border: 0,
                        borderRadius: 999,
                        padding: "5px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        background: draft.theme === th ? "var(--btn-dark-bg)" : "transparent",
                        color: draft.theme === th ? "var(--btn-dark-fg)" : "var(--text-subtle)",
                      }}
                    >
                      {t(`adminNews.theme_${th}`)}
                    </button>
                  ))}
                </div>
                {isCarousel && <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>{t("adminNews.themeCoverFixed")}</span>}
              </div>
            )}
            {draft.format === "VIDEO" && <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>{t("adminNews.themeVideoFixed")}</p>}

            {draft.format !== "CAROUSEL" && (
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-subtle)", marginBottom: 5 }}>{t("adminNews.date")}</span>
                <input type="date" value={draft.newsDate} onChange={(e) => e.target.value && patch({ newsDate: e.target.value })} style={inputStyle} />
              </label>
            )}
            <Field label={t("adminNews.eyebrow")} value={draft.eyebrow} onChange={(v) => patch({ eyebrow: v })} max={L.eyebrow} issue={issueFor("eyebrow")} placeholder="Global 100" />
            <Field label={t("adminNews.titleField")} value={draft.title} onChange={(v) => patch({ title: v })} max={titleMax} multiline rows={2} issue={issueFor("title")} />
            {draft.format !== "VIDEO" && (
              <Field
                label={t("adminNews.summary")}
                value={draft.summary}
                onChange={(v) => patch({ summary: v })}
                max={summaryMax}
                multiline
                rows={2}
                issue={issueFor("summary")}
                hint={draft.format === "SINGLE" ? t("adminNews.singleTooLongHint") : undefined}
              />
            )}

            {/* Foto / vídeo */}
            <div>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-subtle)", marginBottom: 5 }}>
                {draft.format === "VIDEO" ? t("adminNews.video") : t("adminNews.photo")}
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" style={btn()} onClick={() => fileRef.current?.click()}>
                  {draft.format === "VIDEO" ? <Video size={14} /> : <ImageIcon size={14} />}
                  {busy === "upload" ? t("adminNews.uploading") : (draft.format === "VIDEO" ? draft.videoUrl : draft.photoUrl) ? t("adminNews.replace") : t("adminNews.upload")}
                </button>
                {(draft.format === "VIDEO" ? draft.videoUrl : draft.photoUrl) && (
                  <button type="button" style={btn("danger")} onClick={() => void removeMedia()}>
                    <X size={14} />
                    {t("adminNews.remove")}
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept={draft.format === "VIDEO" ? "video/mp4,video/quicktime" : "image/jpeg,image/png,image/webp"}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void upload(f);
                  }}
                />
              </div>
              <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                {draft.format === "VIDEO" ? t("adminNews.videoHint") : t("adminNews.photoHint")}
              </span>
            </div>
          </div>

          {isCarousel && (
            <>
              {draft.content.slides.map((s, i) => (
                <div key={i} style={{ ...card, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                    <div style={{ ...sectionTitle, marginBottom: 0 }}>
                      {i + 2} · {s.kind === "highlight" ? t("adminNews.slideHighlight") : t("adminNews.slideContent")}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <IconBtn label={t("adminNews.moveUp")} disabled={i === 0} onClick={() => patchSlides((arr) => move(arr, i, i - 1))}>
                        <ArrowUp size={14} />
                      </IconBtn>
                      <IconBtn label={t("adminNews.moveDown")} disabled={i === draft.content.slides.length - 1} onClick={() => patchSlides((arr) => move(arr, i, i + 1))}>
                        <ArrowDown size={14} />
                      </IconBtn>
                      <IconBtn label={t("adminNews.removeSlide")} onClick={() => patchSlides((arr) => arr.filter((_, j) => j !== i))}>
                        <Trash2 size={14} />
                      </IconBtn>
                    </div>
                  </div>
                  <Field label={t("adminNews.eyebrow")} value={s.eyebrow} onChange={(v) => patchSlide(i, { eyebrow: v })} max={L.eyebrow} issue={issueFor(`slides.${i}.eyebrow`)} />
                  {s.kind === "content" ? (
                    <>
                      <Field label={t("adminNews.titleField")} value={s.title} onChange={(v) => patchSlide(i, { title: v })} max={L.contentTitle} multiline rows={2} issue={issueFor(`slides.${i}.title`)} />
                      <Field
                        label={t("adminNews.body")}
                        value={s.body}
                        onChange={(v) => patchSlide(i, { body: v })}
                        max={L.contentBody}
                        multiline
                        rows={5}
                        issue={issueFor(`slides.${i}.body`)}
                        hint={t("adminNews.bodyHint")}
                      />
                    </>
                  ) : (
                    <>
                      <Field label={t("adminNews.highlightLabel")} value={s.label} onChange={(v) => patchSlide(i, { label: v })} max={L.highlightLabel} issue={issueFor(`slides.${i}.label`)} placeholder="Subida na parada" />
                      <Field label={t("adminNews.highlightValue")} value={s.value} onChange={(v) => patchSlide(i, { value: v })} max={L.highlightValue} issue={issueFor(`slides.${i}.value`)} placeholder="+38" />
                      <Field label={t("adminNews.highlightCaption")} value={s.caption} onChange={(v) => patchSlide(i, { caption: v })} max={L.highlightCaption} issue={issueFor(`slides.${i}.caption`)} />
                      <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-subtle)", marginBottom: 6 }}>{t("adminNews.stats")}</span>
                      {s.stats.map((st, j) => (
                        <div key={j} style={{ display: "grid", gridTemplateColumns: "1fr 110px auto", gap: 8, alignItems: "start" }}>
                          <Field
                            label={t("adminNews.statLabel")}
                            value={st.label}
                            max={L.statLabel}
                            issue={issueFor(`slides.${i}.stats.${j}.label`)}
                            onChange={(v) => patchSlide(i, { stats: s.stats.map((x, k) => (k === j ? { ...x, label: v } : x)) })}
                          />
                          <Field
                            label={t("adminNews.statValue")}
                            value={st.value}
                            max={L.statValue}
                            issue={issueFor(`slides.${i}.stats.${j}.value`)}
                            onChange={(v) => patchSlide(i, { stats: s.stats.map((x, k) => (k === j ? { ...x, value: v } : x)) })}
                          />
                          <div style={{ paddingTop: 22 }}>
                            <IconBtn label={t("adminNews.remove")} onClick={() => patchSlide(i, { stats: s.stats.filter((_, k) => k !== j) })}>
                              <X size={14} />
                            </IconBtn>
                          </div>
                        </div>
                      ))}
                      {s.stats.length < L.maxStats && (
                        <button type="button" style={btn()} onClick={() => patchSlide(i, { stats: [...s.stats, { label: "", value: "" }] })}>
                          <Plus size={14} />
                          {t("adminNews.addStat")}
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}

              {draft.content.slides.length < L.maxMiddleSlides && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <button type="button" style={btn()} onClick={() => patchSlides((arr) => [...arr, emptyContentSlide()])}>
                    <Plus size={14} />
                    {t("adminNews.addContent")}
                  </button>
                  <button type="button" style={btn()} onClick={() => patchSlides((arr) => [...arr, emptyHighlightSlide()])}>
                    <Plus size={14} />
                    {t("adminNews.addHighlight")}
                  </button>
                </div>
              )}

              <div style={{ ...card, marginBottom: 16 }}>
                <div style={sectionTitle}>
                  {draft.content.slides.length + 2} · {t("adminNews.slideClosing")}
                </div>
                <Field
                  label={t("adminNews.eyebrow")}
                  value={draft.content.closing.eyebrow}
                  max={L.eyebrow}
                  issue={issueFor("closing.eyebrow")}
                  onChange={(v) => patch({ content: { ...draft.content, closing: { ...draft.content.closing, eyebrow: v } } })}
                />
                <Field
                  label={t("adminNews.titleField")}
                  value={draft.content.closing.title}
                  max={L.closingTitle}
                  issue={issueFor("closing.title")}
                  onChange={(v) => patch({ content: { ...draft.content, closing: { ...draft.content.closing, title: v } } })}
                />
                <Field
                  label={t("adminNews.closingText")}
                  value={draft.content.closing.text}
                  max={L.closingText}
                  multiline
                  rows={2}
                  issue={issueFor("closing.text")}
                  onChange={(v) => patch({ content: { ...draft.content, closing: { ...draft.content.closing, text: v } } })}
                />
                <Field
                  label={t("adminNews.cta")}
                  value={draft.content.closing.cta}
                  max={L.cta}
                  issue={issueFor("closing.cta")}
                  onChange={(v) => patch({ content: { ...draft.content, closing: { ...draft.content.closing, cta: v } } })}
                />
              </div>
            </>
          )}

          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ ...sectionTitle, marginBottom: 0 }}>{t("adminNews.caption")}</div>
              <button type="button" style={{ ...btn(), padding: "5px 10px", fontSize: 12 }} onClick={() => patch({ caption: suggestNewsCaption(draft) })}>
                <Sparkles size={13} />
                {t("adminNews.suggestCaption")}
              </button>
            </div>
            <Field label="" value={draft.caption} onChange={(v) => patch({ caption: v })} max={L.caption} multiline rows={6} issue={issueFor("caption")} hint={t("adminNews.captionHint")} />
          </div>
        </fieldset>

        {/* Prévia + ações */}
        <div style={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : undefined, position: isMobile ? "static" : "sticky", top: 80 }}>
          <div style={{ ...card, marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {!locked && (
              <>
                <button type="button" style={btn()} onClick={() => void save()} disabled={busy !== null || !dirty}>
                  <Save size={14} />
                  {busy === "save" ? t("adminNews.saving") : dirty ? t("adminNews.save") : t("adminNews.saved")}
                </button>
                <button type="button" style={btn("dark")} onClick={() => void generate()} disabled={busy !== null}>
                  <LayoutGrid size={14} />
                  {busy === "generate" ? t("adminNews.generating") : t("adminNews.generate")}
                </button>
              </>
            )}
            <button type="button" style={btn()} onClick={() => void download()} disabled={busy !== null || !renderedFresh}>
              <Download size={14} />
              {t("adminNews.download")}
            </button>
            {!locked && (
              <button type="button" style={btn("primary")} onClick={() => void publish()} disabled={busy !== null || !renderedFresh}>
                <Send size={14} />
                {busy === "publish" ? t("adminNews.publishing") : t("adminNews.publish")}
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" style={btn()} onClick={() => void duplicate()} disabled={busy !== null}>
              <Copy size={14} />
              {t("adminNews.duplicate")}
            </button>
            {draft.status !== "PUBLISHING" && (
              <button type="button" style={btn("danger")} onClick={() => void remove()} disabled={busy !== null}>
                <Trash2 size={14} />
                {t("adminNews.delete")}
              </button>
            )}
            <div style={{ width: "100%", fontSize: 12, color: "var(--text-muted)" }}>
              {renderedFresh ? t("adminNews.renderedAt", { date: fmt(saved!.renderedAt) }) : !locked ? t("adminNews.notRendered") : null}
            </div>
          </div>

          {showIssues && issues.length > 0 && <IssueList issues={issues} />}

          <div style={sectionTitle}>{t("adminNews.preview")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
            {kinds.map((k, i) => (
              <div key={i}>
                <NewsPostArtPreview post={draft} index={i} width={previewWidth} />
                {isCarousel && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-subtle)", fontWeight: 600 }}>
                    {i + 1} · {t(`adminNews.slide${k[0].toUpperCase()}${k.slice(1)}`)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {renderedFresh && (
            <>
              <div style={sectionTitle}>{t("adminNews.renderedArt")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
                {saved!.renderedVideo ? (
                  <video src={saved!.renderedVideo} controls playsInline style={{ width: previewWidth, aspectRatio: "3 / 4", borderRadius: 6, background: "#000" }} />
                ) : (
                  saved!.renderedImages.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt="" style={{ width: isCarousel ? 160 : previewWidth, aspectRatio: "3 / 4", borderRadius: 6, border: "1px solid var(--divider-strong)" }} />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function pickEditable(d: NewsPostDTO): Partial<NewsPostDTO> {
  return { theme: d.theme, eyebrow: d.eyebrow, title: d.title, summary: d.summary, newsDate: d.newsDate, content: d.content, caption: d.caption };
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const out = [...arr];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

function FormatIcon({ format }: { format: NewsPostFormatValue }) {
  const color = "var(--accent)";
  if (format === "VIDEO") return <Video size={16} color={color} />;
  if (format === "CAROUSEL") return <LayoutGrid size={16} color={color} />;
  return <ImageIcon size={16} color={color} />;
}

function IconBtn({ children, label, onClick, disabled }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{ ...btn(), padding: 6, opacity: disabled ? 0.4 : 1 }}
    >
      {children}
    </button>
  );
}

function Banner({ kind, children }: { kind: "ok" | "error"; children: ReactNode }) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      style={{
        marginBottom: 16,
        padding: "10px 14px",
        borderRadius: 12,
        fontSize: 13,
        lineHeight: 1.45,
        background: kind === "error" ? "var(--down-bg)" : "var(--up-bg)",
        color: kind === "error" ? "var(--down-fg)" : "var(--up-fg)",
      }}
    >
      {children}
    </div>
  );
}

function IssueList({ issues }: { issues: NewsValidationIssue[] }) {
  const { t } = useTranslations();
  return (
    <div style={{ ...card, marginBottom: 16, borderColor: "var(--accent)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{t("adminNews.issuesTitle")}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-subtle)", lineHeight: 1.6 }}>
        {issues.map((i) => (
          <li key={`${i.field}-${i.code}`}>
            <code>{i.field}</code> — {t(`adminNews.issue_${i.code}`, { max: i.max ?? 0 })}
          </li>
        ))}
      </ul>
    </div>
  );
}
