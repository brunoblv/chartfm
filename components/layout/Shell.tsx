"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useIsMobile } from "@/hooks/useIsMobile";

interface ShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  noPadding?: boolean;
}

export function Shell({ children, title, subtitle, noPadding }: ShellProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FBFBFD" }}>
      <Sidebar isMobile={isMobile} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopBar
          title={title}
          subtitle={subtitle}
          isMobile={isMobile}
          onMenuToggle={() => setSidebarOpen((o) => !o)}
        />
        <main style={noPadding ? {} : { padding: isMobile ? "20px 16px 80px 16px" : "36px 40px 80px 40px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
