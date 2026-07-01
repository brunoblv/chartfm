"use client";

import { useEffect, useRef, useState } from "react";

const CARD_MIN_WIDTH = 300;
const GRID_GAP = 16;
const PUBLICATION_ROWS = 2;

function columnsForWidth(width: number): number {
  if (width <= 0) return 1;
  return Math.max(1, Math.floor((width + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP)));
}

/** Colunas que cabem no grid e itens por página (2 linhas). */
export function usePublicationGridLayout(isMobile: boolean) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(() => (isMobile ? 1 : 3));

  useEffect(() => {
    if (isMobile) {
      setCols(1);
      return;
    }
    const el = gridRef.current;
    if (!el) return;

    const update = () => setCols(columnsForWidth(el.clientWidth));
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);

  const rows = isMobile ? 6 : PUBLICATION_ROWS;
  const perPage = cols * rows;

  return {
    gridRef,
    cols,
    perPage,
    gridTemplateColumns: isMobile
      ? "1fr"
      : `repeat(auto-fill, minmax(${CARD_MIN_WIDTH}px, 1fr))`,
  };
}

function buildPageItems(
  currentPage: number,
  totalPages: number,
): Array<number | "..."> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

export function ParadaPagination({
  page,
  totalPages,
  onChange,
  loading = false,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  loading?: boolean;
}) {
  if (totalPages <= 1) return null;

  const items = buildPageItems(page, totalPages);
  const buttonStyle = {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid var(--divider-strong)",
    background: "var(--surface)",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
  } as const;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginTop: 24,
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        disabled={page === 1 || loading}
        onClick={() => onChange(page - 1)}
        style={{
          ...buttonStyle,
          cursor: page === 1 || loading ? "not-allowed" : "pointer",
          opacity: page === 1 || loading ? 0.4 : 1,
        }}
      >
        ← Anterior
      </button>
      {items.map((item, idx) =>
        item === "..." ? (
          <span
            key={`ellipsis-${idx}`}
            style={{ fontSize: 13, color: "var(--text-muted)", padding: "0 2px" }}
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            disabled={loading}
            onClick={() => onChange(item)}
            style={{
              ...buttonStyle,
              minWidth: 36,
              padding: "8px 10px",
              borderColor: item === page ? "#FA243C" : "var(--divider-strong)",
              color: item === page ? "#FA243C" : "var(--text)",
              background: item === page ? "var(--accent-tint)" : "var(--surface)",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {item}
          </button>
        ),
      )}
      <span style={{ fontSize: 13, color: "var(--text-muted)", padding: "0 8px" }}>
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page === totalPages || loading}
        onClick={() => onChange(page + 1)}
        style={{
          ...buttonStyle,
          cursor: page === totalPages || loading ? "not-allowed" : "pointer",
          opacity: page === totalPages || loading ? 0.4 : 1,
        }}
      >
        Próxima →
      </button>
    </div>
  );
}
