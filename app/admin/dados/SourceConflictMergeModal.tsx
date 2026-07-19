"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { SourceConflict, SourceConflictEntity } from "@/lib/edicao-de-dados-source-fetch";

type Props = {
  conflict: SourceConflict;
  onClose: () => void;
  onMerged?: (keptId: string) => void;
};

/**
 * Modal de merge quando SPT (ou outra fonte) encontra ID/unicidade já usada.
 * Mostra a faixa atual e a duplicata (capa, título, artista) e deixa escolher qual manter.
 */
export function SourceConflictMergeModal({ conflict, onClose, onMerged }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"current" | "other" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function merge(keep: SourceConflictEntity, drop: SourceConflictEntity, which: "current" | "other") {
    if (busy) return;
    setBusy(which);
    setError(null);
    try {
      const res = await fetch("/api/admin/edicao-de-dados/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: conflict.kind,
          keepId: conflict.kind === "music" ? keep.id : Number(keep.id),
          dropId: conflict.kind === "music" ? drop.id : Number(drop.id),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; keepId?: string | number };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Falha ao fazer merge");
        setBusy(null);
        return;
      }
      onMerged?.(String(data.keepId ?? keep.id));
      onClose();
      router.refresh();
    } catch {
      setError("Erro de rede");
      setBusy(null);
    }
  }

  const entityLabel =
    conflict.kind === "music" ? "música" : conflict.kind === "albums" ? "álbum" : "artista";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-conflict-title"
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div style={panelStyle}>
        <div style={{ marginBottom: 14 }}>
          <div id="source-conflict-title" style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>
            Conflito — unir duplicatas
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.45 }}>
            {conflict.label}. Escolha qual {entityLabel} manter: as referências da outra vão para a escolhida e a
            duplicata é apagada.
          </p>
        </div>

        <div style={gridStyle}>
          <ConflictCard
            label="Esta (atual)"
            entity={conflict.current}
            kind={conflict.kind}
            busy={busy === "current"}
            disabled={Boolean(busy)}
            onKeep={() => merge(conflict.current, conflict.other, "current")}
          />
          <ConflictCard
            label="Duplicata no banco"
            entity={conflict.other}
            kind={conflict.kind}
            busy={busy === "other"}
            disabled={Boolean(busy)}
            highlight
            onKeep={() => merge(conflict.other, conflict.current, "other")}
          />
        </div>

        {error && (
          <div style={{ marginTop: 12, fontSize: 13, color: "#C41E3A", fontWeight: 600 }}>{error}</div>
        )}

        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} disabled={Boolean(busy)} style={cancelBtnStyle}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ConflictCard({
  label,
  entity,
  kind,
  busy,
  disabled,
  highlight,
  onKeep,
}: {
  label: string;
  entity: SourceConflictEntity;
  kind: SourceConflict["kind"];
  busy: boolean;
  disabled: boolean;
  highlight?: boolean;
  onKeep: () => void;
}) {
  const round = kind === "artists";
  return (
    <div
      style={{
        ...cardStyle,
        borderColor: highlight ? "rgba(250,36,60,0.35)" : "var(--divider)",
        background: highlight ? "rgba(250,36,60,0.04)" : "var(--fill-inset)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 10 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
        <CoverThumb url={entity.coverUrl} size={56} round={round} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 750,
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={entity.title}
          >
            {entity.title}
          </div>
          {kind !== "artists" && (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginTop: 2,
              }}
              title={entity.artist}
            >
              {entity.artist}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 4 }}>
            {entity.entriesCount}{" "}
            {kind === "music" ? "entrada(s) no chart" : kind === "albums" ? "faixa(s)" : "música(s)"}
            {entity.spotifyId ? " · tem Spotify" : " · sem Spotify"}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onKeep}
        disabled={disabled}
        style={{
          ...keepBtnStyle,
          marginTop: 14,
          opacity: disabled && !busy ? 0.55 : 1,
          cursor: disabled ? "default" : "pointer",
        }}
      >
        {busy ? "Unindo…" : "Manter esta e confirmar merge"}
      </button>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const panelStyle: CSSProperties = {
  width: "100%",
  maxWidth: 640,
  background: "var(--surface)",
  border: "1px solid var(--divider-strong)",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 16px 48px rgba(0,0,0,0.18)",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const cardStyle: CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: 12,
  padding: 14,
};

const keepBtnStyle: CSSProperties = {
  width: "100%",
  border: "none",
  background: "#FA243C",
  color: "#fff",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 800,
};

const cancelBtnStyle: CSSProperties = {
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

function CoverThumb({ url, size = 56, round = false }: { url: string | null; size?: number; round?: boolean }) {
  if (url?.trim()) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: round ? 999 : 8, objectFit: "cover", display: "block", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      title="Sem capa"
      style={{
        width: size,
        height: size,
        borderRadius: round ? 999 : 8,
        border: "1.5px dashed #C41E3A",
        flexShrink: 0,
      }}
    />
  );
}
