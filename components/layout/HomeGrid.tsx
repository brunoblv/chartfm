"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import { AdSlot } from "@/components/ui/AdSlot";

interface HomeGridProps {
  feed: React.ReactNode;
  sidebar: React.ReactNode;
}

export function HomeGrid({ feed, sidebar }: HomeGridProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {feed}
        <AdSlot slotId="COLE_AQUI_SLOT_ID_5" format="mobile-banner" style={{ margin: "4px 0" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {sidebar}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 36, alignItems: "flex-start" }}>
      {feed}
      <aside style={{ position: "sticky", top: 100, display: "flex", flexDirection: "column", gap: 20 }}>
        {sidebar}
      </aside>
    </div>
  );
}
