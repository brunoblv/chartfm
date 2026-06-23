"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CopaArtistAvatar } from "../../CopaArtistAvatar";
import { CopaBannerCarousel } from "../../CopaBannerCarousel";

type ArtistInfo = {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerHandle: string;
  groupLetter: string;
  artistName: string;
  artistImage: string | null;
  artistColor: string;
  artistInitials: string;
};

type FixtureInfo = {
  id: string;
  copaId: string;
  phase: string;
  groupLetter: string | null;
  round: number | null;
  matchIndex: number;
  status: string;
  singleAIdx: number;
  singleBIdx: number;
  singleAName: string;
  singleBName: string;
  votesA: number;
  votesB: number;
  goalsA: number;
  goalsB: number;
  myVote: "A" | "B" | null;
  artistA: ArtistInfo;
  artistB: ArtistInfo;
};

type Props = {
  fixture: FixtureInfo;
  userId: string | null;
};

function LiveDot() {
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "#FA243C",
        display: "inline-block",
        animation: "pulse 1.4s ease-in-out infinite",
        marginRight: 5,
      }}
    />
  );
}

function GoalOverlay({ name, onDone }: { name: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        pointerEvents: "none",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 72, animation: "goalPop .5s cubic-bezier(.34,1.56,.64,1) both" }}>⚽</div>
      <div
        style={{
          fontSize: 40,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          color: "#fff",
          textShadow: "0 4px 20px rgba(0,0,0,.6)",
          animation: "fadeUp .3s .12s both",
        }}
      >
        GOL de {name}!
      </div>
    </div>
  );
}

