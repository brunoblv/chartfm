"use client";

import { useRef, useState } from "react";

const SIZE_OPTIONS = [10, 15, 20, 25, 30];

type ParadaEditPanelProps = {
  paradaId: string;
  initialName: string;
  initialChartSize: number | null;
  initialCadence: "weekly" | "daily";
  isPrimary: boolean;
  onClose: () => void;
  onSaved: (data: {
    name: string;
    chartSize: number | null;
    cadence: "weekly" | "daily";
    logo?: string | null;
  }) => void;
};

export function ParadaEditPanel({
  paradaId,
  initialName,
  initialChartSize,
  initialCadence,
  isPrimary,
  onClose,
  onSaved,
}: ParadaEditPanelProps) {
  const [name, setName] = useState(initialName);
  const [chartSize, setChartSize] = useState<number | null>(initialChartSize);
  const [cadence, setCadence] = useState<"weekly" | "daily">(initialCadence);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Nome muito curto.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/paradas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paradaId,
          name: trimmed,
          chartSize,
          cadence: isPrimary ? "weekly" : cadence,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Erro ao salvar.");
        return;
      }
      onSaved({
        name: trimmed,
        chartSize,
        cadence: isPrimary ? "weekly" : cadence,
      });
      onClose();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/user/chart-logo?paradaId=${encodeURIComponent(paradaId)}`,
        { method: "POST", body: form },
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Erro ao enviar logo.");
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) onSaved({ name, chartSize, cadence, logo: data.url });
    } catch {
      setError("Erro ao enviar logo.");
    } finally {
      setUploading(false);
    }
  };

  const optionBtn = (active: boolean) =>
    ({
      padding: "8px 14px",
      borderRadius: 100,
      border: active ? "1.5px solid var(--accent)" : "1.5px solid var(--divider-strong)",
      background: active ? "var(--accent-tint)" : "var(--surface)",
      color: active ? "var(--accent)" : "var(--text)",
      fontSize: 13,
      fontWeight: active ? 700 : 600,
      cursor: "pointer",
      fontFamily: "inherit",
    }) as const;

  return (
    <div
      style={{
        margin: "0 0 24px",
        padding: "24px",
        background: "var(--surface)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 22,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text)",
          }}
        >
          Configurações da parada
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "none",
            background: "var(--fill-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--text-muted)",
          }}
          aria-label="Fechar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ gridColumn: "1 / -1" }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            Nome da parada
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da sua parada"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1.5px solid var(--divider-strong)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: 15,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            Tamanho do chart
          </label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SIZE_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setChartSize(s)}
                style={optionBtn(chartSize === s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            Cadência
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["weekly", "daily"] as const).map((c) => (
              <button
                key={c}
                type="button"
                disabled={isPrimary && c === "daily"}
                onClick={() => setCadence(c)}
                style={{
                  ...optionBtn(cadence === c),
                  opacity: isPrimary && c === "daily" ? 0.4 : 1,
                  cursor: isPrimary && c === "daily" ? "not-allowed" : "pointer",
                }}
              >
                {c === "weekly" ? "Semanal" : "Diária"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            Logo da parada
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadLogo(file);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            style={{
              width: "100%",
              border: "1.5px dashed var(--divider-strong)",
              borderRadius: 12,
              padding: "24px 16px",
              textAlign: "center",
              background: "var(--fill-subtle)",
              cursor: uploading ? "wait" : "pointer",
              fontFamily: "inherit",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>🖼</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
              {uploading ? "Enviando…" : "Arraste uma imagem ou clique para escolher"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, opacity: 0.7 }}>
              PNG, JPG, WebP · máx. 5 MB · 1:1 recomendado
            </div>
          </button>
        </div>
      </div>

      {error && (
        <p style={{ color: "#FA243C", fontSize: 13, marginBottom: 12 }}>{error}</p>
      )}

      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
          paddingTop: 4,
          borderTop: "1px solid var(--divider)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "10px 22px",
            borderRadius: 100,
            border: "1px solid var(--divider-strong)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          style={{
            padding: "10px 26px",
            borderRadius: 100,
            background: "var(--accent)",
            color: "white",
            border: "none",
            fontSize: 14,
            fontWeight: 700,
            cursor: saving ? "wait" : "pointer",
            fontFamily: "inherit",
            boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}
