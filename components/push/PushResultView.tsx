"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import type { RoundData } from "./push-types";
import { PODIUM_COLORS } from "./push-helpers";
import { TrackCover, RankBadge } from "./PushAtoms";

function RankingsTab({ season }: { season?: number }) {
  const [data, setData] = useState<{ rank: number; handle: string; name: string; points: number; wins: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = season ? `/api/push/rankings?season=${season}` : "/api/push/rankings";
    fetch(url)
      .then((r) => r.json())
      .then((d: { ranking?: typeof data }) => { setData(d.ranking ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [season]);

  if (loading) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Carregando ranking…</div>;
  if (data.length === 0) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Nenhuma rodada concluída ainda.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {data.map((entry) => (
        <Link key={entry.handle} href={`/profile/${entry.handle}`}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--divider)", textDecoration: "none" }}>
          <RankBadge pos={entry.rank} small />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{entry.name}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>@{entry.handle}</div>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", letterSpacing: "-.02em" }}>{entry.points}</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".04em" }}>PTS</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function ResultView({ round }: { round: RoundData }) {
  const [resultTab, setResultTab] = useState<"round" | "season" | "geral">("round");
  const results  = round.results ?? [];
  const myResult = results.find((r) => r.submissionId === round.mySubmission?.id) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ paddingBottom: 14, borderBottom: "1px solid var(--divider)", marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase" as const, marginBottom: 10 }}>
          Resultado · Rodada #{round.number}
        </div>

        {round.mySubmission && myResult && (
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
            <TrackCover imageUrl={round.mySubmission.song.coverUrl} size={46} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{round.mySubmission.song.title}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{round.mySubmission.song.artist}</div>
            </div>
            <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: ".05em", textTransform: "uppercase" as const, marginBottom: 3 }}>Posição</div>
              <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, letterSpacing: "-.03em", color: myResult.rank <= 3 ? PODIUM_COLORS[myResult.rank - 1] : "var(--text)" }}>
                #{myResult.rank}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>+{myResult.totalPoints} pts</div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", background: "var(--fill-subtle)", borderRadius: 10, padding: 3 }}>
          {([ ["round", "Rodada"], ["season", "Temporada"], ["geral", "Geral"] ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setResultTab(id)}
              style={{
                flex: 1, padding: "7px 4px", borderRadius: 8, border: "none",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                background: resultTab === id ? "var(--surface)" : "transparent",
                color: resultTab === id ? "var(--text)" : "var(--text-muted)",
                boxShadow: resultTab === id ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                transition: "background .15s",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {resultTab === "round" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {results.map((r) => {
            const isMe = r.submissionId === round.mySubmission?.id;
            return (
              <div key={r.submissionId} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                background: isMe ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--surface)",
                border: `1px solid ${isMe ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "var(--divider)"}`,
                borderRadius: 12,
              }}>
                <RankBadge pos={r.rank} small />
                <TrackCover imageUrl={r.song.coverUrl} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.song.title}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>@{r.userHandle}</div>
                </div>
                <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: isMe ? "var(--accent)" : "var(--text)", letterSpacing: "-.02em" }}>{r.totalPoints}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".04em" }}>PTS</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {resultTab === "season" && <RankingsTab season={round.season} />}
      {resultTab === "geral" && <RankingsTab />}
    </div>
  );
}

export function NoRoundView() {
  return (
    <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)" }}>
      <Trophy size={40} style={{ opacity: 0.3, marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
      <p style={{ margin: "0 0 16px" }}>Nenhuma rodada ativa no momento.</p>
      <Link href="/push/historico" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
        Ver histórico de rodadas →
      </Link>
    </div>
  );
}
