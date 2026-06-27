import type { CSSProperties } from "react";

export const adminThStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  color: "var(--text-muted)",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

export const adminTdStyle: CSSProperties = {
  padding: "10px 12px",
  borderTop: "1px solid var(--divider)",
  fontSize: 14,
  color: "var(--text)",
};

export const adminNavChipStyle: CSSProperties = {
  display: "inline-block",
  padding: "7px 12px",
  borderRadius: 999,
  border: "1px solid var(--divider-strong)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  color: "var(--text)",
  background: "var(--surface)",
};

export const adminInputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

export const adminPageWrapStyle: CSSProperties = {
  maxWidth: 980,
  width: "100%",
};

export const adminPanelStyle: CSSProperties = {
  background: "var(--surface)",
  borderRadius: 14,
  border: "1px solid var(--divider)",
  overflow: "hidden",
};

export const adminPanelScrollStyle: CSSProperties = {
  ...adminPanelStyle,
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
};
