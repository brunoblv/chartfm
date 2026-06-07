"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { scoreColor, scoreBg, scoreLabel } from "@/lib/album-score";

export function AlbumQuickRating({ albumId }: { albumId: number }) {
  const { data: session, status } = useSession();
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      setLoading(false);
      return;
    }
    fetch(`/api/albums/${albumId}/rating`)
      .then((r) => r.json())
      .then((d: { rating: number | null }) => {
        if (d.rating != null) {
          setValue(String(d.rating));
          setSaved(d.rating);
        }
      })
      .finally(() => setLoading(false));
  }, [albumId, session, status]);

  const parsed =
    value.trim() !== "" && !isNaN(parseInt(value, 10))
      ? Math.min(100, Math.max(0, parseInt(value, 10)))
      : null;

  const save = async () => {
    if (!session?.user) return;
    if (value.trim() === "" || parsed === null) {
      if (value.trim() !== "") setError("Digite uma nota de 0 a 100");
      return;
    }
    if (saved === parsed) {
      setError("");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/albums/${albumId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: parsed }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Erro ao salvar");
        return;
      }
      setSaved(parsed);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div
        style={{
          width: 56,
          height: 44,
          borderRadius: 10,
          background: "var(--fill-inset)",
          margin: "0 auto",
        }}
      />
    );
  }

  if (!session?.user) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
          Entre
        </Link>{" "}
        para avaliar
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 6,
        }}
      >
        Sua nota
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <input
          type="number"
          min={0}
          max={100}
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="—"
          disabled={saving}
          aria-label="Sua nota para este álbum"
          style={{
            width: 56,
            height: 44,
            borderRadius: 10,
            border: `2px solid ${parsed != null ? `${scoreColor(parsed)}40` : "var(--divider)"}`,
            background: parsed != null ? scoreBg(parsed) : "var(--fill-inset)",
            color: parsed != null ? scoreColor(parsed) : "var(--text)",
            fontSize: 20,
            fontWeight: 800,
            textAlign: "center",
            outline: "none",
            fontVariantNumeric: "tabular-nums",
            MozAppearance: "textfield",
          }}
        />
      </div>
      {parsed != null && (
        <div style={{ fontSize: 11, fontWeight: 600, color: scoreColor(parsed), marginTop: 4 }}>
          {scoreLabel(parsed)}
        </div>
      )}
      {error && (
        <div style={{ fontSize: 11, color: "#C5291C", marginTop: 4 }}>{error}</div>
      )}
      {justSaved && (
        <div style={{ fontSize: 11, color: "#1B873F", marginTop: 4, fontWeight: 600 }}>Salva ✓</div>
      )}
      <Link
        href={`/criticsfm/${albumId}`}
        style={{
          display: "inline-block",
          marginTop: 8,
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textDecoration: "none",
        }}
      >
        Escrever review →
      </Link>
    </div>
  );
}
