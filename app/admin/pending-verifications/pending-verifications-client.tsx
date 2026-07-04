"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { adminTdStyle, adminThStyle } from "@/components/admin/admin-styles";

type PendingUser = {
  id: string;
  email: string | null;
  name: string;
  handle: string;
  createdAt: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const buttonStyle = (disabled: boolean) => ({
  padding: "7px 14px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: disabled ? "var(--surface)" : "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.55 : 1,
});

export function PendingVerificationsClient() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pending-verifications");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setUsers(data.users ?? []);
      else setNote({ kind: "err", text: "Falha ao carregar a lista." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resendOne(userId: string) {
    setBusyId(userId);
    setNote(null);
    try {
      const res = await fetch("/api/admin/pending-verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      setNote(
        data.ok
          ? { kind: "ok", text: "Email reenviado." }
          : { kind: "err", text: "Não foi possível enviar (verifique SMTP_HOST/SMTP_USER/SMTP_PASS e EMAIL_FROM no servidor)." },
      );
    } finally {
      setBusyId(null);
    }
  }

  async function resendAll() {
    if (!confirm(`Reenviar confirmação para ${users.length} usuário(s) pendente(s)?`)) return;
    setBulkBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/pending-verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNote({
          kind: data.failed === 0 ? "ok" : "err",
          text: `Enviados: ${data.sent} · Falhas: ${data.failed} (de ${data.total}).`,
        });
      } else {
        setNote({ kind: "err", text: "Falha no reenvio em massa." });
      }
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0, flex: 1, minWidth: 200 }}>
          Usuários que criaram conta por email/senha e ainda não confirmaram o email.
        </p>
        <button type="button" onClick={load} disabled={loading} style={buttonStyle(loading)}>
          Atualizar
        </button>
        <button
          type="button"
          onClick={resendAll}
          disabled={bulkBusy || loading || users.length === 0}
          style={buttonStyle(bulkBusy || loading || users.length === 0)}
        >
          {bulkBusy ? "Reenviando…" : `Reenviar para todos (${users.length})`}
        </button>
      </div>

      {note && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            background: note.kind === "ok" ? "rgba(6,214,160,0.12)" : "rgba(250,36,60,0.1)",
            color: note.kind === "ok" ? "#06925f" : "#FA243C",
          }}
        >
          {note.text}
        </div>
      )}

      <AdminPanel>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={adminThStyle}>Email</th>
              <th style={adminThStyle}>Nome / handle</th>
              <th style={adminThStyle}>Cadastro</th>
              <th style={adminThStyle}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={adminTdStyle} colSpan={4}>Carregando…</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td style={adminTdStyle} colSpan={4}>Nenhuma confirmação pendente. 🎉</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td style={adminTdStyle}>{u.email}</td>
                  <td style={adminTdStyle}>
                    {u.name} <span style={{ color: "var(--text-muted)" }}>@{u.handle}</span>
                  </td>
                  <td style={adminTdStyle}>{formatDate(u.createdAt)}</td>
                  <td style={{ ...adminTdStyle, textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => resendOne(u.id)}
                      disabled={busyId === u.id || bulkBusy}
                      style={buttonStyle(busyId === u.id || bulkBusy)}
                    >
                      {busyId === u.id ? "Enviando…" : "Reenviar"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AdminPanel>
    </div>
  );
}
