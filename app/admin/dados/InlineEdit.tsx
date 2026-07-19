"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { SourceConflict } from "@/lib/edicao-de-dados-source-fetch";
import { SourceConflictMergeModal } from "./SourceConflictMergeModal";

type Kind = "music" | "albums" | "artists";

type InlineError = Error & { conflict?: SourceConflict };

async function patchInline(kind: Kind, id: string | number, field: string, value: unknown) {
  const res = await fetch("/api/admin/edicao-de-dados/inline", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, id, field, value }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; conflict?: SourceConflict };
    const err = new Error(data.error ?? "update_failed") as InlineError;
    if (data.conflict) err.conflict = data.conflict;
    throw err;
  }
}

function errorLabel(err: unknown): string {
  const code = err instanceof Error ? err.message : "";
  if (code === "title_required" || code === "name_required") return "não pode ficar vazio";
  if (code === "conflict") return "conflito: já existe outro registro com esse valor";
  return "erro ao salvar";
}

const baseInputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "4px 6px",
  margin: "-4px -6px",
  borderRadius: 6,
  border: "1px solid transparent",
  background: "transparent",
  color: "inherit",
  font: "inherit",
};

const statusStyle: CSSProperties = { fontSize: 11, marginTop: 2 };

/**
 * Campo de texto editável in-place: parece texto, vira input ao focar e
 * salva ao sair (blur). Esc cancela, Enter confirma.
 */
export function InlineField({
  kind,
  id,
  field,
  value,
  required,
  mono,
  bold,
  placeholder = "—",
}: {
  kind: Kind;
  id: string | number;
  field: string;
  value: string | null;
  required?: boolean;
  mono?: boolean;
  bold?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(value ?? "");
  const [saved, setSaved] = useState(value ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [conflict, setConflict] = useState<SourceConflict | null>(null);
  const [showMerge, setShowMerge] = useState(false);
  const escapedRef = useRef(false);

  // quando a busca devolve novas linhas, ressincroniza com o servidor
  useEffect(() => {
    setText(value ?? "");
    setSaved(value ?? "");
    setStatus("idle");
  }, [value]);

  async function commit() {
    if (escapedRef.current) {
      escapedRef.current = false;
      setText(saved);
      return;
    }
    const next = text.trim();
    if (next === saved.trim()) {
      setText(saved);
      return;
    }
    if (required && !next) {
      setText(saved);
      setStatus("error");
      setErrorMsg("não pode ficar vazio");
      return;
    }
    setStatus("saving");
    try {
      await patchInline(kind, id, field, next);
      setSaved(next);
      setText(next);
      setStatus("idle");
      setConflict(null);
      setShowMerge(false);
    } catch (err) {
      setText(saved);
      setStatus("error");
      setErrorMsg(errorLabel(err));
      const nextConflict = err instanceof Error ? (err as InlineError).conflict : undefined;
      if (nextConflict) {
        setConflict(nextConflict);
        setShowMerge(true);
      }
    }
  }

  return (
    <span style={{ display: "block", minWidth: 0 }}>
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          if (status === "error") setStatus("idle");
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            escapedRef.current = true;
            e.currentTarget.blur();
          }
        }}
        onFocus={(e) => {
          e.currentTarget.style.border = "1px solid var(--divider-strong)";
          e.currentTarget.style.background = "var(--surface)";
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.border = "1px solid transparent";
          e.currentTarget.style.background = "transparent";
        }}
        title="Clique para editar — salva ao sair do campo"
        style={{
          ...baseInputStyle,
          ...(mono ? { fontFamily: "monospace", fontSize: 12 } : null),
          ...(bold ? { fontWeight: 650 } : null),
        }}
      />
      {status === "saving" && <span style={{ ...statusStyle, color: "var(--text-muted)", display: "block" }}>salvando…</span>}
      {status === "error" && (
        <span style={{ ...statusStyle, color: "#C41E3A", display: "block" }}>
          {errorMsg}
          {conflict && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setShowMerge(true)}
                style={{
                  border: "none",
                  background: "none",
                  padding: 0,
                  color: "#FA243C",
                  fontWeight: 800,
                  fontSize: 11,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                abrir merge
              </button>
            </>
          )}
        </span>
      )}
      {showMerge && conflict && (
        <SourceConflictMergeModal
          conflict={conflict}
          onClose={() => setShowMerge(false)}
          onMerged={() => {
            setStatus("idle");
            setConflict(null);
            setShowMerge(false);
          }}
        />
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Data editável in-place
// ---------------------------------------------------------------------------

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toInputValue(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

function formatBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function isJan1(d: Date): boolean {
  return d.getUTCMonth() === 0 && d.getUTCDate() === 1;
}

/** Data só para visualização (sem clique/edição). */
export function ReadonlyDate({
  value,
  empty = "—",
  tag,
  title,
}: {
  value: Date | string | null | undefined;
  empty?: string;
  tag?: string | null;
  title?: string;
}) {
  const d = toDateOrNull(value);
  if (!d) {
    return <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>{empty}</span>;
  }
  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        fontSize: 13,
        fontVariantNumeric: "tabular-nums",
        color: "var(--text)",
        whiteSpace: "nowrap",
      }}
    >
      {formatBR(d)}
      {tag ? (
        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>{tag}</span>
      ) : null}
    </span>
  );
}

/**
 * Data editável in-place: mostra a data formatada (ou "falta"); clique abre
 * um seletor de data e salva ao sair do campo. Limpar o campo remove a data.
 */
export function InlineDate({
  kind,
  id,
  field,
  value,
  fallback,
  fallbackTag,
}: {
  kind: Kind;
  id: string | number;
  field: string;
  value: Date | string | null;
  /** Data exibida (cinza) quando não há valor próprio — ex.: data do YouTube. */
  fallback?: Date | string | null;
  fallbackTag?: string;
}) {
  const [current, setCurrent] = useState<Date | null>(() => toDateOrNull(value));
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const escapedRef = useRef(false);

  useEffect(() => {
    setCurrent(toDateOrNull(value));
    setStatus("idle");
  }, [value]);

  async function commit() {
    setEditing(false);
    if (escapedRef.current) {
      escapedRef.current = false;
      return;
    }
    if (text === toInputValue(current)) return;
    setStatus("saving");
    try {
      await patchInline(kind, id, field, text);
      setCurrent(text ? new Date(`${text}T00:00:00.000Z`) : null);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="date"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            escapedRef.current = true;
            e.currentTarget.blur();
          }
        }}
        style={{
          padding: "3px 6px",
          borderRadius: 6,
          border: "1px solid var(--divider-strong)",
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: 12,
          maxWidth: 140,
        }}
      />
    );
  }

  const fb = toDateOrNull(fallback ?? null);
  const shown = current ?? fb;
  const suspect = shown ? isJan1(shown) : false;

  return (
    <span
      role="button"
      tabIndex={0}
      title="Clique para editar a data — salva ao sair do campo"
      onClick={() => {
        setText(toInputValue(current ?? fb));
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setText(toInputValue(current ?? fb));
          setEditing(true);
        }
      }}
      style={{ display: "inline-block", cursor: "text", whiteSpace: "nowrap" }}
    >
      {shown ? (
        <span
          title={suspect ? "Data 01/01 — pode indicar que a fonte só tinha o ano" : undefined}
          style={{
            fontSize: 13,
            fontVariantNumeric: "tabular-nums",
            ...(suspect
              ? { color: "#B45309", fontWeight: 700 }
              : { color: current ? "var(--text)" : "var(--text-muted)" }),
          }}
        >
          {formatBR(shown)}
          {suspect ? " ⚠️" : ""}
          {!current && fb && fallbackTag ? (
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>{fallbackTag}</span>
          ) : null}
        </span>
      ) : (
        <span
          style={{
            display: "inline-block",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-disabled)",
            border: "1.5px dashed var(--divider-strong)",
            borderRadius: 8,
            padding: "4px 9px",
          }}
        >
          dd/mm/aaaa
        </span>
      )}
      {status === "saving" && <span style={{ ...statusStyle, color: "var(--text-muted)", display: "block" }}>salvando…</span>}
      {status === "error" && <span style={{ ...statusStyle, color: "#C41E3A", display: "block" }}>erro ao salvar</span>}
    </span>
  );
}