export function MatchClient({ fixture: init, userId }: Props) {
  const router = useRouter();
  const [data, setData] = useState(init);
  const [myVote, setMyVote] = useState(init.myVote);
  const [goalSide, setGoalSide] = useState<"A" | "B" | null>(null);
  const [voting, setVoting] = useState(false);

  const isLive = data.status === "LIVE";
  const canVote = isLive && !myVote && !!userId;

  // Poll for live updates every 5s
  const fetchUpdates = useCallback(async () => {
    if (data.status !== "LIVE") return;
    try {
      const res = await fetch(`/api/copa/${data.copaId}/fixtures/${data.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json.fixture) {
        setData((prev) => ({
          ...prev,
          votesA: json.fixture.votesA,
          votesB: json.fixture.votesB,
          goalsA: json.fixture.goalsA,
          goalsB: json.fixture.goalsB,
          status: json.fixture.status,
        }));
        if (json.fixture.myVote && !myVote) setMyVote(json.fixture.myVote);
      }
    } catch {}
  }, [data.copaId, data.id, data.status, myVote]);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(fetchUpdates, 5000);
    return () => clearInterval(interval);
  }, [isLive, fetchUpdates]);

  async function castVote(side: "A" | "B") {
    if (!canVote || voting) return;
    const prevGoals = { A: data.goalsA, B: data.goalsB };
    setVoting(true);
    try {
      const res = await fetch(`/api/copa/${data.copaId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId: data.id, side }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setMyVote(side);
      const newGoals = { A: json.goalsA, B: json.goalsB };
      setData((prev) => ({ ...prev, votesA: json.votesA, votesB: json.votesB, goalsA: json.goalsA, goalsB: json.goalsB }));
      if (newGoals[side] > prevGoals[side]) setGoalSide(side);
    } finally {
      setVoting(false);
    }
  }

  const total = data.votesA + data.votesB || 1;
  const pctA = (data.votesA / total) * 100;
  const phaseLabels: Record<string, string> = {
    GROUP: `GRUPO ${data.groupLetter} · RODADA ${data.round} de 3`,
    R16: "OITAVAS DE FINAL",
    QF: "QUARTAS DE FINAL",
    SF: "SEMI-FINAL",
    THIRD_PLACE: "DISPUTA PELO 3º LUGAR",
    FINAL: "FINAL",
  };

  return (
    <div>
      {/* Banner carousel */}
      <CopaBannerCarousel />

      {/* Back */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 24px 0" }}>
        <button
          onClick={() => router.back()}
          style={{
            background: "var(--fill-inset)",
            border: "none",
            color: "var(--text)",
            fontSize: 13,
            fontWeight: 700,
            padding: "8px 14px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          ← Voltar
        </button>
        {isLive ? (
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, background: "rgba(250,36,60,.13)", color: "#FA243C", padding: "3px 9px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <LiveDot />AO VIVO
          </span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, background: "var(--fill-inset)", color: "var(--text-muted)", padding: "3px 9px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {data.status === "DONE" ? "Encerrado" : "Em breve"}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--text-disabled)" }}>
          {phaseLabels[data.phase] ?? data.phase}
        </span>
      </div>

      <div style={{ padding: "16px 24px" }}>
        {/* VS Panel */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--divider)",
            borderRadius: 20,
            padding: "24px 18px",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Artist A */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
              <CopaArtistAvatar {...data.artistA} size={68} />
              <div style={{ fontSize: 16, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{data.artistA.artistName}</div>
              {data.singleAName && <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.25 }}>"{data.singleAName}"</div>}
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{data.artistA.ownerName}</div>
            </div>

            {/* Score */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: 72, fontWeight: 900, letterSpacing: "-0.06em", lineHeight: 1, color: data.goalsA >= data.goalsB ? "var(--text)" : "var(--text-muted)" }}>{data.goalsA}</span>
                <span style={{ fontSize: 40, color: "var(--text-disabled)", margin: "0 8px" }}>—</span>
                <span style={{ fontSize: 72, fontWeight: 900, letterSpacing: "-0.06em", lineHeight: 1, color: data.goalsB >= data.goalsA ? "var(--text)" : "var(--text-muted)" }}>{data.goalsB}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-disabled)" }}>gols (2 votos = 1 gol)</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginTop: 3 }}>{data.votesA} × {data.votesB} votos</div>
            </div>

            {/* Artist B */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
              <CopaArtistAvatar {...data.artistB} size={68} />
              <div style={{ fontSize: 16, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{data.artistB.artistName}</div>
              {data.singleBName && <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.25 }}>"{data.singleBName}"</div>}
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{data.artistB.ownerName}</div>
            </div>
          </div>

          {/* Vote bar */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 6 }}>
            <span style={{ color: data.artistA.artistColor }}>{Math.round(pctA)}% {data.artistA.artistName.split(" ")[0]}</span>
            <span style={{ color: data.artistB.artistColor }}>{Math.round(100 - pctA)}% {data.artistB.artistName.split(" ")[0]}</span>
          </div>
          <div style={{ height: 5, background: "var(--fill-inset)", borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${pctA}%`,
                background: `linear-gradient(90deg, ${data.artistA.artistColor}, ${data.artistB.artistColor})`,
                borderRadius: 3,
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>

        {/* Vote buttons */}
        {isLive && (
          myVote ? (
            <div style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#34C759", padding: 14, background: "rgba(52,199,89,.1)", borderRadius: 12, marginBottom: 14 }}>
              ✓ Voto registrado para {myVote === "A" ? data.artistA.artistName : data.artistB.artistName}!
            </div>
          ) : !userId ? (
            <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", padding: 14, background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 12, marginBottom: 14 }}>
              Entre na sua conta para votar
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              {(["A", "B"] as const).map((side) => {
                const art = side === "A" ? data.artistA : data.artistB;
                const singleName = side === "A" ? data.singleAName : data.singleBName;
                return (
                  <button
                    key={side}
                    onClick={() => castVote(side)}
                    disabled={voting}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      padding: "16px 10px",
                      borderRadius: 14,
                      border: "2px solid var(--divider)",
                      background: "var(--fill-inset)",
                      color: "var(--text)",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: voting ? "not-allowed" : "pointer",
                      opacity: voting ? 0.5 : 1,
                      transition: "0.15s",
                      textAlign: "center",
                    }}
                    onMouseOver={(e) => { if (!voting) { e.currentTarget.style.borderColor = "#FFD426"; e.currentTarget.style.background = "rgba(255,212,38,.08)"; } }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--divider)"; e.currentTarget.style.background = "var(--fill-inset)"; }}
                  >
                    <CopaArtistAvatar {...art} size={36} />
                    <span>Votar em {art.artistName.split(" ")[0]}</span>
                    <span style={{ fontSize: 11, color: "var(--text-disabled)" }}>"{singleName}"</span>
                  </button>
                );
              })}
            </div>
          )
        )}

      </div>

      {goalSide && (
        <GoalOverlay
          name={goalSide === "A" ? data.artistA.artistName.split(" ")[0] : data.artistB.artistName.split(" ")[0]}
          onDone={() => setGoalSide(null)}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes goalPop { 0%{transform:scale(0) rotate(-20deg);opacity:0} 60%{transform:scale(1.15) rotate(6deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  );
}
