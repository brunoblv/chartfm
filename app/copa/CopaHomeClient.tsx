"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopaArtistAvatar } from "./CopaArtistAvatar";

type SimpleFixture = {
  id: string;
  phase: string;
  groupLetter: string | null;
  round: number | null;
  matchIndex?: number;
  status: string;
  votesA: number;
  votesB: number;
  goalsA: number;
  goalsB: number;
  myVote: "A" | "B" | null;
  singleAName: string;
  singleBName: string;
  singleACover?: string | null;
  singleBCover?: string | null;
  artistA: { id: string; artistName: string; artistImage: string | null; artistColor: string; artistInitials: string; ownerId: string; groupLetter: string };
  artistB: { id: string; artistName: string; artistImage: string | null; artistColor: string; artistInitials: string; ownerId: string; groupLetter: string };
};

type Props = {
  copa: { id: string; name: string; year: number; status: string; maxParticipants: number; isParticipant: boolean; participants: { userId: string; name: string; handle: string; avatarColor: string }[] };
  userId: string | null;
  liveFixture: SimpleFixture | null;
  liveCount: number;
  recentDone: SimpleFixture[];
  upcoming: SimpleFixture | null;
  myArtists: { id: string; artistName: string; artistImage: string | null; artistColor: string; artistInitials: string; groupLetter: string; standingRank: number }[];
};

const FIXTURE_PHASE_LABELS: Record<string, string> = {
  R32: "1/16 de Final",
  R16: "Oitavas de Final",
  QF: "Quartas de Final",
  SF: "Semifinal",
  FINAL: "Final",
  THIRD_PLACE: "Disputa pelo 3º Lugar",
};

function fixtureContextLabel(f: SimpleFixture): string {
  if (f.phase === "GROUP") return `Grupo ${f.groupLetter} · Rodada ${f.round} de 3`;
  return FIXTURE_PHASE_LABELS[f.phase] ?? f.phase;
}

function livePhaseSummary(liveFixture: SimpleFixture | null, liveCount: number): string | null {
  if (!liveFixture || liveCount === 0) return null;
  const phase = FIXTURE_PHASE_LABELS[liveFixture.phase] ?? liveFixture.phase;
  if (liveCount === 1) return `${phase} ao vivo agora`;
  return `${liveCount} jogos ao vivo · ${phase}`;
}

function LiveDot() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "#FA243C",
        animation: "pulse 1.4s ease-in-out infinite",
        marginRight: 5,
      }}
    />
  );
}

function Badge({ children, variant }: { children: React.ReactNode; variant: "live" | "done" | "next" }) {
  const styles: Record<string, React.CSSProperties> = {
    live: { background: "rgba(250,36,60,.13)", color: "#FA243C" },
    done: { background: "var(--fill-inset)", color: "var(--text-muted)" },
    next: { background: "var(--fill-inset)", color: "var(--text-disabled)" },
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 99,
        ...styles[variant],
      }}
    >
      {variant === "live" && <LiveDot />}
      {children}
    </span>
  );
}

function ScoreRow({ f }: { f: SimpleFixture }) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(`/copa/jogo/${f.id}`)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 10,
        background: "var(--surface)",
        border: `1px solid ${f.status === "LIVE" ? "rgba(250,36,60,.35)" : "var(--divider)"}`,
        cursor: "pointer",
        marginBottom: 6,
      }}
    >
      <CopaArtistAvatar {...f.artistA} coverUrl={f.singleACover} size={26} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.artistA.artistName}</span>
      <span style={{ fontSize: 14, fontWeight: 800, padding: "0 8px", flexShrink: 0 }}>
        {f.goalsA}–{f.goalsB}
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.artistB.artistName}</span>
      <CopaArtistAvatar {...f.artistB} coverUrl={f.singleBCover} size={26} />
      {f.status === "LIVE" ? <Badge variant="live">Ao vivo</Badge> : <Badge variant="done">R{f.round}</Badge>}
    </div>
  );
}

