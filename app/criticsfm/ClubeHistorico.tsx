"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { ClubeHistoryRound } from "@/lib/clube-album";
import { scoreColor } from "@/lib/album-score";

function albumHue(title: string): number {
  return Math.abs(title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360;
}

function MiniCover({ title, coverUrl, size = 52 }: { title: string; coverUrl?: string | null; size?: number }) {
  if (coverUrl) {
    return (
      <img src={coverUrl} alt={title} style={{ width: size, height: size, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
    );
  }
  const hue = albumHue(title);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: `hsl(${hue},45%,55%)`,
        display: "grid",
        placeItems: "center",
        color: "white",
        fontSize: Math.floor(size * 0.42),
        fontWeight: 800,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {title[0]?.toUpperCase()}
    </div>
  );
}

export function ClubeHistorico({
  rounds,
  stats,
}: {
  rounds: ClubeHistoryRound[];
  stats: { totalRounds: number; totalAlbums: number; totalParticipants: number };
}) {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return rounds;
    const lq = search.toLowerCase();
    return rounds.filter(
      (r) =>
        r.theme.toLowerCase().includes(lq) ||
        r.winners.some((w) => w.title.toLowerCase().includes(lq) || w.artist.toLowerCase().includes(lq)),
    );
  }, [rounds, search]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 13, color: "var(--text-muted)" }}>
        <Link href="/criticsfm" style={{ display: "flex", alignItems: "center", gap: 4, textDecoration: "none", color: "var(--text-muted)", fontWeight: 500 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          CriticsFM
        </Link>
        <span>/</span>
        <span style={{ color: "var(--text)", fontWeight: 600 }}>Histórico</span>
      </div>

      <header
        style={{
          marginBottom: 32,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "flex-end",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: isMobile ? 32 : 40, fontWeight: 800, letterSpacing: "-0.04em", margin: 0, lineHeight: 1.05, color: "var(--text)" }}>
            Histórico
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 6 }}>Todas as rodadas do Clube do Álbum</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 12, padding: "10px 14px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por tema ou álbum…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, color: "var(--text)", fontFamily: "inherit", width: isMobile ? "100%" : 240 }}
          />
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12, marginBottom: 40 }}>
        {[
          { label: "Rodadas realizadas", value: stats.totalRounds, sub: "desde o início" },
          { label: "Álbuns ouvidos", value: stats.totalAlbums, sub: "escolhidos pela comunidade" },
          { label: "Participantes", value: stats.totalParticipants, sub: "membros únicos" },
        ].map((stat) => (
          <div key={stat.label} style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 16, padding: "20px 22px" }}>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text)", lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginTop: 6 }}>{stat.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 18, padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
            {rounds.length === 0 ? "Nenhuma rodada concluída ainda" : "Nenhuma rodada encontrada"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-disabled)" }}>
            {rounds.length === 0 ? "As rodadas finalizadas aparecerão aqui." : "Tente um termo diferente"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((round, idx) => (
            <div
              key={round.rodada}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--divider)",
                borderRadius: 18,
                padding: isMobile ? "18px 16px" : "22px 24px",
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "center",
                gap: isMobile ? 16 : 20,
                boxShadow: idx === 0 ? "0 1px 4px rgba(0,0,0,0.04)" : "none",
              }}
            >
              <div style={{ flexShrink: 0, textAlign: "center", width: isMobile ? undefined : 52 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{round.rodada}</div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-disabled)", marginTop: 2 }}>rodada</div>
              </div>

              {!isMobile && <div style={{ width: 1, alignSelf: "stretch", background: "var(--divider)", flexShrink: 0 }} />}

              <div style={{ flex: isMobile ? undefined : "0 0 220px", minWidth: 0 }}>
                {idx === 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--accent-tint)", color: "var(--accent)", borderRadius: 100, padding: "2px 8px", fontSize: 10, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 6 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
                    Mais recente
                  </span>
                )}
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", lineHeight: 1.2, marginBottom: 4 }}>{round.theme}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{round.dateRange}</div>
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
                {round.winners.map((w, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--fill-inset)", borderRadius: 12, padding: "10px 12px", flex: 1, minWidth: 0, border: "1px solid var(--divider)" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: i === 0 ? "#C9A227" : "#A8A8B0", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="white">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </div>
                    <MiniCover title={w.title} coverUrl={w.coverUrl} size={40} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {w.artist} · {w.year}
                        {w.nominatedBy && <> · @{w.nominatedBy}</>}
                      </div>
                    </div>
                    {w.score !== null && (
                      <div style={{ fontSize: 14, fontWeight: 800, color: scoreColor(w.score), flexShrink: 0 }}>{w.score}</div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{round.participants}</span>
                <span style={{ fontSize: 10, color: "var(--text-disabled)" }}>membros</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
