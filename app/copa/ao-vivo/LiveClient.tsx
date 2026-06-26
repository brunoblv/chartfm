"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  singleACover: string | null;
  singleBCover: string | null;
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

/* ----------------------------- Goal overlay ----------------------------- */

function GoalOverlay({ name, onDone }: { name: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500);
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
          fontSize: 38,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          color: "#fff",
          textShadow: "0 4px 20px rgba(0,0,0,.6)",
          animation: "fadeUp .3s .12s both",
          textAlign: "center",
        }}
      >
        GOL de {name}!
      </div>
    </div>
  );
}

/* --------------------------- Voting arena card --------------------------- */

type VoteArenaProps = {
  game: Game;
  copaId: string;
  position: number;
  total: number;
  onResult: (g: Game) => void;
  onAdvance: () => void;
};

const ADVANCE_DELAY = 900;

function VoteArena({ game, copaId, position, total, onResult, onAdvance }: VoteArenaProps) {
  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState<"A" | "B" | null>(null);
  const [goalName, setGoalName] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  const totalVotes = game.votesA + game.votesB || 1;
  const pctA = (game.votesA / totalVotes) * 100;

  async function castVote(side: "A" | "B") {
    if (voting || voted) return;
    setVoting(true);
    const prevGoals = { A: game.goalsA, B: game.goalsB };
    try {
      const res = await fetch(`/api/copa/${copaId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId: game.id, side }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      onResult({
        ...game,
        votesA: json.votesA,
        votesB: json.votesB,
        goalsA: json.goalsA,
        goalsB: json.goalsB,
        myVote: side,
      });
      setVoted(side);
      const scoredGoal = json[side === "A" ? "goalsA" : "goalsB"] > prevGoals[side];
      if (scoredGoal) {
        // O overlay do gol dispara o avanço ao terminar.
        setGoalName((side === "A" ? game.artistA : game.artistB).artistName.split(" ")[0]);
      } else {
        advanceTimer.current = setTimeout(onAdvance, ADVANCE_DELAY);
      }
    } catch {
      setVoting(false);
    }
  }

  return (
    <div>
      {/* Progresso */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 8px 12px" }}>
        <div style={{ display: "flex", gap: 5, flex: 1, flexWrap: "wrap" }}>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              style={{
                height: 4,
                flex: "1 1 12px",
                minWidth: 12,
                borderRadius: 2,
                background: i < position ? "#34C759" : i === position ? "#FA243C" : "var(--fill-inset)",
                transition: "background 0.3s ease",
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-disabled)", flexShrink: 0 }}>
          {position + 1} / {total}
        </span>
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid rgba(250,36,60,.35)",
          borderRadius: 20,
          padding: "20px 18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {phaseLabel(game)}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, background: "rgba(250,36,60,.13)", color: "#FA243C", padding: "3px 9px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#FA243C", display: "inline-block", animation: "pulse 1.4s ease-in-out infinite" }} />
            Ao Vivo
          </span>
        </div>

        {/* VS */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <CopaArtistAvatar {...game.artistA} coverUrl={game.singleACover} size={64} />
            <div style={{ fontSize: 15, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{game.artistA.artistName}</div>
            {game.singleAName && <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.25 }}>&quot;{game.singleAName}&quot;</div>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: game.goalsA >= game.goalsB ? "var(--text)" : "var(--text-muted)" }}>{game.goalsA}</span>
              <span style={{ fontSize: 20, color: "var(--text-disabled)" }}>—</span>
              <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: game.goalsB >= game.goalsA ? "var(--text)" : "var(--text-muted)" }}>{game.goalsB}</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginTop: 4 }}>{game.votesA} × {game.votesB} votos</div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <CopaArtistAvatar {...game.artistB} coverUrl={game.singleBCover} size={64} />
            <div style={{ fontSize: 15, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{game.artistB.artistName}</div>
            {game.singleBName && <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.25 }}>&quot;{game.singleBName}&quot;</div>}
          </div>
        </div>

        {/* Barra */}
        <div style={{ height: 5, background: "var(--fill-inset)", borderRadius: 3, overflow: "hidden", marginTop: 16 }}>
          <div style={{ height: "100%", width: `${pctA}%`, background: `linear-gradient(90deg, ${game.artistA.artistColor}, ${game.artistB.artistColor})`, borderRadius: 3, transition: "width 0.5s ease" }} />
        </div>

        {/* Botões de voto / confirmação */}
        {voted ? (
          <div style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#34C759", padding: 14, background: "rgba(52,199,89,.1)", borderRadius: 12, marginTop: 16 }}>
            ✓ Voto registrado para {(voted === "A" ? game.artistA : game.artistB).artistName}!
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            {(["A", "B"] as const).map((side) => {
              const art = side === "A" ? game.artistA : game.artistB;
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
                    gap: 6,
                    padding: "14px 10px",
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
                  <CopaArtistAvatar {...art} coverUrl={side === "A" ? game.singleACover : game.singleBCover} size={34} />
                  <span>Votar em {art.artistName.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!voted && (
        <button
          onClick={onAdvance}
          style={{
            display: "block",
            margin: "12px auto 0",
            background: "none",
            border: "none",
            color: "var(--text-disabled)",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            padding: "6px 12px",
          }}
        >
          Pular esta disputa →
        </button>
      )}

      {goalName && <GoalOverlay name={goalName} onDone={onAdvance} />}
    </div>
  );
}

/* ------------------------------ Result card ------------------------------ */

function ResultCard({ g, onClick }: { g: Game; onClick: () => void }) {
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <CopaArtistAvatar {...g.artistA} coverUrl={g.singleACover} size={48} />
          <div style={{ fontSize: 14, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{g.artistA.artistName}</div>
          {g.singleAName && <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.25 }}>&quot;{g.singleAName}&quot;</div>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: g.goalsA >= g.goalsB ? "var(--text)" : "var(--text-muted)" }}>{g.goalsA}</span>
            <span style={{ fontSize: 18, color: "var(--text-disabled)" }}>—</span>
            <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: g.goalsB >= g.goalsA ? "var(--text)" : "var(--text-muted)" }}>{g.goalsB}</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginTop: 4 }}>{g.votesA} × {g.votesB} votos</div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <CopaArtistAvatar {...g.artistB} coverUrl={g.singleBCover} size={48} />
          <div style={{ fontSize: 14, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{g.artistB.artistName}</div>
          {g.singleBName && <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.25 }}>&quot;{g.singleBName}&quot;</div>}
        </div>
      </div>

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

/* ----------------------------- Playlist links ---------------------------- */

type DayPlaylists = {
  dayLabel: string;
  spotifyUrl: string | null;
  youtubeUrl: string | null;
};

function PlaylistLinks({ playlists }: { playlists: DayPlaylists }) {
  if (!playlists.spotifyUrl && !playlists.youtubeUrl) return null;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid rgba(250,36,60,.35)",
        borderRadius: 14,
        padding: "12px 14px",
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        🎧 Playlist dos jogos de hoje
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {playlists.spotifyUrl && (
          <a
            href={playlists.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#fff", background: "#1DB954", padding: "8px 14px", borderRadius: 99, textDecoration: "none" }}
          >
            Ouvir no Spotify
          </a>
        )}
        {playlists.youtubeUrl && (
          <a
            href={playlists.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#fff", background: "#FF0000", padding: "8px 14px", borderRadius: 99, textDecoration: "none" }}
          >
            Ver no YouTube
          </a>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- LiveClient ------------------------------ */

export function LiveClient({
  games,
  playlists,
  copaId,
  userId,
}: {
  games: Game[];
  playlists: DayPlaylists | null;
  copaId: string;
  userId: string | null;
}) {
  const router = useRouter();

  // Resultados de votos lançados nesta sessão (sobrepõe os dados do servidor).
  const [castVotes, setCastVotes] = useState<Record<string, Game>>({});

  // Fila de disputas a votar: definida uma vez, a partir das que ainda não
  // tinham voto. Mantém a posição estável mesmo com o refresh do placar.
  const [queue, setQueue] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (queue === null) {
      setQueue(games.filter((g) => g.myVote === null).map((g) => g.id));
    }
  }, [games, queue]);

  // Atualiza o placar ao vivo a cada 10s (preserva o estado local da fila).
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(t);
  }, [router]);

  // Mescla dados do servidor com os votos lançados nesta sessão.
  const mergedById = useMemo(() => {
    const map = new Map<string, Game>();
    for (const g of games) map.set(g.id, castVotes[g.id] ? { ...g, ...castVotes[g.id] } : g);
    return map;
  }, [games, castVotes]);

  const canVote = !!userId;
  const queueGames = (queue ?? []).map((id) => mergedById.get(id)).filter((g): g is Game => !!g);
  const current = canVote && index < queueGames.length ? queueGames[index] : null;

  const recordResult = useCallback((g: Game) => {
    setCastVotes((prev) => ({ ...prev, [g.id]: g }));
  }, []);

  const advance = useCallback(() => {
    setIndex((i) => i + 1);
  }, []);

  const allGames = games.map((g) => mergedById.get(g.id) ?? g);
  const votedCount = allGames.filter((g) => g.myVote !== null).length;

  return (
    <div style={{ padding: "20px 16px 28px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", margin: "0 8px 4px" }}>Jogos de Hoje</h1>
      <div style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 8px 18px" }}>
        Vote em uma disputa e a próxima aparece automaticamente
      </div>

      {playlists && <PlaylistLinks playlists={playlists} />}

      {games.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14, padding: "40px 24px", background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 14 }}>
          ⏳ Nenhum jogo ao vivo agora.<br />
          <span style={{ fontSize: 12, color: "var(--text-disabled)" }}>Os jogos do dia abrem no horário definido.</span>
        </div>
      ) : !canVote ? (
        <>
          <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", padding: 14, background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 12, marginBottom: 12 }}>
            Entre na sua conta para votar nas disputas
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {allGames.map((g) => (
              <ResultCard key={g.id} g={g} onClick={() => router.push(`/copa/jogo/${g.id}`)} />
            ))}
          </div>
        </>
      ) : current ? (
        <VoteArena
          key={current.id}
          game={current}
          copaId={copaId}
          position={index}
          total={queueGames.length}
          onResult={recordResult}
          onAdvance={advance}
        />
      ) : (
        <>
          <div style={{ textAlign: "center", padding: "18px 16px", background: "rgba(52,199,89,.1)", border: "1px solid rgba(52,199,89,.35)", borderRadius: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 4 }}>🎉</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#34C759" }}>
              Você votou em {votedCount} {votedCount === 1 ? "disputa" : "disputas"}!
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              Acompanhe os placares ao vivo abaixo.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {allGames.map((g) => (
              <ResultCard key={g.id} g={g} onClick={() => router.push(`/copa/jogo/${g.id}`)} />
            ))}
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes goalPop { 0%{transform:scale(0) rotate(-20deg);opacity:0} 60%{transform:scale(1.15) rotate(6deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  );
}
