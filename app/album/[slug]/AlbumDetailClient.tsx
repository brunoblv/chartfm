"use client";

import { useState } from "react";

export type AlbumDetailClientProps = {
  albumDbId: number | null;
  albumTitle: string;
  albumArtist: string;
  palette: [string, string];
  statsSection: React.ReactNode;
  tracklistSection: React.ReactNode;
};

export function AlbumDetailClient({
  statsSection,
  tracklistSection,
}: AlbumDetailClientProps) {
  const [activeTab, setActiveTab] = useState<"stats" | "tracklist">("stats");

  const tabs = [
    { id: "stats" as const, label: "Estatísticas" },
    { id: "tracklist" as const, label: "Tracklist" },
  ];

  return (
    <>
      {/* Tabs */}
      <div
        style={{
          padding: "0 40px",
          borderBottom: "1px solid var(--divider)",
          display: "flex",
          gap: 4,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: "none",
              border: "none",
              padding: "16px 4px",
              marginRight: 24,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: activeTab === tab.id ? "var(--text)" : "var(--text-muted)",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: "28px 40px 80px 40px" }}>
        {activeTab === "stats" && statsSection}
        {activeTab === "tracklist" && tracklistSection}
      </div>
    </>
  );
}
