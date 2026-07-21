"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useTranslations } from "@/hooks/useTranslations";

type SearchItem = { label: string; href: string; type: "Guia" | "FAQ" };

export function HelpSearch({ items }: { items: SearchItem[] }) {
  const { t } = useTranslations();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 8);
  }, [query, items]);

  const showPanel = query.trim().length > 0;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", position: "relative", textAlign: "left" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "var(--bg)",
          border: "1px solid var(--divider-strong)",
          borderRadius: 100,
          padding: "12px 20px",
        }}
      >
        <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("helpCenter.searchPlaceholder")}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 14,
            color: "var(--text)",
            fontFamily: "inherit",
          }}
        />
      </div>

      {showPanel && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "var(--surface)",
            border: "1px solid var(--divider)",
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
            zIndex: 10,
          }}
        >
          {results.length > 0 ? (
            results.map((item) => (
              <Link
                key={`${item.type}-${item.href}-${item.label}`}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--divider-soft)",
                  textDecoration: "none",
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{item.label}</span>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    background: "var(--fill-subtle)",
                    padding: "2px 8px",
                    borderRadius: 100,
                  }}
                >
                  {item.type === "Guia" ? t("helpCenter.typeGuide") : t("helpCenter.typeFaq")}
                </span>
              </Link>
            ))
          ) : (
            <div style={{ padding: "16px", fontSize: 13, color: "var(--text-muted)" }}>
              {t("helpCenter.searchNoResults")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
