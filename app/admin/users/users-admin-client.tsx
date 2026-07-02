"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CSSProperties, FormEvent } from "react";
import { useRouter } from "next/navigation";
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
  createdAt: string;
};

function formatCreatedAt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UsersAdminClient({
  users,
  page,
  totalPages,
  total,
  query,
}: {
  users: UserRow[];
  page: number;
  totalPages: number;
  total: number;
  query: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(users);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => {
    setRows(users);
  }, [users]);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

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

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (p > 1) params.set("page", String(p));
    if (query) params.set("q", query);
    const qs = params.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    const q = searchInput.trim();
    if (q) params.set("q", q);
    const qs = params.toString();
    router.push(qs ? `/admin/users?${qs}` : "/admin/users");
  }

  return (
    <AdminPanel>
      <form
        onSubmit={handleSearch}
        style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}
      >
        <input
          type="search"
          name="q"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por nome ou @usuário"
          style={searchInputStyle}
        />
        <button type="submit" style={searchButtonStyle}>
          Buscar
        </button>
        {query && (
          <Link href="/admin/users" style={clearLinkStyle}>
            Limpar
          </Link>
        )}
      </form>

      <div style={{ marginBottom: 12, fontSize: 13, color: "var(--text-muted)" }}>
        {query ? (
          <>
            {total.toLocaleString("pt-BR")} resultado{total === 1 ? "" : "s"} para &ldquo;{query}&rdquo; — página {page} / {totalPages}
          </>
        ) : (
          <>
            {rows.length} de {total.toLocaleString("pt-BR")} — página {page} / {totalPages}
          </>
        )}
      </div>
      <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--fill-inset)" }}>
            <th style={adminThStyle}></th>
            <th style={adminThStyle}>Nome</th>
            <th style={adminThStyle}>Nome de Usuário</th>
            <th style={adminThStyle}>Criado em</th>
            <th style={adminThStyle}>Role</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ ...adminTdStyle, textAlign: "center", color: "var(--text-muted)" }}>
                Nenhum usuário encontrado.
              </td>
            </tr>
          ) : (
            rows.map((u) => (
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
              <td style={{ ...adminTdStyle, whiteSpace: "nowrap", color: "var(--text-muted)", fontSize: 13 }}>
                {formatCreatedAt(u.createdAt)}
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
            ))
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
          {page > 1 && (
            <Link href={pageHref(page - 1)} style={pageLinkStyle}>
              ← Anterior
            </Link>
          )}
          {page < totalPages && (
            <Link href={pageHref(page + 1)} style={pageLinkStyle}>
              Próxima →
            </Link>
          )}
        </div>
      )}
    </AdminPanel>
  );
}

const pageLinkStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 14,
};

const searchInputStyle: CSSProperties = {
  flex: "1 1 240px",
  minWidth: 200,
  maxWidth: 420,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
  boxSizing: "border-box",
};

const searchButtonStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const clearLinkStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--text-muted)",
  textDecoration: "none",
  fontWeight: 600,
};