export function CopaHomeClient({ copa, userId, liveFixture, liveCount, recentDone, upcoming, myArtists }: Props) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);

  const isFull = copa.participants.length >= copa.maxParticipants;

  async function join() {
    if (joining) return;
    if (!userId) {
      router.push("/login");
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/copa/${copa.id}/join`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Erro ao se inscrever");
        return;
      }
      router.push("/copa/meu-time");
    } finally {
      setJoining(false);
    }
  }

  const phaseLabel: Record<string, string> = {
    REGISTRATION: "Fase de Inscrições",
    GROUP_STAGE: "Fase de Grupos",
    KNOCKOUT: "Fase Eliminatória",
    FINISHED: "Encerrado",
  };

  return (
    <div style={{ padding: "24px 24px 0" }}>
      {/* Banner */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", margin: 0 }}>
          {copa.name} <span style={{ color: "#FFD426" }}>{copa.year}</span>
        </h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          🏆 {phaseLabel[copa.status] ?? copa.status}
          {livePhaseSummary(liveFixture, liveCount) && ` · ${livePhaseSummary(liveFixture, liveCount)}`}
        </div>
      </div>

      {/* Live hero */}
      {liveFixture && (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)", marginBottom: 10 }}>
            Ao vivo agora
          </p>
          <div
            onClick={() => router.push(`/copa/jogo/${liveFixture.id}`)}
            style={{
              background: "linear-gradient(135deg, rgba(250,36,60,.1), rgba(255,255,255,.03))",
              border: "1px solid rgba(250,36,60,.35)",
              borderRadius: 16,
              padding: 18,
              marginBottom: 20,
              cursor: "pointer",
              transition: "transform 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Badge variant="live">Ao vivo</Badge>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-disabled)" }}>
                {fixtureContextLabel(liveFixture).toUpperCase()}
                {liveCount > 1 ? ` · +${liveCount - 1} jogos` : ""}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <CopaArtistAvatar {...liveFixture.artistA} coverUrl={liveFixture.singleACover} size={56} />
                <div style={{ fontSize: 14, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{liveFixture.artistA.artistName}</div>
                <div style={{ fontSize: 11, color: "var(--text-disabled)", textAlign: "center" }}>"{liveFixture.singleAName}"</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.05em" }}>{liveFixture.goalsA}</span>
                  <span style={{ fontSize: 26, color: "var(--text-disabled)", margin: "0 8px" }}>—</span>
                  <span style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.05em" }}>{liveFixture.goalsB}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{liveFixture.votesA} × {liveFixture.votesB} votos</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <CopaArtistAvatar {...liveFixture.artistB} coverUrl={liveFixture.singleBCover} size={56} />
                <div style={{ fontSize: 14, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{liveFixture.artistB.artistName}</div>
                <div style={{ fontSize: 11, color: "var(--text-disabled)", textAlign: "center" }}>"{liveFixture.singleBName}"</div>
              </div>
            </div>
            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: "#FA243C", textAlign: "center" }}>
              {liveCount > 1 ? (
                <span onClick={(e) => { e.stopPropagation(); router.push("/copa/ao-vivo"); }}>
                  Ver todos os {liveCount} jogos →
                </span>
              ) : (
                "Toque para votar →"
              )}
            </div>
          </div>
        </>
      )}

      {/* Registration state */}
      {copa.status === "REGISTRATION" && !liveFixture && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--divider)",
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚽</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Inscrições abertas</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
            {copa.participants.length}/{copa.maxParticipants} participante{copa.participants.length !== 1 ? "s" : ""}
            {copa.isParticipant ? " · Cadastre seus 8 artistas" : " · Inscreva-se e monte seu time"}
          </div>
          {copa.isParticipant ? (
            <button
              onClick={() => router.push("/copa/meu-time")}
              style={{
                background: "#FFD426",
                color: "#000",
                border: "none",
                padding: "10px 20px",
                borderRadius: 99,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Ir para Meu Time →
            </button>
          ) : (
            <button
              onClick={join}
              disabled={joining || (isFull && !!userId)}
              style={{
                background: isFull ? "var(--fill-inset)" : "#FFD426",
                color: isFull ? "var(--text-muted)" : "#000",
                border: "none",
                padding: "10px 20px",
                borderRadius: 99,
                fontSize: 14,
                fontWeight: 700,
                cursor: joining || isFull ? "default" : "pointer",
                opacity: joining ? 0.6 : 1,
              }}
            >
              {isFull ? "Vagas esgotadas" : joining ? "Inscrevendo…" : "Inscrever-se na Copa →"}
            </button>
          )}
        </div>
      )}

      {/* My squad mini */}
      {myArtists.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)", marginBottom: 10 }}>
            Meu time
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {myArtists.map((art) => {
              const drawn = art.groupLetter !== "?";
              const qual = drawn && (art.standingRank === 0 || art.standingRank === 1);
              return (
                <div
                  key={art.id}
                  onClick={() => router.push("/copa/meu-time")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    background: "var(--surface)",
                    border: `1px solid ${qual ? "rgba(52,199,89,.35)" : "var(--divider)"}`,
                    borderRadius: 12,
                    padding: "12px 10px",
                    cursor: "pointer",
                    minWidth: 76,
                  }}
                >
                  <CopaArtistAvatar {...art} size={38} />
                  <div style={{ fontSize: 11, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>
                    {art.artistName.split(" ")[0]}
                  </div>
                  {drawn && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>GRP {art.groupLetter}</div>}
                  {qual && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#34C759", background: "rgba(52,199,89,.12)", padding: "2px 7px", borderRadius: 99 }}>
                      ✓ CLASSIF.
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Upcoming */}
      {upcoming && (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)", marginBottom: 10 }}>
            Próximo jogo
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px",
              borderRadius: 12,
              background: "var(--surface)",
              border: "1px solid var(--divider)",
              marginBottom: 20,
            }}
          >
            <CopaArtistAvatar {...upcoming.artistA} coverUrl={upcoming.singleACover} size={32} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{upcoming.artistA.artistName}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>vs</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, textAlign: "right" }}>{upcoming.artistB.artistName}</span>
            <CopaArtistAvatar {...upcoming.artistB} coverUrl={upcoming.singleBCover} size={32} />
            <Badge variant="next">GRP {upcoming.groupLetter} R{upcoming.round}</Badge>
          </div>
        </>
      )}

      {/* Recent results */}
      {recentDone.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)", marginBottom: 10 }}>
            Resultados recentes
          </p>
          {recentDone.map((f) => (
            <ScoreRow key={f.id} f={f} />
          ))}
        </>
      )}

      {/* Participants */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-disabled)", marginBottom: 10, marginTop: 24 }}>
        Participantes
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingBottom: 32 }}>
        {copa.participants.map((p) => (
          <div
            key={p.userId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "var(--surface)",
              border: "1px solid var(--divider)",
              borderRadius: 99,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: p.avatarColor,
                display: "grid",
                placeItems: "center",
                fontSize: 10,
                fontWeight: 800,
                color: "#fff",
              }}
            >
              {p.name[0]}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</span>
            {p.userId === userId && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#FFD426" }}>você</span>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </div>
  );
}
