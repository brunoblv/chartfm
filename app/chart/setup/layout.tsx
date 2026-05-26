import { Suspense } from "react";

export default function ChartSetupLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#6B6B70" }}>Carregando…</div>}>{children}</Suspense>;
}
