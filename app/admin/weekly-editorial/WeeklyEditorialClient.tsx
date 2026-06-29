"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

type Props = {
  weekIndex: number;
  weekLabel: string;
  initialBody: string;
};

export function WeeklyEditorialClient({ weekIndex, weekLabel, initialBody }: Props) {
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/weekly-editorial", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekIndex, body: body.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar.");
        return;
      }
      setMessage("Editorial salvo com sucesso.");
    } catch {
      setError("Erro de conexão ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
      <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 14 }}>
        Semana <strong>{weekLabel}</strong> (índice {weekIndex}). Este texto aparece na landing para visitantes não
        autenticados.
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        placeholder="Parágrafo editorial sobre a parada da semana…"
        style={textareaStyle}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={submit} disabled={saving || !body.trim()} style={buttonStyle(saving || !body.trim())}>
          {saving ? "Salvando..." : "Salvar editorial"}
        </button>
        {message && <span style={{ color: "#0F9D58", fontSize: 13 }}>{message}</span>}
        {error && <span style={{ color: "#C5291C", fontSize: 13 }}>{error}</span>}
      </div>
    </div>
  );
}

const textareaStyle: CSSProperties = {
  border: "1px solid var(--divider-strong)",
  borderRadius: 12,
  padding: "14px 16px",
  fontSize: 15,
  lineHeight: 1.6,
  resize: "vertical",
  background: "var(--surface)",
  color: "var(--text)",
  outline: "none",
};

const buttonStyle = (disabled: boolean): CSSProperties => ({
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  opacity: disabled ? 0.55 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
});
