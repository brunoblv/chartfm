"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopaArtistAvatar } from "../CopaArtistAvatar";
import { knockoutPendingMatchLabels } from "@/lib/copa";

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

const PHASE_ORDER = ["R32", "R16", "QF", "SF", "FINAL", "THIRD_PLACE"];
const PHASE_LABELS: Record<string, string> = {
  R32: "1/16 de Final",
  R16: "Oitavas de Final",
  QF: "Quartas de Final",
  SF: "Semi-Finais",
  FINAL: "Final",
  THIRD_PLACE: "Disputa pelo 3º Lugar",
};

const PHASE_PLACEHOLDER_MATCHES: Record<string, number> = {
  R32: 16, R16: 8, QF: 4, SF: 2, FINAL: 1, THIRD_PLACE: 1,
};

function TBDSlot() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--fill-inset)", flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: "var(--text-disabled)" }}>A definir</span>
      <span style={{ fontSize: 13, color: "var(--text-disabled)", fontWeight: 700 }}>-</span>
    </div>
  );
}

function BracketMatch({
  f,
  userId,
  onClick,
}: {
  f: BracketFixture;
  userId: string | null;
  onClick: () => void;
}) {
  const canClick = f.status === "LIVE" || f.status === "DONE";
  const isDone = f.status === "DONE";
  const isLive = f.status === "LIVE";

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
          {art ? art.artistName : "A definir"}
        </span>
        {/* ✅ Score col — fixed min-width so it stays aligned across all rows */}
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: isWinner ? "var(--text)" : "var(--text-muted)",
            minWidth: 28,
            textAlign: "right",
          }}
        >
          {isDone ? goals : "-"}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={canClick ? onClick : undefined}
      style={{
        background: isLive ? "var(--accent-tint)" : "var(--surface)",
        // ✅ FIX: borda sempre var(--divider), sem linha vermelha no LIVE
        border: "1px solid var(--divider)",
        borderRadius: 10,
        overflow: "hidden",
        cursor: canClick ? "pointer" : "default",
        transition: "0.12s",
      }}
    >
      <Slot art={f.artistA} goals={f.goalsA} side="A" />
      <div style={{ height: 1, background: "var(--divider)" }} />
      <Slot art={f.artistB} goals={f.goalsB} side="B" />
      {isLive && (
        // ✅ FIX: fundo var(--accent-tint) + var(--accent)
        <div
          style={{
            padding: "4px 12px",
            background: "var(--accent-tint)",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--accent)",
            textAlign: "center",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Ao vivo
        </div>
      )}
    </div>
  );
}

export function BracketClient({ copaId, userId, fixtures }: Props) {
  const router = useRouter();
  const initialPhase =
    fixtures.find((f) => f.status === "LIVE")?.phase ??
    fixtures.find((f) => f.status === "UPCOMING")?.phase ??
    "R32";
  const [phase, setPhase] = useState(initialPhase);

  const phaseFixtures = fixtures.filter((f) => f.phase === phase);

  function pendingPhaseMessage(p: string): string {
    if (p === "R16") {
      const r32 = fixtures.filter((f) => f.phase === "R32");
      if (r32.length === 0) return "Aguardando o fim da fase de grupos.";
      if (!r32.every((f) => f.status === "DONE"))
        return "As oitavas serão montadas automaticamente quando o 1/16 de Final encerrar.";
    }
    if (p === "QF") {
      const r16 = fixtures.filter((f) => f.phase === "R16");
      if (r16.length === 0 || !r16.every((f) => f.status === "DONE"))
        return "As quartas serão formadas pelos vencedores das oitavas.";
    }
    if (p === "SF") {
      const qf = fixtures.filter((f) => f.phase === "QF");
      if (qf.length === 0 || !qf.every((f) => f.status === "DONE"))
        return "As semifinais serão formadas pelos vencedores das quartas.";
    }
    if (p === "FINAL") {
      const sf = fixtures.filter((f) => f.phase === "SF");
      if (sf.length === 0 || !sf.every((f) => f.status === "DONE"))
        return "A final será formada pelos vencedores das semifinais.";
    }
    return "Esta fase começa após a conclusão das fases anteriores.";
  }

  const pendingLabels = knockoutPendingMatchLabels(phase);

  return (
    <div>
      <div style={{ padding: "24px 24px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", margin: 0 }}>
          Chaveamento
        </h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>
          Fase eliminatória da Copa ChartFM
        </div>
      </div>

      {/* Phase tabs */}
      <div style={{ display: "flex", gap: 6, padding: "14px 24px 0", flexWrap: "wrap" }}>
        {PHASE_ORDER.map((p) => (
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
              // ✅ FIX: ativo usa var(--accent) + #fff em vez de #FFD426 + #000
              background: phase === p ? "var(--accent)" : "var(--fill-inset)",
              color: phase === p ? "#fff" : "var(--text-muted)",
            }}
          >
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>

      <div style={{ padding: "14px 24px 24px" }}>
        {phaseFixtures.length === 0 ? (
          <div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                background: "var(--surface)",
                border: "1px solid var(--divider)",
                borderRadius: 12,
                padding: "16px",
                marginBottom: 12,
              }}
            >
              ⏳ {pendingPhaseMessage(phase)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {(
                pendingLabels.length > 0
                  ? pendingLabels
                  : Array.from({ length: PHASE_PLACEHOLDER_MATCHES[phase] ?? 2 }).map(() => null)
              ).map((label, i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--divider)",
                    borderRadius: 10,
                    overflow: "hidden",
                    opacity: 0.55,
                  }}
                >
                  {label && (
                    <div
                      style={{
                        padding: "8px 12px",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        borderBottom: "1px solid var(--divider)",
                      }}
                    >
                      {label}
                    </div>
                  )}
                  <TBDSlot />
                  <div style={{ height: 1, background: "var(--divider)" }} />
                  <TBDSlot />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              Artistas em{" "}
              <span style={{ color: "#FFD426", fontWeight: 700 }}>dourado</span> pertencem ao seu
              time
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
            {phase === "FINAL" &&
              (() => {
                const third = fixtures.find((f) => f.phase === "THIRD_PLACE");
                return third ? (
                  <div style={{ marginTop: 16 }}>
                    {/* ✅ FIX: var(--text-muted) */}
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        margin: "16px 0 8px",
                      }}
                    >
                      Disputa pelo 3º Lugar
                    </div>
                    <div style={{ maxWidth: 280 }}>
                      <BracketMatch
                        f={third}
                        userId={userId}
                        onClick={() => router.push(`/copa/jogo/${third.id}`)}
                      />
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
