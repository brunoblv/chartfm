"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

type UserRow = {
  id: string;
  handle: string;
  name: string;
  role: "USER" | "ADMIN" | "DEV";
};

export function UsersAdminClient({ users }: { users: UserRow[] }) {
  const [rows, setRows] = useState(users);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function changeRole(id: string, role: UserRow["role"]) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) return;
      setRows((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 980, background: "white", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "rgba(0,0,0,0.03)" }}>
            <th style={thStyle}>Nome</th>
            <th style={thStyle}>Handle</th>
            <th style={thStyle}>Role</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td style={tdStyle}>{u.name}</td>
              <td style={tdStyle}>@{u.handle}</td>
              <td style={tdStyle}>
                <select
                  value={u.role}
                  onChange={(e) => changeRole(u.id, e.target.value as UserRow["role"])}
                  disabled={savingId === u.id}
                  style={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", padding: "6px 8px" }}
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="DEV">DEV</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#6B6B70", fontWeight: 700 };
const tdStyle: CSSProperties = { padding: "10px 12px", borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: 14, color: "#1D1D1F" };
