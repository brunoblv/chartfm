"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import {
  EDITORIAL_CATEGORY_LABELS,
  type EditorialPickCategory,
} from "@/lib/editorial-picks-data";
import { slugifyEditorialTitle } from "@/lib/editorial-picks";

type RelatedLink = { label: string; href: string };

type AdminPost = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  category: EditorialPickCategory;
  publishedAt: string;
  author: string;
  excerpt: string;
  paragraphs: string[];
  youtubeUrl?: string;
  spotifyUrl?: string;
  previewImage?: string;
  tags?: string[];
  relatedLinks?: RelatedLink[];
  published: boolean;
};

type FormState = {
  slug: string;
  title: string;
  subtitle: string;
  category: EditorialPickCategory;
  publishedAt: string;
  author: string;
  excerpt: string;
  paragraphsText: string;
  youtubeUrl: string;
  spotifyUrl: string;
  previewImage: string;
  tagsText: string;
  relatedLinks: RelatedLink[];
  published: boolean;
};

const CATEGORIES = Object.keys(EDITORIAL_CATEGORY_LABELS) as EditorialPickCategory[];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  return {
    slug: "",
    title: "",
    subtitle: "",
    category: "editorial",
    publishedAt: todayIso(),
    author: "Equipe ChartFM",
    excerpt: "",
    paragraphsText: "",
    youtubeUrl: "",
    spotifyUrl: "",
    previewImage: "",
    tagsText: "",
    relatedLinks: [],
    published: true,
  };
}

function postToForm(post: AdminPost): FormState {
  return {
    slug: post.slug,
    title: post.title,
    subtitle: post.subtitle ?? "",
    category: post.category,
    publishedAt: post.publishedAt,
    author: post.author,
    excerpt: post.excerpt,
    paragraphsText: post.paragraphs.join("\n\n"),
    youtubeUrl: post.youtubeUrl ?? "",
    spotifyUrl: post.spotifyUrl ?? "",
    previewImage: post.previewImage ?? "",
    tagsText: (post.tags ?? []).join(", "),
    relatedLinks: post.relatedLinks ?? [],
    published: post.published,
  };
}

