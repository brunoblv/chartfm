"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { GripVertical, Music, ExternalLink, Check, Clock, Trophy, ChevronRight } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SongData {
  title: string;
  artist: string;
  coverUrl: string | null;
  spotifyUrl: string | null;
}

interface SubmissionData {
  id: string;
  userId: string;
  userHandle: string;
  userName: string;
  spotifyTrackId: string;
  song: SongData;
}

interface ResultData extends SubmissionData {
  totalPoints: number;
  rank: number;
}

export interface RoundData {
  id: string;
  number: number;
  title: string | null;
  phase: "SUBMISSION" | "LISTENING" | "RANKING" | "RESULT";
  submissionEndsAt: string;
  listeningEndsAt: string;
  rankingEndsAt: string;
  spotifyPlaylistId: string | null;
  season: number;
  submissionCount: number;
  mySubmission: { id: string; spotifyTrackId: string; song: SongData } | null;
  submissions: SubmissionData[] | null;
  myVotes: { submissionId: string; position: number }[] | null;
  results: ResultData[] | null;
}

interface SpotifyTrack {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  imageUrl: string | null;
  previewUrl: string | null;
  externalUrl: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function phaseName(phase: RoundData["phase"]) {
  if (phase === "SUBMISSION") return "Inscrições";
  if (phase === "LISTENING") return "Escuta";
  if (phase === "RANKING") return "Avaliação";
  return "Resultado";
}

function phaseColor(phase: RoundData["phase"]) {
  if (phase === "SUBMISSION") return "var(--accent)";
  if (phase === "LISTENING") return "#6366f1";
  if (phase === "RANKING") return "#f59e0b";
  return "#10b981";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Cover Placeholder ───────────────────────────────────────────────────────

function TrackCover({ imageUrl, size = 48 }: { imageUrl: string | null; size?: number }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: "var(--fill-inset)",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <Music size={size * 0.4} color="var(--text-muted)" />
    </div>
  );
}

// ─── Phase Badge ─────────────────────────────────────────────────────────────

function PhaseBadge({ phase }: { phase: RoundData["phase"] }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: phaseColor(phase) + "22",
        color: phaseColor(phase),
        border: `1px solid ${phaseColor(phase)}44`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: phaseColor(phase),
          display: "inline-block",
        }}
      />
      {phaseName(phase)}
    </span>
  );
}

// ─── Song Row ────────────────────────────────────────────────────────────────

function SongRow({
  title,
  artist,
  imageUrl,
  spotifyUrl,
  right,
  draggable,
  onDragStart,
  onDragEnter,
  onDragEnd,
  style,
}: {
  title: string;
  artist: string;
  imageUrl: string | null;
  spotifyUrl?: string | null;
  right?: React.ReactNode;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDragEnd?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 10,
        background: "var(--surface)",
        border: "1px solid var(--divider)",
        cursor: draggable ? "grab" : undefined,
        userSelect: "none",
        ...style,
      }}
    >
      {draggable && <GripVertical size={18} color="var(--text-disabled)" style={{ flexShrink: 0 }} />}
      <TrackCover imageUrl={imageUrl} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {artist}
        </div>
      </div>
      {right}
      {spotifyUrl && (
        <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          <ExternalLink size={14} color="var(--text-muted)" />
        </a>
      )}
    </div>
  );
}

// ─── Submission Phase ─────────────────────────────────────────────────────────

