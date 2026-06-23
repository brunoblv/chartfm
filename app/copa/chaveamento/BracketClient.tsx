"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopaArtistAvatar } from "../CopaArtistAvatar";

type ArtistSlot = {
  id: string;
  ownerId: string;
  artistName: string;
  artistImage: string | null;
  artistColor: string;
  artistInitials: string;
} | null;

type BracketFixture = {
  id: string;
  phase: string;
  matchIndex: number;
  status: string;
  votesA: number;
  votesB: number;
  goalsA: number;
  goalsB: number;
  myVote: "A" | "B" | null;
  artistA: ArtistSlot;
  artistB: ArtistSlot;
};

type Props = {
  copaId: string;
  userId: string | null;
  fixtures: BracketFixture[];
};

const PHASE_ORDER = ["R16", "QF", "SF", "FINAL", "THIRD_PLACE"];
const PHASE_LABELS: Record<string, string> = {
  R16: "Oitavas de Final",
  QF: "Quartas de Final",
  SF: "Semi-Finais",
  FINAL: "Final",
  THIRD_PLACE: "Disputa pelo 3º Lugar",
};

function TBDSlot() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--fill-inset)", flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: "var(--text-disabled)" }}>A definir</span>
      <span style={{ fontSize: 13, color: "var(--text-disabled)", fontWeight: 700 }}>—</span>
    </div>
  );
}

function BracketMatch({ f, userId, onClick }: { f: BracketFixture; userId: string | null; onClick: () => void }) {
  const canClick = f.status === "LIVE" || f.status === "DONE";
  const isDone = f.status === "DONE";
  // Desempate visual: gols → votos (a prorrogação). O critério do Global 100
  // (pênaltis) é raríssimo e não vem nos dados do chaveamento; nesse caso o
  // destaque fica neutro, mas a fase seguinte já mostra quem avançou.
  const winnerSide = isDone
    ? f.goalsA > f.goalsB ? "A"
      : f.goalsB > f.goalsA ? "B"
      : f.votesA > f.votesB ? "A"
      : f.votesB > f.votesA ? "B"
      : null
    : null;

  function Slot({ art, goals, side }: { art: ArtistSlot; goals: number; side: "A" | "B" }) {
    const isWinner = winnerSide === side;
    const isLoser = winnerSide && winnerSide !== side;
    const isMe = art?.ownerId === userId;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 12px",
          opacity: isLoser ? 0.45 : 1,
        }}
      >
        {art ? (
          <CopaArtistAvatar {...art} size={22} />
        ) : (
          <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--fill-inset)", flexShrink: 0 }} />
        )}
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: isMe ? "#FFD426" : isWinner ? "var(--text)" : "var(--text-muted)",
          }}
        >
          {art ? art.artistName.split(" ")[0] : "A definir"}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: isWinner ? "var(--text)" : "var(--text-muted)" }}>
          {isDone ? goals : "—"}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={canClick ? onClick : undefined}
      style={{
        background: "var(--surface)",
        border: `1px solid ${f.status === "LIVE" ? "rgba(250,36,60,.35)" : "var(--divider)"}`,
        borderRadius: 10,
        overflow: "hidden",
        cursor: canClick ? "pointer" : "default",
        transition: "0.12s",
      }}
    >
      <Slot art={f.artistA} goals={f.goalsA} side="A" />
      <div style={{ height: 1, background: "var(--divider)" }} />
      <Slot art={f.artistB} goals={f.goalsB} side="B" />
      {f.status === "LIVE" && (
        <div style={{ padding: "4px 12px", background: "rgba(250,36,60,.08)", fontSize: 10, fontWeight: 700, color: "#FA243C", textAlign: "center", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Ao vivo
        </div>
      )}
    </div>
  );
}

export function BracketClient({ copaId, userId, fixtures }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState("R16");
  const tabs = PHASE_ORDER.filter(
    (p) => p === "R16" || fixtures.some((f) => f.phase === p),
  );
  // Also show all tabs for navigation even if no fixtures yet
  const allTabs = PHASE_ORDER;

  const phaseFixtures = fixtures.filter((f) => f.phase === phase);

  return (
    <div>
      <div style={{ padding: "24px 24px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", margin: 0 }}>Chaveamento</h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>
          Fase eliminatória da Copa ChartFM
        </div>
      </div>

      {/* Phase tabs */}
      <div style={{ display: "flex", gap: 6, padding: "14px 24px 0", flexWrap: "wrap" }}>
        {allTabs.map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            style={{
              padding: "8px 15px",
              borderRadius: 99,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              transition: "0.12s",
              background: phase === p ? "#FFD426" : "var(--fill-inset)",
              color: phase === p ? "#000" : "var(--text-muted)",
            }}
          >
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>

      <div style={{ padding: "14px 24px 24px" }}>
        {phaseFixtures.length === 0 ? (
          <div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 12, padding: "16px", marginBottom: 12 }}>
              ⏳ Esta fase começa após a conclusão das fases anteriores
            </div>
            {/* Show placeholder bracket */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {Array.from({ length: phase === "R16" ? 16 : phase === "QF" ? 8 : phase === "SF" ? 4 : 2 }).map((_, i) => (
                <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 10, overflow: "hidden", opacity: 0.4 }}>
                  <TBDSlot /><div style={{ height: 1, background: "var(--divider)" }} /><TBDSlot />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              Artistas em <span style={{ color: "#FFD426", fontWeight: 700 }}>dourado</span> pertencem ao seu time
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {phaseFixtures
                .filter((f) => f.phase !== "THIRD_PLACE")
                .map((f) => (
                  <BracketMatch
                    key={f.id}
                    f={f}
                    userId={userId}
                    onClick={() => router.push(`/copa/jogo/${f.id}`)}
                  />
                ))}
            </div>
            {/* 3rd place match */}
            {phase === "FINAL" && (() => {
              const third = fixtures.find((f) => f.phase === "THIRD_PLACE");
              return third ? (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)", margin: "16px 0 8px" }}>
                    Disputa pelo 3º Lugar
                  </div>
                  <div style={{ maxWidth: 280 }}>
                    <BracketMatch f={third} userId={userId} onClick={() => router.push(`/copa/jogo/${third.id}`)} />
                  </div>
                </div>
              ) : null;
            })()}
          </>
        )}
      </div>
    </div>
  );
}
