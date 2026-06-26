"use client";

type Props = {
  hint: string;
};

export function MobileReorderHintBar({ hint }: Props) {
  return (
    <div
      style={{
        padding: "8px 16px",
        background: "var(--fill-subtle)",
        borderBottom: "1px solid var(--divider-soft)",
        textAlign: "left",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "left", display: "block" }}>{hint}</span>
    </div>
  );
}