function SubmissionPhase({ round, onSubmitted }: { round: RoundData; onSubmitted: (sub: RoundData["mySubmission"]) => void }) {
  const { data: session } = useSession();
  const authed = !!session?.user?.id;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SpotifyTrack | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&limit=8`, { signal: ac.signal });
        if (!res.ok || ac.signal.aborted) return;
        const data = (await res.json()) as { tracks?: SpotifyTrack[] };
        if (!ac.signal.aborted) setResults(data.tracks ?? []);
      } catch { if (!ac.signal.aborted) setResults([]); }
      finally { if (!ac.signal.aborted) setLoading(false); }
    }, 280);
    return () => { ac.abort(); clearTimeout(timer); };
  }, [query]);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/push/${round.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotifyTrackId: selected.spotifyId }),
      });
      const data = (await res.json()) as { error?: string; id?: string; song?: SongData; spotifyTrackId?: string };
      if (!res.ok) { setError(data.error ?? "Erro ao inscrever música"); return; }
      onSubmitted({ id: data.id!, spotifyTrackId: data.spotifyTrackId!, song: data.song! });
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!authed) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>Faça login para participar do Push</p>
        <Link href="/login" style={{ padding: "10px 24px", borderRadius: 100, background: "var(--accent)", color: "white", fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ padding: "16px 18px", borderRadius: 12, background: "var(--fill-inset)", border: "1px solid var(--divider)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Inscrições até</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{formatDate(round.submissionEndsAt)}</div>
      </div>

      <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "0 2px" }}>
        <strong style={{ color: "var(--text)" }}>{round.submissionCount}</strong> música{round.submissionCount !== 1 ? "s" : ""} inscrita{round.submissionCount !== 1 ? "s" : ""} até agora. As músicas ficam ocultas até a fase de escuta.
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 8 }}>
          Buscar música no Spotify
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          placeholder="Nome da música ou artista..."
          style={{
            width: "100%",
            padding: "11px 14px",
            borderRadius: 10,
            border: "1px solid var(--divider-strong)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {loading && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Buscando…</div>}

      {results.length > 0 && !selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {results.map((track) => (
            <button
              key={track.spotifyId}
              type="button"
              onClick={() => { setSelected(track); setQuery(`${track.title} — ${track.artist}`); setResults([]); }}
              style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
            >
              <SongRow
                title={track.title}
                artist={track.artist}
                imageUrl={track.imageUrl}
                style={{ border: "1px solid var(--divider)", transition: "background 120ms" }}
              />
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Música selecionada
          </div>
          <SongRow
            title={selected.title}
            artist={selected.artist}
            imageUrl={selected.imageUrl}
            spotifyUrl={selected.externalUrl}
            style={{ background: "var(--accent-tint)", borderColor: "var(--accent)" }}
            right={
              <button
                type="button"
                onClick={() => { setSelected(null); setQuery(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
              >
                ✕
              </button>
            }
          />
        </div>
      )}

      {error && (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, fontWeight: 500 }}>
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!selected || submitting}
        onClick={handleSubmit}
        style={{
          padding: "13px 24px",
          borderRadius: 100,
          background: selected && !submitting ? "var(--accent)" : "var(--fill-inset)",
          color: selected && !submitting ? "white" : "var(--text-disabled)",
          border: "none",
          fontWeight: 700,
          fontSize: 15,
          cursor: selected && !submitting ? "pointer" : "not-allowed",
          transition: "background 160ms",
        }}
      >
        {submitting ? "Inscrevendo…" : "Inscrever música"}
      </button>
    </div>
  );
}

// ─── Listening Phase ──────────────────────────────────────────────────────────

function ListeningPhase({ round }: { round: RoundData }) {
  const submissions = round.submissions ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ padding: "16px 18px", borderRadius: 12, background: "var(--fill-inset)", border: "1px solid var(--divider)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Avaliação abre em</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{formatDate(round.listeningEndsAt)}</div>
      </div>

      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
        Ouça as <strong style={{ color: "var(--text)" }}>{submissions.length}</strong> músicas inscritas antes de avaliá-las.
      </p>

      {round.spotifyPlaylistId && (
        <div>
          <iframe
            src={`https://open.spotify.com/embed/playlist/${round.spotifyPlaylistId}?utm_source=generator`}
            width="100%"
            height="352"
            style={{ borderRadius: 12, border: "none" }}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Músicas desta rodada
        </div>
        {submissions.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SongRow
                title={s.song.title}
                artist={s.song.artist}
                imageUrl={s.song.coverUrl}
                spotifyUrl={s.song.spotifyUrl}
              />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>@{s.userHandle}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ranking Phase ────────────────────────────────────────────────────────────

function RankingPhase({ round, onSaved }: { round: RoundData; onSaved: () => void }) {
  const { data: session } = useSession();
  const authed = !!session?.user?.id;

  const mySubmission = round.mySubmission;
  const toRank = (round.submissions ?? []).filter((s) => s.id !== mySubmission?.id);

  const initialOrder = (): SubmissionData[] => {
    const votes = round.myVotes ?? [];
    if (votes.length > 0) {
      const map = new Map(votes.map((v) => [v.submissionId, v.position]));
      return [...toRank].sort((a, b) => (map.get(a.id) ?? 999) - (map.get(b.id) ?? 999));
    }
    return toRank;
  };

  const [ranking, setRanking] = useState<SubmissionData[]>(initialOrder);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const hasVoted = (round.myVotes ?? []).length > 0;

  function handleDragStart(idx: number) { dragItem.current = idx; }
  function handleDragEnter(idx: number) {
    dragOver.current = idx;
    if (dragItem.current === null || dragItem.current === idx) return;
    setRanking((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragItem.current!, 1);
      next.splice(idx, 0, moved);
      dragItem.current = idx;
      return next;
    });
  }
  function handleDragEnd() { dragItem.current = null; dragOver.current = null; setSaved(false); }

  // Touch drag support
  const touchDragIdx = useRef<number | null>(null);
  const touchStartY = useRef<number>(0);
  const itemHeight = useRef<number>(64);

  function handleTouchStart(e: React.TouchEvent, idx: number) {
    touchDragIdx.current = idx;
    touchStartY.current = e.touches[0].clientY;
    const el = e.currentTarget as HTMLElement;
    itemHeight.current = el.getBoundingClientRect().height + 8;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchDragIdx.current === null) return;
    e.preventDefault();
    const dy = e.touches[0].clientY - touchStartY.current;
    const steps = Math.round(dy / itemHeight.current);
    if (steps === 0) return;
    const from = touchDragIdx.current;
    const to = Math.max(0, Math.min(ranking.length - 1, from + steps));
    if (from === to) return;
    setRanking((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    touchDragIdx.current = to;
    touchStartY.current = e.touches[0].clientY;
    setSaved(false);
  }

  function handleTouchEnd() { touchDragIdx.current = null; }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const votes = ranking.map((s, i) => ({ submissionId: s.id, position: i + 1 }));
    try {
      const res = await fetch(`/api/push/${round.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votes }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? "Erro ao salvar"); return; }
      setSaved(true);
      onSaved();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  if (!authed) {
    return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Faça login para avaliar as músicas.</div>;
  }

  if (!mySubmission) {
    return (
      <div style={{ padding: "20px", borderRadius: 12, background: "var(--fill-inset)", border: "1px solid var(--divider)", color: "var(--text-muted)", fontSize: 14 }}>
        Você não inscreveu uma música nesta rodada. Apenas participantes com inscrição podem avaliar.
      </div>
    );
  }

  if (toRank.length === 0) {
    return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Não há músicas para avaliar.</div>;
  }

  const total = toRank.length;

  function pointsForPos(pos: number) {
    if (total === 1) return 10;
    return Math.max(1, Math.round(10 - (pos - 1) * 9 / (total - 1)));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ padding: "16px 18px", borderRadius: 12, background: "var(--fill-inset)", border: "1px solid var(--divider)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Avaliação até</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{formatDate(round.rankingEndsAt)}</div>
      </div>

      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
        Arraste para ordenar do melhor para o pior. Sua música não aparece na lista. {hasVoted && <span style={{ color: "#10b981", fontWeight: 600 }}>✓ Avaliação salva</span>}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ranking.map((sub, idx) => {
          const pts = pointsForPos(idx + 1);
          return (
            <div
              key={sub.id}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
              onTouchStart={(e) => handleTouchStart(e, idx)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: idx === 0 ? "var(--accent)" : "var(--text-muted)" }}>
                  {idx + 1}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SongRow
                  title={sub.song.title}
                  artist={sub.song.artist}
                  imageUrl={sub.song.coverUrl}
                  spotifyUrl={sub.song.spotifyUrl}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                />
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "var(--fill-inset)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                }}
              >
                {pts}pt
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 }}>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: "13px 24px",
          borderRadius: 100,
          background: saved ? "#10b981" : "var(--accent)",
          color: "white",
          border: "none",
          fontWeight: 700,
          fontSize: 15,
          cursor: saving ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          transition: "background 200ms",
        }}
      >
        {saved ? <><Check size={16} /> Avaliação salva</> : saving ? "Salvando…" : "Salvar avaliação"}
      </button>
    </div>
  );
}

// ─── Result Phase ─────────────────────────────────────────────────────────────

function ResultPhase({ round }: { round: RoundData }) {
  const results = round.results ?? [];
  const podium = results.slice(0, 3);
  const rest = results.slice(3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {podium.length > 0 && (
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {podium.map((r) => (
            <div
              key={r.submissionId}
              style={{
                flex: "1 1 140px",
                maxWidth: 180,
                padding: "16px 14px",
                borderRadius: 14,
                background: r.rank === 1 ? "linear-gradient(135deg, #fef9c3, #fde68a)" : "var(--surface)",
                border: `2px solid ${r.rank === 1 ? "#f59e0b" : "var(--divider)"}`,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 28 }}>
                {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉"}
              </div>
              <TrackCover imageUrl={r.song.coverUrl} size={56} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>{r.song.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.song.artist}</div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{r.userHandle}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: r.rank === 1 ? "#f59e0b" : "var(--accent)" }}>
                {r.totalPoints} pts
              </div>
            </div>
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rest.map((r) => (
            <div
              key={r.submissionId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 10,
                background: "var(--surface)",
                border: "1px solid var(--divider)",
              }}
            >
              <div style={{ width: 28, textAlign: "center", flexShrink: 0, fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>
                {r.rank}
              </div>
              <TrackCover imageUrl={r.song.coverUrl} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.song.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.song.artist} · @{r.userHandle}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", flexShrink: 0 }}>
                {r.totalPoints} pts
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Rankings Tab ─────────────────────────────────────────────────────────────

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
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((entry) => (
        <Link
          key={entry.handle}
          href={`/profile/${entry.handle}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--surface)",
            border: "1px solid var(--divider)",
            textDecoration: "none",
          }}
        >
          <div style={{ width: 28, textAlign: "center", flexShrink: 0, fontSize: 15, fontWeight: 700, color: entry.rank <= 3 ? "var(--accent)" : "var(--text-muted)" }}>
            {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : entry.rank}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{entry.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{entry.handle}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{entry.points} pts</div>
            {entry.wins > 0 && <div style={{ fontSize: 11, color: "#f59e0b" }}>🏆 {entry.wins} vitória{entry.wins !== 1 ? "s" : ""}</div>}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PushClient({ initialRound }: { initialRound: RoundData | null }) {
  const [round, setRound] = useState<RoundData | null>(initialRound);
  const [tab, setTab] = useState<"round" | "season" | "overall">("round");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/push");
      const data = (await res.json()) as { round: RoundData | null };
      if (data.round) setRound(data.round);
    } catch {}
  }, []);

  function handleSubmitted(sub: RoundData["mySubmission"]) {
    setRound((r) => r ? { ...r, mySubmission: sub, submissionCount: r.submissionCount + 1 } : r);
  }

  const tabs = [
    { key: "round" as const, label: "Rodada atual" },
    { key: "season" as const, label: "Temporada" },
    { key: "overall" as const, label: "Geral" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 680 }}>
      {/* Tab navigation */}
      <div style={{ display: "flex", gap: 4, padding: "4px", borderRadius: 12, background: "var(--fill-inset)", width: "fit-content" }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              padding: "8px 16px",
              borderRadius: 9,
              border: "none",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              background: tab === key ? "var(--surface)" : "transparent",
              color: tab === key ? "var(--text)" : "var(--text-muted)",
              boxShadow: tab === key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              transition: "all 120ms",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Rankings tabs */}
      {tab === "season" && round && <RankingsTab season={round.season} />}
      {tab === "overall" && <RankingsTab />}

      {/* Round tab */}
      {tab === "round" && (
        <>
          {!round ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
              <Trophy size={40} style={{ opacity: 0.3, marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
              <p>Nenhuma rodada ativa no momento.</p>
              <Link href="/push/historico" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
                Ver histórico de rodadas →
              </Link>
            </div>
          ) : (
            <>
              {/* Round header */}
              <div style={{
                padding: "20px 22px",
                borderRadius: 16,
                background: "var(--surface)",
                border: "1px solid var(--divider)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <PhaseBadge phase={round.phase} />
                  <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
                    Rodada #{round.number} · T{round.season}
                  </span>
                </div>
                {round.title && (
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>
                    {round.title}
                  </h2>
                )}

                {/* My submission (shown after SUBMISSION phase) */}
                {round.mySubmission && round.phase !== "SUBMISSION" && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 6 }}>
                      Sua música
                    </div>
                    <SongRow
                      title={round.mySubmission.song.title}
                      artist={round.mySubmission.song.artist}
                      imageUrl={round.mySubmission.song.coverUrl}
                      spotifyUrl={round.mySubmission.song.spotifyUrl}
                      style={{ background: "var(--accent-tint)", borderColor: "var(--accent)" }}
                    />
                  </div>
                )}

                {/* Already submitted in SUBMISSION phase */}
                {round.mySubmission && round.phase === "SUBMISSION" && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#16a34a",
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    <Check size={16} />
                    Música inscrita com sucesso! Aguarde a fase de escuta.
                  </div>
                )}
              </div>

              {/* Phase content */}
              <div>
                {round.phase === "SUBMISSION" && !round.mySubmission && (
                  <SubmissionPhase round={round} onSubmitted={handleSubmitted} />
                )}
                {round.phase === "LISTENING" && <ListeningPhase round={round} />}
                {round.phase === "RANKING" && <RankingPhase round={round} onSaved={refresh} />}
                {round.phase === "RESULT" && <ResultPhase round={round} />}
              </div>

              <Link
                href="/push/historico"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Ver histórico de rodadas <ChevronRight size={14} />
              </Link>
            </>
          )}
        </>
      )}
    </div>
  );
}
