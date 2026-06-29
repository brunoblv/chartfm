"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VersionTagType } from "@/lib/clean-version-tag";

type Candidate = {
  id: string;
  before: string;
  after: string;
  artist: string;
  entries: number;
  conflict: boolean;
};

type PreviewResponse = {
  preview: Candidate[];
  total: number;
  applicable: number;
  conflicts: number;
};

type Props = {
  type: VersionTagType;
  label: string;
  description: string;
};

export function CleanVersionTagButton({ type, label, description }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "applying" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<{ updated: number; skippedConflicts: number } | null>(null);

  async function openModal() {
    setOpen(true);
    setStatus("loading");
    setData(null);
    setResult(null);
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/music/clean-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true, type }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? "Erro ao carregar prévia.");
        setStatus("error");
        return;
      }
      setData(json);
      setStatus("idle");
    } catch {
      setErrorMsg("Erro ao carregar prévia.");
      setStatus("error");
    }
  }

  function close() {
    setOpen(false);
    setData(null);
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
  }

  async function apply() {
    setStatus("applying");
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/music/clean-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? "Erro ao aplicar.");
        setStatus("error");
        return;
      }
      setResult({ updated: json.updated, skippedConflicts: json.skippedConflicts });
      setStatus("done");
      router.refresh();
    } catch {
      setErrorMsg("Erro ao aplicar.");
      setStatus("error");
    }
  }

  const applicableCount = data?.applicable ?? 0;

  return (
    <>
      <button onClick={openModal} style={triggerBtnStyle}>
        Limpar {label}
      </button>

      {open && (
        <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && close()}>
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F" }}>Limpar tags de {label}</div>
                <div style={{ fontSize: 13, color: "#6B6B70", marginTop: 3 }}>{description}</div>
              </div>
              <button onClick={close} style={closeBtnStyle}>✕</button>
            </div>

            {status === "loading" && (
              <div style={{ padding: "24px 0", textAlign: "center", color: "#86868B", fontSize: 14 }}>
                Carregando prévia…
              </div>
            )}

            {errorMsg && (
              <div style={{ fontSize: 13, color: "#FA243C", margin: "8px 0" }}>{errorMsg}</div>
            )}

            {status === "done" && result && (
              <div>
                <div style={{ fontSize: 14, color: "#1B873F", fontWeight: 700, marginBottom: 8 }}>
                  {result.updated} {result.updated === 1 ? "título atualizado" : "títulos atualizados"} com sucesso!
                </div>
                {result.skippedConflicts > 0 && (
                  <div style={{ fontSize: 13, color: "#92400E", marginBottom: 8 }}>
                    {result.skippedConflicts}{" "}
                    {result.skippedConflicts === 1 ? "música foi ignorada" : "músicas foram ignoradas"} por conflito de
                    título (já existe outra música igual do mesmo artista).
                  </div>
                )}
                <button onClick={close} style={applyBtnStyle}>Fechar</button>
              </div>
            )}

            {status !== "done" && data && (
              <>
                <div style={{ fontSize: 13, color: "#6B6B70", margin: "0 0 12px" }}>
                  <strong>{data.total}</strong>{" "}
                  {data.total === 1 ? "música afetada" : "músicas afetadas"} —{" "}
                  <strong>{applicableCount}</strong> serão alteradas
                  {data.conflicts > 0 ? (
                    <>
                      , <strong style={{ color: "#92400E" }}>{data.conflicts}</strong> em conflito (ignoradas)
                    </>
                  ) : null}
                  .
                </div>

                <div style={listStyle}>
                  {data.preview.length === 0 && (
                    <div style={{ padding: 16, color: "#86868B", fontSize: 14 }}>
                      Nenhuma música com tag de {label.toLowerCase()} encontrada.
                    </div>
                  )}
                  {data.preview.map((c) => (
                    <div key={c.id} style={{ ...rowStyle, opacity: c.conflict ? 0.6 : 1 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, color: "#86868B", marginBottom: 2 }}>{c.artist}</div>
                        <div style={{ fontSize: 13, color: "#C0392B", textDecoration: "line-through" }}>
                          {c.before}
                        </div>
                        <div style={{ fontSize: 13, color: "#1B873F", fontWeight: 600 }}>
                          {c.after}
                        </div>
                      </div>
                      {c.conflict && (
                        <span style={conflictBadgeStyle}>conflito</span>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={apply}
                  disabled={status === "applying" || applicableCount === 0}
                  style={{
                    ...applyBtnStyle,
                    marginTop: 14,
                    opacity: status === "applying" || applicableCount === 0 ? 0.6 : 1,
                    cursor: status === "applying" || applicableCount === 0 ? "default" : "pointer",
                  }}
                >
                  {status === "applying"
                    ? "Aplicando…"
                    : `Aplicar em ${applicableCount} ${applicableCount === 1 ? "música" : "músicas"}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const triggerBtnStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(250,36,60,0.35)",
  background: "rgba(250,36,60,0.08)",
  color: "#FA243C",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const modalStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 16,
  padding: 24,
  width: "100%",
  maxWidth: 560,
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 18,
  color: "#86868B",
  cursor: "pointer",
  lineHeight: 1,
  padding: "2px 4px",
};

const listStyle: React.CSSProperties = {
  overflowY: "auto",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 12,
  background: "rgba(0,0,0,0.02)",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
};

const conflictBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 6,
  padding: "3px 7px",
  background: "rgba(146,64,14,0.14)",
  color: "#92400E",
  whiteSpace: "nowrap",
};

const applyBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 0",
  borderRadius: 10,
  border: "none",
  background: "#FA243C",
  color: "white",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
