"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CopaArtistAvatar } from "../CopaArtistAvatar";

type ArtistSlot = {
  artistName: string;
  artistImage: string | null;
  artistColor: string;
  artistInitials: string;
};

type Game = {
  id: string;
  phase: string;
  groupLetter: string | null;
  round: number | null;
  singleAName: string;
  singleBName: string;
  votesA: number;
  votesB: number;
  goalsA: number;
  goalsB: number;
  myVote: "A" | "B" | null;
  artistA: ArtistSlot;
  artistB: ArtistSlot;
};

const PHASE_LABELS: Record<string, string> = {
  R16: "Oitavas de Final",
  QF: "Quartas de Final",
  SF: "Semifinal",
  THIRD_PLACE: "Disputa pelo 3º Lugar",
  FINAL: "Final",
};

function phaseLabel(g: Game): string {
  if (g.phase === "GROUP") return `Grupo ${g.groupLetter} · Rodada ${g.round} de 3`;
  return PHASE_LABELS[g.phase] ?? g.phase;
}

function GameCard({ g, onClick }: { g: Game; onClick: () => void }) {
  const total = g.votesA + g.votesB || 1;
  const pctA = (g.votesA / total) * 100;
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: "1px solid rgba(250,36,60,.35)",
        borderRadius: 14,
        padding: "14px 16px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {phaseLabel(g)}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, background: "rgba(250,36,60,.13)", color: "#FA243C", padding: "3px 9px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#FA243C", display: "inline-block", animation: "pulse 1.4s ease-in-out infinite" }} />
          Ao Vivo
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Artista A */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <CopaArtistAvatar {...g.artistA} size={48} />
          <div style={{ fontSize: 14, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{g.artistA.artistName}</div>
          {g.singleAName && <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.25 }}>&quot;{g.singleAName}&quot;</div>}
        </div>

        {/* Placar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: g.goalsA >= g.goalsB ? "var(--text)" : "var(--text-muted)" }}>{g.goalsA}</span>
            <span style={{ fontSize: 18, color: "var(--text-disabled)" }}>—</span>
            <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: g.goalsB >= g.goalsA ? "var(--text)" : "var(--text-muted)" }}>{g.goalsB}</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginTop: 4 }}>{g.votesA} × {g.votesB} votos</div>
        </div>

        {/* Artista B */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <CopaArtistAvatar {...g.artistB} size={48} />
          <div style={{ fontSize: 14, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{g.artistB.artistName}</div>
          {g.singleBName && <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.25 }}>&quot;{g.singleBName}&quot;</div>}
        </div>
      </div>

      {/* Barra de votos */}
      <div style={{ height: 5, background: "var(--fill-inset)", borderRadius: 3, overflow: "hidden", marginTop: 12 }}>
        <div style={{ height: "100%", width: `${pctA}%`, background: `linear-gradient(90deg, ${g.artistA.artistColor}, ${g.artistB.artistColor})`, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>

      <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, fontWeight: 700, color: g.myVote ? "#34C759" : "#FFD426" }}>
        {g.myVote
          ? `✓ Você votou em ${g.myVote === "A" ? g.artistA.artistName : g.artistB.artistName}`
          : "Toque para votar →"}
      </div>
    </div>
  );
}

export function LiveClient({ games }: { games: Game[] }) {
  const router = useRouter();

  // Atualiza o placar ao vivo a cada 10s.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div style={{ padding: "20px 16px 28px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", margin: "0 8px 4px" }}>Jogos de Hoje</h1>
      <div style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 8px 18px" }}>
        Votação aberta nos jogos Ao vivo do dia
      </div>

      {games.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14, padding: "40px 24px", background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 14 }}>
          ⏳ Nenhum jogo ao vivo agora.<br />
          <span style={{ fontSize: 12, color: "var(--text-disabled)" }}>Os jogos do dia abrem no horário definido.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {games.map((g) => (
            <GameCard key={g.id} g={g} onClick={() => router.push(`/copa/jogo/${g.id}`)} />
          ))}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
    </div>
  );
}
