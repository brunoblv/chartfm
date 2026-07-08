"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

export function SongFlagButton({ songId, isLoggedIn }: { songId: string; isLoggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  if (status === "sent") {
    return (
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Obrigado! Sua sinalização foi enviada para revisão.
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => (isLoggedIn ? setOpen(true) : (window.location.href = "/login"))}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          padding: 0,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-muted)",
          cursor: "pointer",
        }}
        title="Sinalizar esta música como incorreta"
      >
        <Flag size={14} />
        Música errada?
      </button>
    );
  }

  return (
    <div style={{ marginTop: 6, maxWidth: 360 }}>
      <textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="O que está errado? (opcional)"
        rows={2}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid var(--divider-strong)",
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: 13,
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button
          type="button"
          disabled={status === "sending"}
          onClick={async () => {
            setStatus("sending");
            try {
              await fetch(`/api/songs/${songId}/flag`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason }),
              });
            } finally {
              setStatus("sent");
            }
          }}
          style={{
            border: "none",
            background: "#FA243C",
            color: "white",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {status === "sending" ? "Enviando…" : "Enviar sinalização"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            border: "1px solid var(--divider-strong)",
            background: "var(--surface)",
            color: "var(--text)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
