"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { RankBadge } from "@/components/push/PushAtoms";
import { PODIUM_COLORS } from "@/components/push/push-helpers";

type RankEntry = {
  rank: number;
  handle: string;
  name: string;
  points: number;
  wins: number;
};

function RankingList({ entries, loading }: { entries: RankEntry[]; loading: boolean }) {
  if (loading) {
    return <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "32px 0", textAlign: "center" }}>Carregando…</div>;
  }
  if (entries.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
        <Trophy size={36} style={{ opacity: 0.25, marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
        <div style={{ fontSize: 14 }}>Nenhuma rodada concluída nessa temporada ainda.</div>
      </div>
    );
  }

  const podiumEmoji = ["🥇", "🥈", "🥉"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {entries.map((entry) => {
        const isPodium = entry.rank <= 3;
        return (
          <Link
            key={entry.handle}
            href={`/profile/${entry.handle}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: isPodium ? "12px 16px" : "9px 16px",
              borderRadius: 14,
              background: isPodium
                ? `color-mix(in srgb, ${PODIUM_COLORS[entry.rank - 1]} 8%, var(--surface))`
                : "var(--surface)",
              border: `1px solid ${isPodium ? `color-mix(in srgb, ${PODIUM_COLORS[entry.rank - 1]} 22%, var(--divider))` : "var(--divider)"}`,
              textDecoration: "none",
            }}
          >
            <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>
              {isPodium ? (
                <span style={{ fontSize: 22, lineHeight: 1 }}>{podiumEmoji[entry.rank - 1]}</span>
              ) : (
                <RankBadge pos={entry.rank} small />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>@{entry.handle}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.03em", color: isPodium ? PODIUM_COLORS[entry.rank - 1] : "var(--text)", lineHeight: 1 }}>
                {entry.points}
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".05em", marginTop: 2 }}>PTS</div>
              {entry.wins > 0 && (
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  {entry.wins} {entry.wins === 1 ? "vitória" : "vitórias"}
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function RankingClient({ seasons }: { seasons: number[] }) {
  const [activeTab, setActiveTab] = useState<"geral" | number>("geral");
  const [entries, setEntries] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setEntries([]);
    const url = activeTab === "geral" ? "/api/push/rankings" : `/api/push/rankings?season=${activeTab}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: { ranking?: RankEntry[] }) => setEntries(d.ranking ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeTab]);

  const tabs: Array<{ id: "geral" | number; label: string }> = [
    { id: "geral", label: "Geral" },
    ...seasons.map((s) => ({ id: s as "geral" | number, label: `T${s}` })),
  ];

  return (
    <div>
      {/* Tab strip */}
      <div style={{
        display: "flex",
        gap: 4,
        background: "var(--fill-subtle)",
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
        overflowX: "auto" as const,
      }}>
        {tabs.map(({ id, label }) => {
          const active = activeTab === id;
          return (
            <button
              key={String(id)}
              type="button"
              onClick={() => setActiveTab(id)}
              style={{
                flex: tabs.length <= 5 ? 1 : undefined,
                whiteSpace: "nowrap" as const,
                padding: "8px 14px",
                borderRadius: 9,
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                background: active ? "var(--surface)" : "transparent",
                color: active ? "var(--text)" : "var(--text-muted)",
                boxShadow: active ? "0 1px 4px rgba(0,0,0,.10)" : "none",
                transition: "background .14s, color .14s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Context label */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase" as const, marginBottom: 12 }}>
        {activeTab === "geral" ? "Ranking Geral · Todas as temporadas" : `Ranking · Temporada ${activeTab}`}
      </div>

      <RankingList entries={entries} loading={loading} />
    </div>
  );
}