function formToPayload(form: FormState) {
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    category: form.category,
    publishedAt: form.publishedAt,
    author: form.author.trim(),
    excerpt: form.excerpt.trim(),
    paragraphs: form.paragraphsText
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean),
    youtubeUrl: form.youtubeUrl.trim() || null,
    spotifyUrl: form.spotifyUrl.trim() || null,
    previewImage: form.previewImage.trim() || null,
    tags: form.tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    relatedLinks: form.relatedLinks.filter((l) => l.label.trim() && l.href.trim()),
    published: form.published,
  };
}

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function EditorialAdminClient() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [slugTouched, setSlugTouched] = useState(false);

  const selectedPost = useMemo(
    () => (selectedId && selectedId !== "new" ? posts.find((p) => p.id === selectedId) : null),
    [posts, selectedId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/editorial");
      if (!res.ok) throw new Error("Falha ao carregar");
      const data = (await res.json()) as { posts: AdminPost[] };
      setPosts(data.posts);
    } catch {
      setError("Não foi possível carregar os artigos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startCreate() {
    setSelectedId("new");
    setForm(emptyForm());
    setSlugTouched(false);
    setMessage(null);
    setError(null);
  }

  function startEdit(post: AdminPost) {
    setSelectedId(post.id);
    setForm(postToForm(post));
    setSlugTouched(true);
    setMessage(null);
    setError(null);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "title" && !slugTouched && selectedId === "new") {
        next.slug = slugifyEditorialTitle(String(value));
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = formToPayload(form);
      const isNew = selectedId === "new";
      const url = isNew ? "/api/admin/editorial" : `/api/admin/editorial/${selectedId}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; post?: AdminPost };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar.");
        return;
      }
      setMessage(isNew ? "Artigo criado." : "Artigo atualizado.");
      await load();
      if (data.post) {
        setSelectedId(data.post.id);
        setForm(postToForm(data.post));
        setSlugTouched(true);
      }
    } catch {
      setError("Erro de conexão ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selectedPost || !window.confirm(`Excluir "${selectedPost.title}"?`)) return;
    setDeleting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/editorial/${selectedPost.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível excluir.");
        return;
      }
      setMessage("Artigo excluído.");
      setSelectedId(null);
      setForm(emptyForm());
      await load();
    } catch {
      setError("Erro de conexão ao excluir.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ marginTop: 20, display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 14, maxWidth: 560 }}>
          Gerencie os artigos públicos em <strong>/editorial</strong>. Links do YouTube e Spotify geram preview
          automática na listagem.
        </p>
        <button type="button" onClick={startCreate} style={primaryButtonStyle(false)}>
          <Plus size={16} />
          Novo artigo
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Carregando…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", gap: 20, alignItems: "start" }}>
          <div style={panelStyle}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Artigos ({posts.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {posts.map((post) => {
                const active = selectedId === post.id;
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => startEdit(post)}
                    style={listItemStyle(active)}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textAlign: "left" }}>
                        {post.title}
                      </span>
                      {!post.published && (
                        <span style={draftBadgeStyle}>Rascunho</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, textAlign: "left" }}>
                      {EDITORIAL_CATEGORY_LABELS[post.category]} · {formatDate(post.publishedAt)}
                    </div>
                  </button>
                );
              })}
              {!posts.length && (
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                  Nenhum artigo ainda. Os posts iniciais são importados automaticamente na primeira carga.
                </p>
              )}
            </div>
          </div>

          {selectedId ? (
            <div style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>
                  {selectedId === "new" ? "Novo artigo" : "Editar artigo"}
                </h2>
                {selectedPost && (
                  <Link
                    href={`/editorial/${selectedPost.slug}`}
                    target="_blank"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}
                  >
                    Ver público
                    <ExternalLink size={14} />
                  </Link>
                )}
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                <Field label="Título">
                  <input value={form.title} onChange={(e) => updateForm("title", e.target.value)} style={inputStyle} />
                </Field>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12 }}>
                  <Field label="Slug (URL)">
                    <input
                      value={form.slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        updateForm("slug", e.target.value);
                      }}
                      placeholder="meu-artigo"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Categoria">
                    <select
                      value={form.category}
                      onChange={(e) => updateForm("category", e.target.value as EditorialPickCategory)}
                      style={inputStyle}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {EDITORIAL_CATEGORY_LABELS[cat]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Subtítulo (opcional)">
                  <input value={form.subtitle} onChange={(e) => updateForm("subtitle", e.target.value)} style={inputStyle} />
                </Field>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Data de publicação">
                    <input
                      type="date"
                      value={form.publishedAt}
                      onChange={(e) => updateForm("publishedAt", e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Autor">
                    <input value={form.author} onChange={(e) => updateForm("author", e.target.value)} style={inputStyle} />
                  </Field>
                </div>

                <Field label="Resumo (aparece na prévia)">
                  <textarea
                    value={form.excerpt}
                    onChange={(e) => updateForm("excerpt", e.target.value)}
                    rows={3}
                    style={textareaStyle}
                  />
                </Field>

                <Field label="Parágrafos (separe com linha em branco)">
                  <textarea
                    value={form.paragraphsText}
                    onChange={(e) => updateForm("paragraphsText", e.target.value)}
                    rows={12}
                    placeholder={"Primeiro parágrafo…\n\nSegundo parágrafo…"}
                    style={textareaStyle}
                  />
                </Field>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="YouTube (URL do vídeo)">
                    <input
                      value={form.youtubeUrl}
                      onChange={(e) => updateForm("youtubeUrl", e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=…"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Spotify (faixa, álbum ou playlist)">
                    <input
                      value={form.spotifyUrl}
                      onChange={(e) => updateForm("spotifyUrl", e.target.value)}
                      placeholder="https://open.spotify.com/…"
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <Field label="Imagem de preview (opcional — sobrescreve YouTube/Spotify)">
                  <input
                    value={form.previewImage}
                    onChange={(e) => updateForm("previewImage", e.target.value)}
                    placeholder="https://…"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Tags (separadas por vírgula)">
                  <input
                    value={form.tagsText}
                    onChange={(e) => updateForm("tagsText", e.target.value)}
                    placeholder="Global 100, Spotify, clipe"
                    style={inputStyle}
                  />
                </Field>

                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <label style={labelStyle}>Links relacionados</label>
                    <button
                      type="button"
                      onClick={() =>
                        updateForm("relatedLinks", [...form.relatedLinks, { label: "", href: "" }])
                      }
                      style={ghostButtonStyle}
                    >
                      <Plus size={14} />
                      Adicionar link
                    </button>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {form.relatedLinks.map((link, idx) => (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                        <input
                          value={link.label}
                          onChange={(e) => {
                            const next = [...form.relatedLinks];
                            next[idx] = { ...next[idx], label: e.target.value };
                            updateForm("relatedLinks", next);
                          }}
                          placeholder="Rótulo"
                          style={inputStyle}
                        />
                        <input
                          value={link.href}
                          onChange={(e) => {
                            const next = [...form.relatedLinks];
                            next[idx] = { ...next[idx], href: e.target.value };
                            updateForm("relatedLinks", next);
                          }}
                          placeholder="/global/100 ou URL"
                          style={inputStyle}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateForm(
                              "relatedLinks",
                              form.relatedLinks.filter((_, i) => i !== idx),
                            )
                          }
                          style={iconButtonStyle}
                          aria-label="Remover link"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text)" }}>
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => updateForm("published", e.target.checked)}
                  />
                  Publicado (visível em /editorial)
                </label>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" onClick={save} disabled={saving} style={primaryButtonStyle(saving)}>
                    {saving ? "Salvando…" : selectedId === "new" ? "Criar artigo" : "Salvar alterações"}
                  </button>
                  {selectedPost && (
                    <button type="button" onClick={remove} disabled={deleting} style={dangerButtonStyle(deleting)}>
                      {deleting ? "Excluindo…" : "Excluir"}
                    </button>
                  )}
                  <button type="button" onClick={() => setSelectedId(null)} style={ghostButtonStyle}>
                    Fechar
                  </button>
                  {message && <span style={{ color: "#0F9D58", fontSize: 13 }}>{message}</span>}
                  {error && <span style={{ color: "#C5291C", fontSize: 13 }}>{error}</span>}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ ...panelStyle, color: "var(--text-muted)", fontSize: 14 }}>
              Selecione um artigo na lista ou clique em <strong>Novo artigo</strong>.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-muted)",
  letterSpacing: "0.03em",
};

const panelStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--divider)",
  borderRadius: 16,
  padding: 18,
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid var(--divider-strong)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  background: "var(--bg)",
  color: "var(--text)",
  outline: "none",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  lineHeight: 1.6,
  fontFamily: "inherit",
};

const listItemStyle = (active: boolean): CSSProperties => ({
  border: active ? "1px solid var(--accent)" : "1px solid var(--divider)",
  background: active ? "var(--accent-tint)" : "var(--bg)",
  borderRadius: 12,
  padding: "12px 14px",
  cursor: "pointer",
  textAlign: "left",
});

const draftBadgeStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
  background: "var(--fill-subtle)",
  borderRadius: 100,
  padding: "3px 8px",
  flexShrink: 0,
};

const primaryButtonStyle = (disabled: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: 14,
  opacity: disabled ? 0.55 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
});

const dangerButtonStyle = (disabled: boolean): CSSProperties => ({
  border: "1px solid #C5291C",
  background: "transparent",
  color: "#C5291C",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: 14,
  opacity: disabled ? 0.55 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
});

const ghostButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "1px solid var(--divider)",
  background: "transparent",
  color: "var(--text-muted)",
  borderRadius: 10,
  padding: "8px 12px",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const iconButtonStyle: CSSProperties = {
  border: "1px solid var(--divider)",
  background: "var(--bg)",
  color: "var(--text-muted)",
  borderRadius: 10,
  width: 40,
  height: 40,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};
