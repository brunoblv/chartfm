"use client";

type PageItem = number | "...";

function buildPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

const buttonStyle = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "inherit",
} as const;

export function AdminTablePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const items = buildPageItems(page, totalPages);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginTop: 10,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {from}–{to} de {totalItems.toLocaleString("pt-BR")}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          style={{
            ...buttonStyle,
            cursor: page === 1 ? "not-allowed" : "pointer",
            opacity: page === 1 ? 0.4 : 1,
          }}
        >
          ←
        </button>
        {items.map((item, idx) =>
          item === "..." ? (
            <span key={`ellipsis-${idx}`} style={{ fontSize: 12, color: "var(--text-muted)", padding: "0 2px" }}>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              style={{
                ...buttonStyle,
                minWidth: 30,
                padding: "6px 8px",
                borderColor: item === page ? "#FA243C" : "var(--divider-strong)",
                color: item === page ? "#FA243C" : "var(--text)",
                background: item === page ? "var(--accent-tint)" : "var(--surface)",
                cursor: "pointer",
              }}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          style={{
            ...buttonStyle,
            cursor: page === totalPages ? "not-allowed" : "pointer",
            opacity: page === totalPages ? 0.4 : 1,
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}
