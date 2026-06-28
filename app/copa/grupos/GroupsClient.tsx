"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopaArtistAvatar } from "../CopaArtistAvatar";
import type { StandingRow } from "@/lib/copa";

type ArtistData = {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerHandle: string;
  ownerAvatarColor: string;
  groupLetter: string;
  artistName: string;
  artistImage: string | null;
  artistColor: string;
  artistInitials: string;
};

type FixtureRow = {
  id: string;
  round: number | null;
  matchIndex: number;
  artistAId: string;
  artistBId: string;
  singleAName: string;
  singleBName: string;
  singleACover: string | null;
  singleBCover: string | null;
  votesA: number;
  votesB: number;
  goalsA: number;
  goalsB: number;
  status: string;
};

type GroupData = {
  letter: string;
  artists: ArtistData[];
  standings: StandingRow[];
  fixtures: FixtureRow[];
};

type Props = {
  groups: GroupData[];
  userId: string | null;
  copaId: string;
};

function StatusBadge({ status, round }: { status: string; round: number | null }) {
  if (status === "LIVE") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, background: "rgba(250,36,60,.13)", color: "#FA243C", padding: "3px 8px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FA243C", display: "inline-block", animation: "pulse 1.4s ease-in-out infinite" }} />
        Ao vivo
      </span>
    );
  }
  if (status === "DONE") {
    return <span style={{ fontSize: 10, fontWeight: 700, background: "var(--fill-inset)", color: "var(--text-muted)", padding: "3px 8px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em" }}>R{round}</span>;
  }
  return <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", padding: "3px 8px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em" }}>R{round}</span>;
}

export function GroupsClient({ groups, userId, copaId }: Props) {
  const router = useRouter();
  const [sel, setSel] = useState(groups[0]?.letter ?? "A");

  const group = groups.find((g) => g.letter === sel);
  const artistMap = Object.fromEntries((group?.artists ?? []).map((a) => [a.id, a]));

  return (
    <div>
      {/* Group letter selector */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "14px 24px 10px" }}>
        {groups.map((g) => {
          const hasLive = g.fixtures.some((f) => f.status === "LIVE");
          const isActive = g.letter === sel;
          return (
            <button
              key={g.letter}
              onClick={() => setSel(g.letter)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: hasLive && !isActive ? "1.5px solid rgba(250,36,60,.5)" : "1.5px solid transparent",
                background: isActive ? "#FFD426" : hasLive ? "rgba(250,36,60,.08)" : "var(--fill-inset)",
                color: isActive ? "#000" : hasLive ? "#FA243C" : "var(--text-muted)",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                transition: "0.12s",
              }}
            >
              {g.letter}
            </button>
          );
        })}
      </div>

      {group && (
        <div style={{ padding: "0 24px 24px" }}>
          {/* Standings table */}
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)", marginBottom: 10 }}>
            Classificação · Grupo {group.letter}
          </p>
          <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: "8px 14px 8px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-disabled)" }}>#</th>
                  <th style={{ padding: "8px 9px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-disabled)" }}>Artista</th>
                  {["PJ","V","E","D","GP","GC","SG","Pts"].map((h) => (
                    <th key={h} style={{ padding: "8px 6px", textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-disabled)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.standings.map((row, i) => {
                  const art = artistMap[row.artistId];
                  const isQual = i < 2;
                  const isMe = art?.ownerId === userId;
                  return (
                    <tr
                      key={row.artistId}
                      style={{
                        borderTop: i === 2 ? "2px solid rgba(52,199,89,.35)" : "1px solid var(--divider)",
                      }}
                    >
                      <td style={{ padding: "9px 14px", fontWeight: 800, color: isQual ? "#34C759" : "var(--text-disabled)", textAlign: "left" }}>{i + 1}</td>
                      <td style={{ padding: "9px 9px", textAlign: "left", fontWeight: 700 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {art && <CopaArtistAvatar {...art} size={22} />}
                          <span style={{ color: isQual ? "var(--text)" : "var(--text-muted)" }}>{art?.artistName}</span>
                          {isMe && (
                            <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(255,212,38,.15)", color: "#FFD426", padding: "2px 6px", borderRadius: 99 }}>
                              MEU
                            </span>
                          )}
                        </div>
                      </td>
                      {[row.P, row.W, row.D, row.L, row.GF, row.GA].map((v, ci) => (
                        <td key={ci} style={{ padding: "9px 6px", textAlign: "right", color: "var(--text-muted)" }}>{v}</td>
                      ))}
                      <td style={{ padding: "9px 6px", textAlign: "right", color: row.GD > 0 ? "#34C759" : row.GD < 0 ? "#E74C3C" : "var(--text-muted)" }}>
                        {row.GD > 0 ? "+" : ""}{row.GD}
                      </td>
                      <td style={{ padding: "9px 6px", textAlign: "right", fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{row.Pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-disabled)", marginBottom: 20 }}>
            ● 1º e 2º classificados avançam para o 1/16 de Final
          </div>

          {/* Fixtures */}
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)", marginBottom: 10 }}>
            Jogos · Grupo {group.letter}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {group.fixtures.map((f) => {
              const artA = artistMap[f.artistAId];
              const artB = artistMap[f.artistBId];
              const canClick = f.status === "LIVE" || f.status === "DONE";
              // Single revelado só Ao vivo/Encerrado (vem vazio do servidor antes disso).
              const singleA = f.singleAName;
              const singleB = f.singleBName;
              return (
                <div
                  key={f.id}
                  onClick={() => canClick && router.push(`/copa/jogo/${f.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: f.status === "LIVE" ? "rgba(250,36,60,.07)" : "var(--surface)",
                    border: `1px solid ${f.status === "LIVE" ? "rgba(250,36,60,.35)" : "var(--divider)"}`,
                    cursor: canClick ? "pointer" : "default",
                  }}
                >
                  {artA && <CopaArtistAvatar {...artA} coverUrl={f.singleACover} size={26} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{artA?.artistName}</div>
                    {singleA && <div style={{ fontSize: 10, color: "var(--text-disabled)" }}>"{singleA}"</div>}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, padding: "0 8px", flexShrink: 0, color: f.status === "UPCOMING" ? "var(--text-muted)" : "var(--text)" }}>
                    {f.status === "UPCOMING" ? "— vs —" : `${f.goalsA} — ${f.goalsB}`}
                  </span>
                  <div style={{ flex: 1, textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{artB?.artistName}</div>
                    {singleB && <div style={{ fontSize: 10, color: "var(--text-disabled)" }}>"{singleB}"</div>}
                  </div>
                  {artB && <CopaArtistAvatar {...artB} coverUrl={f.singleBCover} size={26} />}
                  <StatusBadge status={f.status} round={f.round} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </div>
  );
}
