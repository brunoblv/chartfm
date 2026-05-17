"use client";

import { useTheme, type Theme } from "@/components/ThemeProvider";

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Claro", icon: "☀" },
  { value: "auto",  label: "Auto",  icon: "⬤" },
  { value: "dark",  label: "Escuro", icon: "☾" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "var(--fill-subtle)",
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      {OPTIONS.map(({ value, label, icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            title={label}
            onClick={() => setTheme(value)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: "5px 6px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--text)" : "var(--text-muted)",
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              letterSpacing: "-0.01em",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              transition: "background 120ms, color 120ms",
            }}
          >
            <span style={{ fontSize: 12 }}>{icon}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
