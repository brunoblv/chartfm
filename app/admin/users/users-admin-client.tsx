"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { adminTdStyle, adminThStyle } from "@/components/admin/admin-styles";
import { Avatar } from "@/components/ui/Avatar";

type UserRow = {
  id: string;
  handle: string;
  name: string;
  role: "USER" | "ADMIN" | "DEV";
  image: string | null;
  avatarColor: string;
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
            <th style={adminThStyle}></th>
            <th style={adminThStyle}>Nome</th>
            <th style={adminThStyle}>Nome de Usuário</th>
            <th style={adminThStyle}>Role</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td style={adminTdStyle}>
                <Link href={`/profile/${u.handle}`}>
                  <Avatar user={{ name: u.name, avatar: u.avatarColor }} imageUrl={u.image} size={32} />
                </Link>
              </td>
              <td style={adminTdStyle}>
                <Link href={`/profile/${u.handle}`} style={{ color: "inherit", textDecoration: "none" }}>
                  {u.name}
                </Link>
              </td>
              <td style={adminTdStyle}>
                <Link href={`/profile/${u.handle}`} style={{ color: "inherit", textDecoration: "none" }}>
                  @{u.handle}
                </Link>
              </td>
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
