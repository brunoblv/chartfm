"use client";

import { useIsMobile } from "@/hooks/useIsMobile";

export function AjudaTwoColumn({ guides, sidebar }: { guides: React.ReactNode; sidebar: React.ReactNode }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        {guides}
        {sidebar}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 40, alignItems: "start" }}>
      {guides}
      {sidebar}
    </div>
  );
}
