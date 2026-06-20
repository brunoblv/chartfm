"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Music, ExternalLink, Trophy } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { pushRoundTitle } from "@/lib/push-format";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SongData {
  title: string;
  artist: string;
  coverUrl: string | null;
  spotifyUrl: string | null;
  albumReleaseDate?: string | null;
}

interface ParticipantData {
  userId: string;
  handle: string | null;
  name: string | null;
  avatarColor: string;
  isMe: boolean;
}

interface SubmissionData {
  id: string;
  userId: string;
  userHandle: string | null;
  userName: string | null;
  spotifyTrackId: string;
  song: SongData;
}

interface ResultData {
  submissionId: string;
  userId: string;
  userHandle: string;
  userName: string;
  spotifyTrackId: string;
  song: SongData;
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
  youtubePlaylistId: string | null;
  season: number;
  submissionCount: number;
  mySubmission: { id: string; spotifyTrackId: string; song: SongData } | null;
  submissions: SubmissionData[] | null;
  myVotes: { submissionId: string; position: number }[] | null;
  results: ResultData[] | null;
  participants: ParticipantData[];
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

// ─── Constants ────────────────────────────────────────────────────────────────

const SPOTIFY_PATH =
  "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z";

const PODIUM_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];

const STAGES = ["Inscrição", "Revelação", "Escuta & Avaliação", "Resultado"] as const;
const PHASE_TO_STAGE: Record<RoundData["phase"], number> = {
  SUBMISSION: 0,
  LISTENING: 2,
  RANKING: 2,
  RESULT: 3,
};

