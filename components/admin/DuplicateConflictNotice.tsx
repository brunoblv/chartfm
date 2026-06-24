"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { DuplicateConflict } from "@/lib/duplicate-conflict-payload";

export function DuplicateConflictNotice({
  conflict,
  message,
  onDismiss,
}: {
  conflict: DuplicateConflict;
  message?: string;
  onDismiss?: () => void;
}) {
  const isSong = conflict.kind === "song";
  const defaultMessage = isSong
    ? `Já existe uma música com este nome para ${conflict.artist}. Use o cadastro existente em vez de criar outro.`
    : `Já existe um álbum com este nome para ${conflict.artist}. Use o cadastro existente em vez de criar outro.`;

  return (
    <div style={boxStyle} role="alert">
      <p style={{ margin: 0, fontSize: 14, color: "#7A4E00", lineHeight: 1.5, fontWeight: 600 }}>
        {message ?? defaultMessage}
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: "#1D1D1F", lineHeight: 1.45 }}>
        <strong>{conflict.title}</strong>
        <span style={{ color: "#6B6B70" }}> — {conflict.artist}</span>
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <Link href={conflict.href} style={primaryLinkStyle}>
          {isSong ? "Ver música cadastrada" : "Ver álbum cadastrado"}
        </Link>
        <Link href={conflict.editHref} style={secondaryLinkStyle}>
          {isSong ? "Editar música existente" : "Editar álbum existente"}
        </Link>
        {onDismiss && (
          <button type="button" onClick={onDismiss} style={dismissStyle}>
            Continuar aqui
          </button>
        )}
      </div>
    </div>
  );
}

const boxStyle: CSSProperties = {
  marginTop: 12,
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid rgba(245, 158, 11, 0.45)",
  background: "rgba(255, 237, 170, 0.35)",
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 10,
  background: "#FA243C",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
};

const secondaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.14)",
  background: "#fff",
  color: "#1D1D1F",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
};

const dismissStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#6B6B70",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  padding: "8px 4px",
  textDecoration: "underline",
};