/**
 * Lista de tags editável in-place: mostra o conteúdo renderizado (badges),
 * clique para editar como texto separado por vírgula, salva ao sair.
 */
export function InlineTags({
  kind,
  id,
  field,
  tags,
  render,
}: {
  kind: Kind;
  id: string | number;
  field: string;
  tags: string[];
  render: (tags: string[]) => ReactNode;
}) {
  const [current, setCurrent] = useState(tags);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const escapedRef = useRef(false);

  useEffect(() => {
    setCurrent(tags);
    setStatus("idle");
  }, [tags]);

  async function commit() {
    setEditing(false);
    if (escapedRef.current) {
      escapedRef.current = false;
      return;
    }
    const next = text
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (next.join(" ") === current.join(" ")) return;
    setStatus("saving");
    try {
      await patchInline(kind, id, field, next);
      setCurrent(next);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            escapedRef.current = true;
            e.currentTarget.blur();
          }
        }}
        placeholder="tags separadas por vírgula"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "4px 6px",
          borderRadius: 6,
          border: "1px solid var(--divider-strong)",
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: 12,
        }}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      title="Clique para editar as tags (separadas por vírgula) — salva ao sair"
      onClick={() => {
        setText(current.join(", "));
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setText(current.join(", "));
          setEditing(true);
        }
      }}
      style={{ display: "block", cursor: "text", minWidth: 0 }}
    >
      {render(current)}
      {status === "saving" && <span style={{ ...statusStyle, color: "var(--text-muted)", display: "block" }}>salvando…</span>}
      {status === "error" && <span style={{ ...statusStyle, color: "#C41E3A", display: "block" }}>erro ao salvar</span>}
    </span>
  );
}
