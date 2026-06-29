"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { GlobalFooter } from "./GlobalFooter";
import { useIsMobile } from "@/hooks/useIsMobile";
import { pageGutterPadding } from "@/lib/page-layout";

interface ShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  noPadding?: boolean;
  hideGlobalFooter?: boolean;
  hideTopBar?: boolean;
}

export function Shell({ children, title, subtitle, headerRight, noPadding, hideGlobalFooter, hideTopBar }: ShellProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const mainPadding = noPadding
    ? isMobile
      ? { paddingBottom: hideGlobalFooter ? 80 : 0 }
      : {}
    : isMobile
      ? { padding: hideGlobalFooter ? "20px 0 80px 0" : "20px 0" }
      : { padding: hideGlobalFooter ? "36px 0 80px 0" : "36px 0 40px 0" };

  const gutterPadding = pageGutterPadding(isMobile);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {!isMobile && <Sidebar />}
      {isMobile && (
        <Sidebar isMobile isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {!hideTopBar && (
          <TopBar isMobile={isMobile} onMenuToggle={isMobile ? () => setSidebarOpen((o) => !o) : undefined} />
        )}
        <main style={mainPadding}>
          {noPadding ? (
            children
          ) : (
            <div style={{ padding: gutterPadding }}>
              {title && (
                <header style={{ marginBottom: 28, display: "flex", alignItems: "flex-end", gap: 24 }}>
                  <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: isMobile ? 28 : 44, fontWeight: 700, letterSpacing: "-0.04em", margin: 0, lineHeight: 1.05 }}>
                      {title}
                    </h1>
                    {subtitle && (
                      <p style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 6, letterSpacing: "-0.01em", margin: "6px 0 0 0" }}>
                        {subtitle}
                      </p>
                    )}
                  </div>
                  {headerRight}
                </header>
              )}
              {children}
            </div>
          )}
        </main>
        {!hideGlobalFooter && <GlobalFooter isMobile={isMobile} />}
      </div>
      {isMobile && <BottomNav />}
    </div>
  );
}