function isListenAndRankPhase(phase: RoundData["phase"]) {
  return phase === "LISTENING" || phase === "RANKING";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function phaseLabel(phase: RoundData["phase"]) {
  if (phase === "SUBMISSION") return "Inscrição";
  if (isListenAndRankPhase(phase)) return "Escuta & Avaliação";
  return "Resultado";
}

function phaseColor(phase: RoundData["phase"]) {
  if (phase === "SUBMISSION") return "var(--accent)";
  if (isListenAndRankPhase(phase)) return "#6366f1";
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

function formatReleaseDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const m = months[d.getMonth()];
  return `${m[0].toUpperCase() + m.slice(1)} ${d.getFullYear()}`;
}

function pushPoints(pos: number, totalToRank: number): number {
  if (totalToRank <= 0) return 0;
  if (totalToRank === 1) return 20;
  const k = Math.log(20) / (totalToRank - 1);
  return Math.max(1, Math.round(20 * Math.exp(-k * (pos - 1))));
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useTimeRemaining(endIso: string | null): string {
  const compute = useCallback((iso: string | null): string => {
    if (!iso) return "";
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return "Encerrado";
    const totalMins = Math.floor(diff / 60000);
    const totalHours = Math.floor(totalMins / 60);
    if (totalHours >= 48) return `${Math.floor(totalHours / 24)}d restantes`;
    if (totalHours >= 1) return `${totalHours}h ${totalMins % 60}m restantes`;
    return `${totalMins}m restantes`;
  }, []);

  const [remaining, setRemaining] = useState(() => compute(endIso));

  useEffect(() => {
    setRemaining(compute(endIso));
    if (!endIso) return;
    const t = setInterval(() => setRemaining(compute(endIso)), 60000);
    return () => clearInterval(t);
  }, [endIso, compute]);

  return remaining;
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function CheckIcon({ color = "white", size = 10 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function ParticipantAvatar({ p, size = 30 }: { p: ParticipantData; size?: number }) {
  const label = (p.name ?? p.handle ?? "?")[0].toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2, flexShrink: 0,
      background: p.avatarColor,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontSize: Math.floor(size * 0.4), fontWeight: 700,
    }}>
      {label}
    </div>
  );
}

function TrackCover({ imageUrl, size = 40 }: { imageUrl: string | null; size?: number }) {
  if (imageUrl) {
    return (
      <img src={imageUrl} alt="" width={size} height={size}
        style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 6, background: "var(--fill-subtle)",
      display: "grid", placeItems: "center", flexShrink: 0,
    }}>
      <Music size={size * 0.4} color="var(--text-muted)" />
    </div>
  );
}

function RankBadge({ pos, small, isDragging }: { pos: number; small?: boolean; isDragging?: boolean }) {
  const sz = small ? 22 : 26;
  const r = small ? 5 : 7;
  const bg = isDragging ? "var(--accent)" : pos <= 3 ? PODIUM_COLORS[pos - 1] : "var(--fill-subtle)";
  const color = isDragging || pos <= 3 ? "white" : "var(--text-muted)";
  return (
    <div style={{
      width: sz, height: sz, borderRadius: r,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: small ? 10 : 11, fontWeight: 800, background: bg, color, flexShrink: 0,
    }}>
      {pos}
    </div>
  );
}

// ─── Stage Progress Bar ───────────────────────────────────────────────────────

function StageBar({ phase }: { phase: RoundData["phase"] }) {
  const activeIdx = PHASE_TO_STAGE[phase];
  const items: React.ReactNode[] = [];

  STAGES.forEach((label, i) => {
    const done = i < activeIdx;
    const cur  = i === activeIdx;

    items.push(
      <div key={"d" + i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
        <div style={{ width: 7, height: 7, borderRadius: 4, background: done || cur ? "var(--accent)" : "var(--text-disabled)" }} />
        <div style={{ fontSize: 8, fontWeight: 600, whiteSpace: "nowrap", color: done || cur ? "var(--accent)" : "var(--text-muted)" }}>
          {label}
        </div>
      </div>
    );

    if (i < STAGES.length - 1) {
      items.push(
        <div key={"l" + i} style={{ flex: 1, height: 1, background: done ? "var(--accent)" : "var(--text-disabled)", marginBottom: 11 }} />
      );
    }
  });

  return <div style={{ display: "flex", alignItems: "center" }}>{items}</div>;
}

// ─── Round Header Card ────────────────────────────────────────────────────────

function RoundHeader({ round, isMobile }: { round: RoundData; isMobile: boolean }) {
  const endIso =
    round.phase === "SUBMISSION" ? round.submissionEndsAt
    : isListenAndRankPhase(round.phase) ? round.rankingEndsAt
    : null;

  const timeLeft = useTimeRemaining(endIso);
  const color = phaseColor(round.phase);

  return (
    <div style={{
      background: "var(--surface)",
      borderRadius: 16,
      border: "1px solid var(--divider)",
      padding: isMobile ? "14px 16px" : "18px 22px",
      marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{
            fontSize: isMobile ? 22 : 26, fontWeight: 900, color: "var(--text)",
            letterSpacing: "-.03em", lineHeight: 1,
          }}>
            {pushRoundTitle(round.season, round.number)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          <span style={{
            padding: "3px 10px", borderRadius: 100,
            background: color + "18", color,
            border: `1px solid ${color}33`,
            fontSize: 10, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase" as const,
          }}>
            {phaseLabel(round.phase)}
          </span>
          {timeLeft && (
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
              {timeLeft}
            </span>
          )}
        </div>
      </div>
      <StageBar phase={round.phase} />
    </div>
  );
}

// ─── Participants Section ─────────────────────────────────────────────────────

function ParticipantsSection({ round }: { round: RoundData }) {
  const submitted = round.participants.filter((p) => true); // all participants have submitted
  const total = round.submissionCount;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" as const, color: "var(--text-muted)" }}>
          Participantes
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {submitted.length}/{total > submitted.length ? total : submitted.length} indicaram
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {submitted.map((p) => (
          <div
            key={p.userId}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 9px 4px 5px", borderRadius: 100,
              background: "color-mix(in srgb, var(--accent) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
            }}
          >
            <div style={{
              width: 15, height: 15, borderRadius: 7.5,
              background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <CheckIcon size={7} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>
              {p.isMe ? "Você" : (p.name?.split(" ")[0] ?? p.handle ?? "?")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Submission View ──────────────────────────────────────────────────────────

function SubmissionView({
  round,
  onSubmitted,
}: {
  round: RoundData;
  onSubmitted: (sub: RoundData["mySubmission"]) => void;
}) {
  const { data: session } = useSession();
  const authed = !!session?.user?.id;

  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<SpotifyTrack[]>([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<SpotifyTrack | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [editing, setEditing]   = useState(!round.mySubmission);

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
      } catch {
        if (!ac.signal.aborted) setResults([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
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
      const data = (await res.json()) as {
        error?: string; id?: string; song?: SongData;
        spotifyTrackId?: string; albumReleaseDate?: string | null;
      };
      if (!res.ok) { setError(data.error ?? "Erro ao inscrever música"); return; }
      onSubmitted({
        id: data.id!,
        spotifyTrackId: data.spotifyTrackId!,
        song: { ...data.song!, albumReleaseDate: data.albumReleaseDate },
      });
      setEditing(false);
      setSelected(null);
      setQuery("");
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
        <Link href="/login" style={{
          padding: "10px 24px", borderRadius: 100, background: "var(--accent)",
          color: "white", fontWeight: 700, textDecoration: "none", fontSize: 14,
        }}>
          Entrar
        </Link>
      </div>
    );
  }

  const mySong = round.mySubmission;
  const relDate = formatReleaseDate(mySong?.song.albumReleaseDate);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Confirmed song */}
      {mySong && !editing && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase" as const, marginBottom: 8 }}>
            Sua indicação
          </div>
          <div style={{
            background: "var(--surface)",
            border: "1.5px solid color-mix(in srgb, var(--accent) 28%, transparent)",
            borderRadius: 14, padding: 13,
            display: "flex", alignItems: "center", gap: 11,
          }}>
            <TrackCover imageUrl={mySong.song.coverUrl} size={46} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {mySong.song.title}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {mySong.song.artist}
              </div>
              <div style={{ fontSize: 10, color: "#1DB954", fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <CheckIcon color="#1DB954" size={8} />
                {relDate ? `Lançada em ${relDate} · Válida` : "Indicação confirmada"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setEditing(true); setQuery(""); setSelected(null); }}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11, fontFamily: "inherit", padding: "4px 8px", flexShrink: 0 }}
            >
              Trocar
            </button>
          </div>
        </div>
      )}

      {/* Search area */}
      {(!mySong || editing) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase" as const }}>
            Indique sua música
          </div>

          <div style={{
            padding: "9px 13px", borderRadius: 11,
            background: "color-mix(in srgb, var(--accent) 6%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent) 18%, transparent)",
            fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5,
          }}>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>Regras: </span>
            Lançamento máx. 12 meses (data do álbum no Spotify). Música não pode ter sido indicada em nenhuma outra rodada.
          </div>

          <div style={{ position: "relative" }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2.2} strokeLinecap="round"
              style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx={11} cy={11} r={7} /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
              placeholder="Buscar no Spotify…"
              style={{
                width: "100%", padding: "11px 14px 11px 38px", borderRadius: 12,
                border: "1px solid var(--divider)", background: "var(--surface)",
                color: "var(--text)", fontSize: 14, outline: "none",
                boxSizing: "border-box", fontFamily: "inherit",
              }}
            />
          </div>

          {loading && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Buscando…</div>}

          {results.length > 0 && !selected && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 13, overflow: "hidden" }}>
              {results.map((track, i) => (
                <button
                  key={track.spotifyId}
                  type="button"
                  onClick={() => { setSelected(track); setQuery(`${track.title} — ${track.artist}`); setResults([]); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 11,
                    padding: "11px 14px",
                    borderTop: "none", borderLeft: "none", borderRight: "none",
                    borderBottom: i < results.length - 1 ? "1px solid var(--divider)" : "none",
                    cursor: "pointer", background: "none", width: "100%", textAlign: "left" as const,
                  }}
                >
                  <TrackCover imageUrl={track.imageUrl} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.artist}</div>
                  </div>
                  <span style={{ padding: "2px 7px", borderRadius: 100, background: "rgba(29,185,84,.12)", color: "#1DB954", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                    Spotify
                  </span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div style={{
              display: "flex", alignItems: "center", gap: 11, padding: 12, borderRadius: 12,
              background: "color-mix(in srgb, var(--accent) 6%, transparent)",
              border: "1.5px solid color-mix(in srgb, var(--accent) 28%, transparent)",
            }}>
              <TrackCover imageUrl={selected.imageUrl} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.artist}</div>
              </div>
              <button type="button" onClick={() => { setSelected(null); setQuery(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, flexShrink: 0 }}>
                ✕
              </button>
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
              padding: "14px", borderRadius: 14, border: "none",
              background: selected && !submitting ? "var(--accent)" : "var(--fill-subtle)",
              color: selected && !submitting ? "white" : "var(--text-muted)",
              fontSize: 15, fontWeight: 700,
              cursor: selected && !submitting ? "pointer" : "not-allowed",
              fontFamily: "inherit", transition: "background 160ms",
            }}
          >
            {submitting ? "Inscrevendo…" : "Confirmar indicação"}
          </button>
        </div>
      )}

      {/* Participants */}
      {round.participants.length > 0 && (
        <ParticipantsSection round={round} />
      )}
    </div>
  );
}

// ─── Listening View ───────────────────────────────────────────────────────────

function ListeningView({ round }: { round: RoundData }) {
  const submissions = round.submissions ?? [];
  const [platform, setPlatform] = useState<"spotify" | "youtube">("spotify");

  const spotifyUrl = round.spotifyPlaylistId
    ? `https://open.spotify.com/playlist/${round.spotifyPlaylistId}`
    : null;

  const youtubeUrl = round.youtubePlaylistId
    ? `https://www.youtube.com/playlist?list=${round.youtubePlaylistId}`
    : null;

  const tabStyle = (active: boolean) => ({
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    padding: "10px 14px", borderRadius: 10, border: "none",
    fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    background: active ? "var(--surface)" : "transparent",
    color: active ? "var(--text)" : "var(--text-muted)",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,.1)" : "none",
    transition: "all 150ms",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Platform picker */}
      <div style={{ background: "var(--fill-subtle)", borderRadius: 13, padding: 3, display: "flex", gap: 3 }}>
        <button type="button" onClick={() => setPlatform("spotify")} style={tabStyle(platform === "spotify") as React.CSSProperties}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill={platform === "spotify" ? "#1DB954" : "var(--text-muted)"}>
            <path d={SPOTIFY_PATH} />
          </svg>
          Spotify
        </button>
        <button type="button" onClick={() => setPlatform("youtube")} style={tabStyle(platform === "youtube") as React.CSSProperties}>
          <svg width={16} height={12} viewBox="0 0 24 18" fill={platform === "youtube" ? "#FF0000" : "var(--text-muted)"}>
            <path d="M23.495 2.205a3.02 3.02 0 0 0-2.122-2.138C19.505 0 12 0 12 0S4.495 0 2.627.07a3.02 3.02 0 0 0-2.122 2.138C0 4.07 0 8.123 0 8.123s0 4.052.505 5.917a3.02 3.02 0 0 0 2.122 2.138C4.495 16.246 12 16.246 12 16.246s7.505 0 9.373-.07a3.02 3.02 0 0 0 2.122-2.138C24 12.175 24 8.123 24 8.123s0-4.052-.505-5.918zM9.546 11.56V4.686l6.273 3.437-6.273 3.437z" />
          </svg>
          YouTube
        </button>
      </div>

      {/* Spotify card */}
      {platform === "spotify" && spotifyUrl && (
        <div style={{ background: "#121212", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: "#1DB954", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="white"><path d={SPOTIFY_PATH} /></svg>
            </div>
            <div>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{pushRoundTitle(round.season, round.number)}</div>
              <div style={{ color: "#B3B3B3", fontSize: 11, marginTop: 2 }}>{submissions.length} músicas</div>
            </div>
          </div>
          <a href={spotifyUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 11, borderRadius: 100, background: "#1DB954", color: "#000", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="#000"><path d={SPOTIFY_PATH} /></svg>
            Abrir no Spotify
          </a>
        </div>
      )}

      {platform === "spotify" && !spotifyUrl && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 16, padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          Playlist ainda não disponível.
        </div>
      )}

      {/* YouTube card */}
      {platform === "youtube" && youtubeUrl && (
        <div style={{ background: "#0F0F0F", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: "#FF0000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width={20} height={16} viewBox="0 0 24 18" fill="white">
                <path d="M23.495 2.205a3.02 3.02 0 0 0-2.122-2.138C19.505 0 12 0 12 0S4.495 0 2.627.07a3.02 3.02 0 0 0-2.122 2.138C0 4.07 0 8.123 0 8.123s0 4.052.505 5.917a3.02 3.02 0 0 0 2.122 2.138C4.495 16.246 12 16.246 12 16.246s7.505 0 9.373-.07a3.02 3.02 0 0 0 2.122-2.138C24 12.175 24 8.123 24 8.123s0-4.052-.505-5.918zM9.546 11.56V4.686l6.273 3.437-6.273 3.437z" />
              </svg>
            </div>
            <div>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{pushRoundTitle(round.season, round.number)}</div>
              <div style={{ color: "#AAAAAA", fontSize: 11, marginTop: 2 }}>@chartFM · {submissions.length} vídeos</div>
            </div>
          </div>
          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 11, borderRadius: 100, background: "#FF0000", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            <svg width={15} height={12} viewBox="0 0 24 18" fill="white">
              <path d="M23.495 2.205a3.02 3.02 0 0 0-2.122-2.138C19.505 0 12 0 12 0S4.495 0 2.627.07a3.02 3.02 0 0 0-2.122 2.138C0 4.07 0 8.123 0 8.123s0 4.052.505 5.917a3.02 3.02 0 0 0 2.122 2.138C4.495 16.246 12 16.246 12 16.246s7.505 0 9.373-.07a3.02 3.02 0 0 0 2.122-2.138C24 12.175 24 8.123 24 8.123s0-4.052-.505-5.918zM9.546 11.56V4.686l6.273 3.437-6.273 3.437z" />
            </svg>
            Abrir no YouTube
          </a>
        </div>
      )}

      {platform === "youtube" && !youtubeUrl && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 16, padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          Playlist ainda não disponível no @chartFM.
        </div>
      )}

      {/* Track list */}
      {submissions.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase" as const, marginBottom: 12 }}>
            Playlist da semana
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {submissions.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < submissions.length - 1 ? "1px solid var(--divider)" : "none" }}>
                <div style={{ width: 20, textAlign: "right" as const, fontSize: 12, fontWeight: 700, color: "var(--text-disabled)", flexShrink: 0 }}>
                  {i + 1}
                </div>
                <TrackCover imageUrl={s.song.coverUrl} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.song.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.song.artist}</div>
                </div>
                {s.userHandle && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>@{s.userHandle}</div>
                )}
                {s.song.spotifyUrl && (
                  <a href={s.song.spotifyUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink size={13} color="var(--text-muted)" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {submissions.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Ouça as músicas inscritas e avalie-as abaixo.
        </div>
      )}
    </div>
  );
}

// ─── Ranking View ─────────────────────────────────────────────────────────────

function RankingView({ round, onSaved }: { round: RoundData; onSaved: () => void }) {
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

  const [ranking, setRanking]   = useState<SubmissionData[]>(initialOrder);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const dragItem                = useRef<number | null>(null);

  const hasVoted = (round.myVotes ?? []).length > 0;
  const total    = toRank.length;

  function handleDragStart(idx: number) { dragItem.current = idx; }
  function handleDragEnter(idx: number) {
    if (dragItem.current === null || dragItem.current === idx) return;
    setRanking((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragItem.current!, 1);
      next.splice(idx, 0, moved);
      dragItem.current = idx;
      return next;
    });
  }
  function handleDragEnd() { dragItem.current = null; setSaved(false); }

  const touchDragIdx  = useRef<number | null>(null);
  const touchStartY   = useRef<number>(0);
  const itemHeight    = useRef<number>(76);

  function handleTouchStart(e: React.TouchEvent, idx: number) {
    touchDragIdx.current = idx;
    touchStartY.current  = e.touches[0].clientY;
    itemHeight.current   = (e.currentTarget as HTMLElement).getBoundingClientRect().height + 8;
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
    touchStartY.current  = e.touches[0].clientY;
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

  if (!authed) return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Faça login para avaliar as músicas.</div>;
  if (!mySubmission) return (
    <div style={{ padding: 20, borderRadius: 12, background: "var(--fill-subtle)", border: "1px solid var(--divider)", color: "var(--text-muted)", fontSize: 14 }}>
      Você não inscreveu uma música nesta rodada. Apenas participantes com inscrição podem avaliar.
    </div>
  );
  if (toRank.length === 0) return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Não há músicas para avaliar.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* My song */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase" as const, marginBottom: 8 }}>
          Sua música
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 13, background: "color-mix(in srgb, var(--accent) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 18%, transparent)" }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--accent) 18%, transparent)", flexShrink: 0 }}>
            <Music size={12} color="var(--accent)" />
          </div>
          <TrackCover imageUrl={mySubmission.song.coverUrl} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mySubmission.song.title}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{mySubmission.song.artist}</div>
          </div>
          <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>Não avaliada</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round">
          <circle cx={12} cy={12} r={10} /><line x1={12} y1={8} x2={12} y2={12} /><line x1={12} y1={16} x2={12.01} y2={16} />
        </svg>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Arraste para ordenar · #1 = 20 pts · #{total} = 1 pt
          {hasVoted && <span style={{ color: "#10b981", fontWeight: 600 }}> · ✓ Avaliação salva</span>}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {ranking.map((sub, idx) => {
          const pts = pushPoints(idx + 1, total);
          return (
            <div
              key={sub.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, idx)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                borderRadius: 13, background: "var(--surface)", border: "1.5px solid var(--divider)",
                cursor: "grab", userSelect: "none", boxShadow: "0 1px 2px rgba(0,0,0,.04)",
              }}
            >
              <RankBadge pos={idx + 1} />
              <TrackCover imageUrl={sub.song.coverUrl} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.song.title}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.song.artist}</div>
              </div>
              <div style={{ textAlign: "center" as const, flexShrink: 0, minWidth: 34 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: "var(--text)", lineHeight: 1, letterSpacing: "-.02em" }}>{pts}</div>
                <div style={{ fontSize: 8, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".05em", marginTop: 1 }}>PTS</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2.5, paddingLeft: 2, flexShrink: 0 }}>
                {[0, 1, 2].map((row) => (
                  <div key={row} style={{ display: "flex", gap: 2.5 }}>
                    <div style={{ width: 3, height: 3, borderRadius: 1.5, background: "var(--text-disabled)" }} />
                    <div style={{ width: 3, height: 3, borderRadius: 1.5, background: "var(--text-disabled)" }} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={saved ? undefined : handleSave}
        disabled={saving}
        style={{
          padding: "14px", borderRadius: 14, border: "none",
          background: saved ? "#10b981" : "var(--accent)",
          color: "white", fontSize: 15, fontWeight: 700,
          cursor: saving || saved ? "default" : "pointer",
          fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "background 200ms", marginBottom: 8,
        }}
      >
        {saved ? (
          <>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: "rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckIcon size={10} />
            </div>
            Ranking enviado com sucesso!
          </>
        ) : saving ? "Salvando…" : "Confirmar meu ranking"}
      </button>

      <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--fill-subtle)", fontSize: 12, color: "var(--text-muted)" }}>
        Escuta & avaliação até: <strong style={{ color: "var(--text)" }}>{formatDate(round.rankingEndsAt)}</strong>
      </div>
    </div>
  );
}

// ─── Listen & Rank View (fase 2: escuta + avaliação juntas) ───────────────────

function ListenAndRankView({ round, onSaved }: { round: RoundData; onSaved: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <ListeningView round={round} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase" as const, marginBottom: 14 }}>
          Avaliação
        </div>
        <RankingView round={round} onSaved={onSaved} />
      </div>
    </div>
  );
}

// ─── Result View ──────────────────────────────────────────────────────────────

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

function ResultView({ round }: { round: RoundData }) {
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
            <button
              key={id}
              type="button"
              onClick={() => setResultTab(id)}
              style={{
                flex: 1, padding: "7px 4px", borderRadius: 8, border: "none",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                background: resultTab === id ? "var(--surface)" : "transparent",
                color: resultTab === id ? "var(--text)" : "var(--text-muted)",
                boxShadow: resultTab === id ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                transition: "background .15s",
              }}
            >
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

// ─── Stats Sidebar ────────────────────────────────────────────────────────────

function StatsSidebar({ round }: { round: RoundData }) {
  const endIso =
    round.phase === "SUBMISSION" ? round.submissionEndsAt
    : isListenAndRankPhase(round.phase) ? round.rankingEndsAt
    : null;
  const timeLeft = useTimeRemaining(endIso);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Participants */}
      {round.participants.length > 0 && (
        <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: "18px 20px", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: 14 }}>
            Participantes
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {round.participants.map((p) => (
              <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ParticipantAvatar p={p} size={30} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: p.isMe ? "var(--accent)" : "var(--text)" }}>
                  {p.isMe ? "Você" : (p.name?.split(" ")[0] ?? p.handle ?? "?")}
                </div>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: "#1DB954", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CheckIcon color="white" size={8} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--divider)", fontSize: 12, color: "var(--text-muted)", textAlign: "center" as const }}>
            {round.participants.length}/{round.submissionCount} indicaram
          </div>
        </div>
      )}

      {/* Round info */}
      <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: "18px 20px", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: 12 }}>
          Rodada #{round.number}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Temporada",      value: String(round.season),          accent: false },
            { label: "Músicas",        value: String(round.submissionCount), accent: false },
            { label: "Fase atual",     value: phaseLabel(round.phase),       accent: true  },
            ...(isListenAndRankPhase(round.phase)
              ? [{ label: "Escuta até", value: formatDate(round.rankingEndsAt), accent: false }]
              : []),
            ...(timeLeft ? [{ label: "Tempo restante", value: timeLeft, accent: false }] : []),
          ].map(({ label, value, accent }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>{label}</span>
              <span style={{ fontWeight: 600, color: accent ? "var(--accent)" : "var(--text)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rules */}
      <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: "18px 20px", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: 12 }}>
          Regras
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            "Lançamento máx. 12 meses",
            "1 indicação por participante",
            "Músicas ficam ocultas até a revelação",
            "Escuta começa logo após a revelação",
            "#1 = 20 pts · último = 1 pt",
          ].map((rule, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{
                width: 16, height: 16, borderRadius: 8,
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 800, flexShrink: 0, marginTop: 1,
              }}>
                {i + 1}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-subtle)", lineHeight: 1.5 }}>{rule}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Histórico link */}
      <Link href="/push/historico" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderRadius: 12, background: "var(--surface)",
        border: "1px solid var(--divider)", textDecoration: "none",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Histórico</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>Ver todas as rodadas</div>
        </div>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
      </Link>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PushClient({ initialRound }: { initialRound: RoundData | null }) {
  const [round, setRound] = useState<RoundData | null>(initialRound);
  const isMobile = useIsMobile();

  const refresh = useCallback(async () => {
    try {
      const res  = await fetch("/api/push");
      const data = (await res.json()) as { round: RoundData | null };
      if (data.round) setRound(data.round);
    } catch {}
  }, []);

  function handleSubmitted(sub: RoundData["mySubmission"]) {
    setRound((r) => r ? { ...r, mySubmission: sub, submissionCount: r.submissionCount + 1 } : r);
  }

  if (!round) {
    return (
      <div style={{ padding: isMobile ? "48px 16px" : "48px 40px", textAlign: "center", color: "var(--text-muted)" }}>
        <Trophy size={40} style={{ opacity: 0.3, marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
        <p style={{ margin: "0 0 16px" }}>Nenhuma rodada ativa no momento.</p>
        <Link href="/push/historico" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
          Ver histórico de rodadas →
        </Link>
      </div>
    );
  }

  const content = (
    <>
      {round.phase === "SUBMISSION" && <SubmissionView round={round} onSubmitted={handleSubmitted} />}
      {isListenAndRankPhase(round.phase) && <ListenAndRankView round={round} onSaved={refresh} />}
      {round.phase === "RESULT"     && <ResultView round={round} />}
      {isMobile && (
        <Link href="/push/historico" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", fontWeight: 600, textDecoration: "none", marginTop: 28 }}>
          Ver histórico de rodadas
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
        </Link>
      )}
    </>
  );

  return (
    <div style={{ padding: isMobile ? "16px 16px 88px" : "28px 40px 60px" }}>
      <RoundHeader round={round} isMobile={isMobile} />

      {isMobile ? (
        content
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 28, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>{content}</div>
          <div style={{ position: "sticky", top: 76 }}>
            <StatsSidebar round={round} />
          </div>
        </div>
      )}
    </div>
  );
}
