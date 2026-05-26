import { Suspense } from "react";

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Carregando editor…</div>}>{children}</Suspense>;
}
