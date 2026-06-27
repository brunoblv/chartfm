"use client";

import { useState } from "react";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { adminTdStyle, adminThStyle } from "@/components/admin/admin-styles";

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
    <AdminPanel>
      <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--fill-inset)" }}>
            <th style={adminThStyle}>Nome</th>
            <th style={adminThStyle}>Nome de Usuário</th>
            <th style={adminThStyle}>Role</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td style={adminTdStyle}>{u.name}</td>
              <td style={adminTdStyle}>@{u.handle}</td>
              <td style={adminTdStyle}>
                <select
                  value={u.role}
                  onChange={(e) => changeRole(u.id, e.target.value as UserRow["role"])}
                  disabled={savingId === u.id}
                  style={{ borderRadius: 8, border: "1px solid var(--divider-strong)", padding: "6px 8px", background: "var(--surface)", color: "var(--text)" }}
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
    </AdminPanel>
  );
}
