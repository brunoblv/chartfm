"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ExternalLink, RefreshCw, ChevronRight, Check } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { pushRoundTitle } from "@/lib/push-format";
import { spotifyConnectErrorMessage } from "@/lib/spotify-connect-oauth";
import { youtubeConnectErrorMessage } from "@/lib/youtube-connect-oauth";

type PushPhase = "SUBMISSION" | "LISTENING" | "RANKING" | "RESULT";

interface RoundRow {
  id: string;
  number: number;
  title: string | null;
  phase: PushPhase;
  season: number;
  submissionEndsAt: string;
  listeningEndsAt: string;
  rankingEndsAt: string;
  spotifyPlaylistId: string | null;
  youtubePlaylistId: string | null;
  createdAt: string;
  submissionCount: number;
}

interface IntegrationStatus {
  spotifyConnected: boolean;
  youtubeConnected: boolean;
  youtubeChannelHandle: string | null;
}

function PlaylistSetupBanner({
  round,
  integrations,
  onSyncPlaylists,
  syncBusy,
}: {
  round: RoundRow;
  integrations: IntegrationStatus;
  onSyncPlaylists?: () => void;
  syncBusy?: boolean;
}) {
  const needsSpotify = !round.spotifyPlaylistId;
  const needsYoutube = !round.youtubePlaylistId;
  if (!needsSpotify && !needsYoutube) return null;
  if (round.phase === "SUBMISSION") return null;

  const issues: string[] = [];
  if (needsSpotify && !integrations.spotifyConnected) {
    issues.push("Spotify não conectado");
  } else if (needsSpotify) {
    issues.push("Playlists ainda não criadas — use o botão abaixo");
  }
  if (needsYoutube && !integrations.youtubeConnected) {
    issues.push("YouTube @chartFM não conectado");
  }

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        background: "#fef2f2",
        border: "1px solid #fecaca",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>
        Playlists não criadas para esta rodada
      </div>
      {issues.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#991b1b", lineHeight: 1.5 }}>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {needsSpotify && !integrations.spotifyConnected && (
          <a
            href="/api/spotify/connect?from=/admin/push&reconnect=1"
            style={{ fontSize: 12, fontWeight: 600, color: "#b91c1c", textDecoration: "underline" }}
          >
            Conectar Spotify
          </a>
        )}
        {needsYoutube && !integrations.youtubeConnected && (
          <a
            href="/api/youtube/connect?from=/admin/push"
            style={{ fontSize: 12, fontWeight: 600, color: "#b91c1c", textDecoration: "underline" }}
          >
            Conectar YouTube
          </a>
        )}
        {(needsSpotify && integrations.spotifyConnected) || (needsYoutube && integrations.youtubeConnected) ? (
          <a
            href="/settings"
            style={{ fontSize: 12, fontWeight: 600, color: "#b91c1c", textDecoration: "underline" }}
          >
            Abrir Configurações
          </a>
        ) : null}
        {onSyncPlaylists && canRunPlaylistSync(round, integrations) && (
          <PlaylistSyncButton onClick={onSyncPlaylists} busy={!!syncBusy} />
        )}
      </div>
    </div>
  );
}

function isListenAndRankPhase(phase: PushPhase) {
  return phase === "LISTENING" || phase === "RANKING";
}

function needsPlaylistSync(round: RoundRow): boolean {
  return (
    (isListenAndRankPhase(round.phase) || round.phase === "RESULT") &&
    (!round.spotifyPlaylistId || !round.youtubePlaylistId)
  );
}

function canRunPlaylistSync(round: RoundRow, integrations: IntegrationStatus): boolean {
  const needsSpotify = !round.spotifyPlaylistId;
  const needsYoutube = !round.youtubePlaylistId;
  if (needsSpotify && !integrations.spotifyConnected) return false;
  if (needsYoutube && !integrations.youtubeConnected) return false;
  return needsPlaylistSync(round);
}

function PlaylistSyncButton({
  onClick,
  busy,
  size = "md",
}: {
  onClick: () => void;
  busy: boolean;
  size?: "md" | "lg";
}) {
  const large = size === "lg";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        padding: large ? "10px 18px" : "7px 14px",
        borderRadius: large ? 10 : 8,
        border: "none",
        fontWeight: 700,
        fontSize: large ? 13 : 12,
        cursor: busy ? "not-allowed" : "pointer",
        background: "var(--accent)",
        color: "white",
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "inherit",
      }}
    >
      <RefreshCw size={large ? 14 : 13} />
      {busy ? "Sincronizando…" : "Criar playlists (Spotify + YouTube)"}
    </button>
  );
}

const PHASE_LABELS: Record<PushPhase, string> = {
  SUBMISSION: "Inscrições",
  LISTENING: "Escuta & Avaliação",
  RANKING: "Escuta & Avaliação",
  RESULT: "Resultado",
};

const PHASE_NEXT: Partial<Record<PushPhase, string>> = {
  SUBMISSION: "Avançar para Escuta & Avaliação",
  LISTENING: "Avançar para Resultado",
  RANKING: "Avançar para Resultado",
};

const PHASE_COLORS: Record<PushPhase, string> = {
  SUBMISSION: "var(--accent)",
  LISTENING: "#6366f1",
  RANKING: "#6366f1",
  RESULT: "#10b981",
};

const RULES = [
  "Lançamento máximo de 12 meses (data do álbum no Spotify)",
  "Cada música só pode ser indicada uma única vez em qualquer rodada",
  "Cada membro indica exatamente 1 música por rodada",
  "Músicas ficam ocultas até o encerramento das inscrições",
  "O membro não pode avaliar a própria música indicada",
  "Pontuação: #1 = 20 pts → último = 1 pt (decaimento geométrico)",
];

const NAV_ITEMS = ["Rodadas", "Membros", "Regras", "Histórico"];

function toLocalDatetimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inputToISO(local: string) {
  return new Date(local).toISOString();
}

function formatShort(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Stage Timeline ───────────────────────────────────────────────────────────

function StageTimeline({ round }: { round: RoundRow }) {
  const currentIdx =
    round.phase === "SUBMISSION" ? 0
    : isListenAndRankPhase(round.phase) ? 2
    : 3;

  const stages = [
    { name: "Inscrição", start: formatShort(round.createdAt), end: formatShort(round.submissionEndsAt) },
    { name: "Revelação", start: formatShort(round.submissionEndsAt), end: formatShort(round.listeningEndsAt) },
    { name: "Escuta & Avaliação", start: formatShort(round.listeningEndsAt), end: formatShort(round.rankingEndsAt) },
    { name: "Resultado", start: formatShort(round.rankingEndsAt), end: "—" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {stages.map((s, i) => {
        const status = i < currentIdx ? "done" : i === currentIdx ? "active" : "pending";
        const dotColor = status === "done" ? "#10b981" : status === "active" ? "var(--accent)" : "var(--divider-strong)";
        const isActive = status === "active";

        return (
          <div
            key={s.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 11,
              background: isActive ? "var(--accent)0C" : "var(--fill-inset)",
              border: `1.5px solid ${isActive ? "var(--accent)30" : "var(--divider)"}`,
            }}
          >
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: dotColor,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: status === "pending" ? "var(--text-muted)" : "var(--text)",
                }}
              >
                {s.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {status !== "pending" ? `${s.start} → ${s.end}` : "Aguardando etapa anterior"}
              </div>
            </div>
            {status === "done" && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, color: "#10b981", fontSize: 11, fontWeight: 600 }}>
                <Check size={10} /> Concluída
              </div>
            )}
            {status === "active" && (
              <div
                style={{
                  padding: "3px 9px",
                  borderRadius: 100,
                  background: "var(--accent)1A",
                  color: "var(--accent)",
                  fontSize: 11,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                Em andamento
              </div>
            )}
            {status === "pending" && (
              <div style={{ color: "var(--divider-strong)", fontSize: 11, whiteSpace: "nowrap" }}>Pendente</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Duration Controls ────────────────────────────────────────────────────────

function DurationControls({
  durations,
  onChange,
}: {
  durations: { sub: number; listenVote: number };
  onChange: (d: { sub: number; listenVote: number }) => void;
}) {
  const fields: { key: keyof typeof durations; label: string }[] = [
    { key: "sub", label: "Inscrição" },
    { key: "listenVote", label: "Escuta & Avaliação" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {fields.map(({ key, label }) => (
        <div
          key={key}
          style={{
            background: "var(--fill-inset)",
            borderRadius: 12,
            padding: "13px 15px",
            border: "1px solid var(--divider)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-muted)",
                letterSpacing: ".04em",
                textTransform: "uppercase" as const,
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", letterSpacing: "-.03em" }}>
              {durations[key]}h
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={168}
            value={durations[key]}
            onChange={(e) => onChange({ ...durations, [key]: Number(e.target.value) })}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Create Form ──────────────────────────────────────────────────────────────

function CreateRoundForm({
  durations,
  onCreated,
  onCancel,
}: {
  durations: { sub: number; listenVote: number };
  onCreated: (round: RoundRow) => void;
  onCancel: () => void;
}) {
  const now = new Date();
  const addHours = (h: number) => {
    const d = new Date(now.getTime() + h * 3600000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [form, setForm] = useState({
    season: 1,
    submissionEndsAt: addHours(durations.sub),
    listeningEndsAt: addHours(durations.sub),
    listenVoteEndsAt: addHours(durations.sub + durations.listenVote),
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid var(--divider-strong)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  async function handleCreate() {
    if (!form.submissionEndsAt || !form.listeningEndsAt || !form.listenVoteEndsAt) {
      setError("Preencha todas as datas");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season: form.season,
          submissionEndsAt: inputToISO(form.submissionEndsAt),
          listeningEndsAt: inputToISO(form.listeningEndsAt),
          rankingEndsAt: inputToISO(form.listenVoteEndsAt),
        }),
      });
      const data = (await res.json()) as RoundRow & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erro");
        return;
      }
      onCreated({ ...data, submissionCount: 0 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        padding: "18px 20px",
        borderRadius: 14,
        background: "var(--surface)",
        border: "1px solid var(--divider)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Nova rodada</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -4 }}>
        O título será gerado automaticamente: Push - Temporada N - Rodada N
      </div>
      <div style={{ maxWidth: 120 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
          Temporada
        </label>
        <input
          type="number"
          value={form.season}
          onChange={(e) => setForm((f) => ({ ...f, season: Number(e.target.value) }))}
          min={1}
          style={inputStyle}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            Inscrições até
          </label>
          <input
            type="datetime-local"
            value={form.submissionEndsAt}
            onChange={(e) => setForm((f) => ({ ...f, submissionEndsAt: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            Escuta começa
          </label>
          <input
            type="datetime-local"
            value={form.listeningEndsAt}
            onChange={(e) => setForm((f) => ({ ...f, listeningEndsAt: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            Escuta & Avaliação até
          </label>
          <input
            type="datetime-local"
            value={form.listenVoteEndsAt}
            onChange={(e) => setForm((f) => ({ ...f, listenVoteEndsAt: e.target.value }))}
            style={inputStyle}
          />
        </div>
      </div>
      {error && <div style={{ color: "var(--accent)", fontSize: 13 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            fontWeight: 700,
            fontSize: 13,
            cursor: busy ? "not-allowed" : "pointer",
            background: "var(--accent)",
            color: "white",
            fontFamily: "inherit",
          }}
        >
          {busy ? "Criando…" : "Criar rodada"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            background: "var(--fill-inset)",
            color: "var(--text)",
            fontFamily: "inherit",
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Round List Item ──────────────────────────────────────────────────────────

function RoundListItem({
  round,
  integrations,
  onAdvance,
  onCreatePlaylist,
  onCreateYoutubePlaylist,
  onSyncPlaylists,
  onDelete,
  onUpdate,
  busy,
  msg,
  defaultExpanded = false,
}: {
  round: RoundRow;
  integrations: IntegrationStatus;
  onAdvance: () => void;
  onCreatePlaylist: () => void;
  onCreateYoutubePlaylist: () => void;
  onSyncPlaylists: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<{ submissionEndsAt: string; listeningEndsAt: string; rankingEndsAt: string; spotifyPlaylistId: string; youtubePlaylistId: string }>) => void;
  busy: boolean;
  msg: { text: string; ok: boolean } | null;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const color = PHASE_COLORS[round.phase];

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 7,
    border: "1px solid var(--divider-strong)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 12,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--divider)", background: "var(--surface)", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left" as const,
        }}
      >
        <ChevronRight
          size={16}
          color="var(--text-muted)"
          style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            {pushRoundTitle(round.season, round.number)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
            {round.submissionCount} inscrições · {PHASE_LABELS[round.phase]}
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 9px",
            borderRadius: 100,
            background: color + "22",
            color,
          }}
        >
          {PHASE_LABELS[round.phase]}
        </span>
      </button>

      {expanded && (
        <div
          style={{
            padding: "0 16px 16px",
            borderTop: "1px solid var(--divider)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ height: 12 }} />
          <PlaylistSetupBanner
            round={round}
            integrations={integrations}
            onSyncPlaylists={onSyncPlaylists}
            syncBusy={busy}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
            {PHASE_NEXT[round.phase] && (
              <button
                type="button"
                onClick={onAdvance}
                disabled={busy}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "none",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: busy ? "not-allowed" : "pointer",
                  background: "var(--accent)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: "inherit",
                }}
              >
                <ChevronRight size={13} />
                {busy ? "Avançando…" : PHASE_NEXT[round.phase]}
              </button>
            )}
            {(isListenAndRankPhase(round.phase) || round.phase === "RESULT") &&
              (!round.spotifyPlaylistId || !round.youtubePlaylistId) && (
                <PlaylistSyncButton onClick={onSyncPlaylists} busy={busy} />
              )}
            {(isListenAndRankPhase(round.phase) || round.phase === "RESULT") &&
              !round.spotifyPlaylistId && (
                <button
                  type="button"
                  onClick={onCreatePlaylist}
                  disabled={busy}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: "none",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: busy ? "not-allowed" : "pointer",
                    background: "#1ed760",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontFamily: "inherit",
                  }}
                >
                  <RefreshCw size={13} />
                  {busy ? "Criando…" : "Criar playlist Spotify"}
                </button>
              )}
            {round.spotifyPlaylistId && (
              <a
                href={`https://open.spotify.com/playlist/${round.spotifyPlaylistId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "none",
                  fontWeight: 700,
                  fontSize: 12,
                  background: "#1ed760",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={13} />
                Spotify
              </a>
            )}
            {(isListenAndRankPhase(round.phase) || round.phase === "RESULT") &&
              !round.youtubePlaylistId && (
                <button
                  type="button"
                  onClick={onCreateYoutubePlaylist}
                  disabled={busy}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: "none",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: busy ? "not-allowed" : "pointer",
                    background: "#FF0000",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontFamily: "inherit",
                  }}
                >
                  <RefreshCw size={13} />
                  {busy ? "Criando…" : "Criar playlist YouTube"}
                </button>
              )}
            {round.youtubePlaylistId && (
              <a
                href={`https://www.youtube.com/playlist?list=${round.youtubePlaylistId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "none",
                  fontWeight: 700,
                  fontSize: 12,
                  background: "#FF0000",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={13} />
                YouTube
              </a>
            )}
          </div>

          {msg && (
            <div style={{ fontSize: 12, color: msg.ok ? "#10b981" : "#dc2626", fontWeight: 600 }}>{msg.text}</div>
          )}

          <EditDatesInline round={round} onSave={onUpdate} busy={busy} inputStyle={inputStyle} />

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              ID Playlist Spotify (manual)
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                defaultValue={round.spotifyPlaylistId ?? ""}
                id={`playlist-${round.id}`}
                placeholder="Ex: 37i9dQZF1DX..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => {
                  const val = (document.getElementById(`playlist-${round.id}`) as HTMLInputElement).value.trim();
                  onUpdate({ spotifyPlaylistId: val || "" });
                }}
                style={{ padding: "7px 12px", borderRadius: 7, border: "none", fontWeight: 600, fontSize: 12, cursor: "pointer", background: "var(--fill-inset)", color: "var(--text)", fontFamily: "inherit", flexShrink: 0 }}
              >
                Salvar
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              ID Playlist YouTube @chartFM (manual)
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                defaultValue={round.youtubePlaylistId ?? ""}
                id={`yt-playlist-${round.id}`}
                placeholder="Ex: PLrAXtmRdnEQy6nuLMH..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => {
                  const val = (document.getElementById(`yt-playlist-${round.id}`) as HTMLInputElement).value.trim();
                  onUpdate({ youtubePlaylistId: val || "" });
                }}
                style={{ padding: "7px 12px", borderRadius: 7, border: "none", fontWeight: 600, fontSize: 12, cursor: "pointer", background: "var(--fill-inset)", color: "var(--text)", fontFamily: "inherit", flexShrink: 0 }}
              >
                Salvar
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              style={{
                padding: "7px 12px",
                borderRadius: 7,
                border: "none",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
                background: "var(--fill-inset)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontFamily: "inherit",
              }}
            >
              <Trash2 size={13} />
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditDatesInline({
  round,
  onSave,
  busy,
  inputStyle,
}: {
  round: RoundRow;
  onSave: (u: { submissionEndsAt: string; listeningEndsAt: string; rankingEndsAt: string }) => void;
  busy: boolean;
  inputStyle: React.CSSProperties;
}) {
  const [sub, setSub] = useState(toLocalDatetimeInput(round.submissionEndsAt));
  const [listenStart, setListenStart] = useState(toLocalDatetimeInput(round.listeningEndsAt));
  const [listenVote, setListenVote] = useState(toLocalDatetimeInput(round.rankingEndsAt));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Inscrições até</label>
          <input type="datetime-local" value={sub} onChange={(e) => setSub(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Escuta começa</label>
          <input type="datetime-local" value={listenStart} onChange={(e) => setListenStart(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Escuta & Avaliação até</label>
          <input type="datetime-local" value={listenVote} onChange={(e) => setListenVote(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => onSave({
          submissionEndsAt: inputToISO(sub),
          listeningEndsAt: inputToISO(listenStart),
          rankingEndsAt: inputToISO(listenVote),
        })}
        disabled={busy}
        style={{ padding: "7px 12px", borderRadius: 7, border: "none", fontWeight: 600, fontSize: 12, cursor: busy ? "not-allowed" : "pointer", background: "var(--fill-inset)", color: "var(--text)", alignSelf: "flex-start", fontFamily: "inherit" }}
      >
        {busy ? "Salvando…" : "Atualizar datas"}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PushAdminClient({
  initialRounds,
  integrations: initialIntegrations,
}: {
  initialRounds: RoundRow[];
  integrations: IntegrationStatus;
}) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [rounds, setRounds] = useState<RoundRow[]>(initialRounds);
  const [integrations, setIntegrations] = useState<IntegrationStatus>(initialIntegrations);
  const [activeNav, setActiveNav] = useState("Rodadas");
  const [creating, setCreating] = useState(false);
  const [durations, setDurations] = useState({ sub: 48, listenVote: 96 });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, { text: string; ok: boolean }>>({});

  const currentRound = rounds[0] ?? null;

  function flash(id: string, text: string, ok: boolean) {
    setMsgs((m) => ({ ...m, [id]: { text, ok } }));
    setTimeout(() => setMsgs((m) => { const n = { ...m }; delete n[id]; return n; }), 5000);
  }

  useEffect(() => {
    fetch("/api/user/profile", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { spotifyConnected?: boolean; youtubeConnected?: boolean; youtubeChannelHandle?: string | null } | null) => {
        if (!data) return;
        setIntegrations({
          spotifyConnected: data.spotifyConnected ?? false,
          youtubeConnected: data.youtubeConnected ?? false,
          youtubeChannelHandle: data.youtubeChannelHandle ?? null,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyParam = params.get("spotify");
    const spotifyReason = params.get("spotify_reason");
    const youtubeParam = params.get("youtube");
    const youtubeReason = params.get("youtube_reason");
    if (!spotifyParam && !youtubeParam) return;

    if (spotifyParam === "connected" || spotifyParam === "connected_no_playlist") {
      flash("oauth", "Spotify conectado! Clique em “Criar playlists (Spotify + YouTube)”.", true);
    } else if (spotifyParam) {
      flash(
        "oauth",
        spotifyConnectErrorMessage(spotifyParam, spotifyReason) ?? "Erro ao conectar o Spotify.",
        false,
      );
    }

    if (youtubeParam === "connected") {
      flash("oauth", "YouTube conectado! Clique em “Criar playlists (Spotify + YouTube)”.", true);
    } else if (youtubeParam) {
      flash(
        "oauth",
        youtubeConnectErrorMessage(youtubeParam, youtubeReason) ?? "Erro ao conectar o YouTube.",
        false,
      );
    }

    router.replace("/admin/push");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdvancePhase(roundId: string) {
    setBusyId(roundId + "-advance");
    try {
      const res = await fetch(`/api/admin/push/${roundId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advancePhase: true }),
      });
      const data = (await res.json()) as RoundRow & {
        error?: string;
        playlistSync?: {
          spotify: { ok: boolean; message?: string; playlistUrl?: string } | null;
          youtube: { ok: boolean; message?: string; playlistUrl?: string; videoCount?: number } | null;
        } | null;
      };
      if (!res.ok) { flash(roundId, data.error ?? "Erro", false); return; }
      setRounds((prev) => prev.map((r) => r.id === roundId ? {
        ...r,
        phase: data.phase,
        listeningEndsAt: data.listeningEndsAt ?? r.listeningEndsAt,
        spotifyPlaylistId: data.spotifyPlaylistId ?? r.spotifyPlaylistId,
        youtubePlaylistId: data.youtubePlaylistId ?? r.youtubePlaylistId,
      } : r));

      const warnings: string[] = [];
      if (data.playlistSync?.spotify && !data.playlistSync.spotify.ok) {
        warnings.push(`Spotify: ${data.playlistSync.spotify.message}`);
      }
      if (data.playlistSync?.youtube && !data.playlistSync.youtube.ok) {
        warnings.push(`YouTube: ${data.playlistSync.youtube.message}`);
      }

      const okParts: string[] = [`Fase avançada para ${PHASE_LABELS[data.phase]}`];
      if (data.playlistSync?.spotify?.ok) okParts.push("Spotify ✓");
      if (data.playlistSync?.youtube?.ok) {
        const n = data.playlistSync.youtube.videoCount;
        okParts.push(n ? `YouTube ✓ (${n} vídeos)` : "YouTube ✓");
      }

      if (warnings.length > 0) {
        flash(roundId, `${okParts.join(" · ")} — ${warnings.join(" · ")}`, false);
      } else {
        flash(roundId, okParts.join(" · "), true);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleSyncPlaylists(roundId: string) {
    setBusyId(roundId + "-sync");
    try {
      const res = await fetch(`/api/admin/push/${roundId}/sync-playlists`, { method: "POST" });
      const data = (await res.json()) as {
        spotifyPlaylistId?: string | null;
        youtubePlaylistId?: string | null;
        playlistSync?: {
          spotify: { ok: boolean; message?: string; needsReconnect?: boolean } | null;
          youtube: { ok: boolean; message?: string; needsReconnect?: boolean; videoCount?: number } | null;
        };
        error?: string;
      };

      if (data.spotifyPlaylistId || data.youtubePlaylistId) {
        setRounds((prev) =>
          prev.map((r) =>
            r.id === roundId
              ? {
                  ...r,
                  spotifyPlaylistId: data.spotifyPlaylistId ?? r.spotifyPlaylistId,
                  youtubePlaylistId: data.youtubePlaylistId ?? r.youtubePlaylistId,
                }
              : r,
          ),
        );
      }

      const parts: string[] = [];
      const errors: string[] = [];

      if (data.playlistSync?.spotify?.ok) parts.push("Spotify ✓");
      else if (data.playlistSync?.spotify) {
        errors.push(`Spotify: ${data.playlistSync.spotify.message}`);
      }

      if (data.playlistSync?.youtube?.ok) {
        const n = data.playlistSync.youtube.videoCount;
        parts.push(n ? `YouTube ✓ (${n} vídeos)` : "YouTube ✓");
      } else if (data.playlistSync?.youtube) {
        errors.push(`YouTube: ${data.playlistSync.youtube.message}`);
      }

      if (parts.length > 0 && errors.length === 0) {
        flash(roundId, parts.join(" · "), true);
      } else if (parts.length > 0) {
        flash(roundId, `${parts.join(" · ")} — ${errors.join(" · ")}`, false);
      } else {
        flash(
          roundId,
          errors.length > 0
            ? `${errors.join(" · ")} — reconecte em /settings`
            : data.error ?? "Não foi possível criar as playlists",
          false,
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreatePlaylist(roundId: string) {
    setBusyId(roundId + "-playlist");
    try {
      const res = await fetch(`/api/admin/push/${roundId}/playlist`, { method: "POST" });
      const data = (await res.json()) as { playlistId?: string; error?: string; needsReconnect?: boolean };
      if (!res.ok) {
        flash(
          roundId,
          data.needsReconnect
            ? `${data.error ?? "Erro"} — reconecte em /settings`
            : data.error ?? "Erro ao criar playlist",
          false,
        );
        return;
      }
      setRounds((prev) => prev.map((r) => r.id === roundId ? { ...r, spotifyPlaylistId: data.playlistId ?? r.spotifyPlaylistId } : r));
      flash(roundId, "Playlist criada no Spotify!", true);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateYoutubePlaylist(roundId: string) {
    setBusyId(roundId + "-yt-playlist");
    try {
      const res = await fetch(`/api/admin/push/${roundId}/youtube-playlist`, { method: "POST" });
      const data = (await res.json()) as {
        playlistId?: string;
        videoCount?: number;
        missingCount?: number;
        error?: string;
        needsReconnect?: boolean;
      };
      if (!res.ok) {
        flash(
          roundId,
          data.needsReconnect
            ? `${data.error ?? "Erro"} — reconecte YouTube em /settings`
            : data.error ?? "Erro ao criar playlist YouTube",
          false,
        );
        return;
      }
      setRounds((prev) =>
        prev.map((r) => (r.id === roundId ? { ...r, youtubePlaylistId: data.playlistId ?? r.youtubePlaylistId } : r)),
      );
      const extra = data.missingCount ? ` (${data.missingCount} música(s) sem vídeo)` : "";
      flash(roundId, `Playlist YouTube criada com ${data.videoCount ?? 0} vídeos${extra}!`, true);
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdate(
    roundId: string,
    updates: Partial<{ submissionEndsAt: string; listeningEndsAt: string; rankingEndsAt: string; spotifyPlaylistId: string; youtubePlaylistId: string }>
  ) {
    setBusyId(roundId + "-update");
    try {
      const res = await fetch(`/api/admin/push/${roundId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = (await res.json()) as RoundRow & { error?: string };
      if (!res.ok) { flash(roundId, data.error ?? "Erro", false); return; }
      setRounds((prev) => prev.map((r) => r.id === roundId ? { ...r, ...data } : r));
      flash(roundId, "Salvo!", true);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(roundId: string) {
    if (!confirm("Excluir esta rodada? Esta ação não pode ser desfeita.")) return;
    setBusyId(roundId + "-delete");
    try {
      await fetch(`/api/admin/push/${roundId}`, { method: "DELETE" });
      setRounds((prev) => prev.filter((r) => r.id !== roundId));
    } finally {
      setBusyId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const sidebarContent = (
    <>
      <div
        style={{
          padding: isMobile ? "0 0 12px" : "0 20px 18px",
          borderBottom: "1px solid var(--divider)",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 900, color: "var(--text)", letterSpacing: "-.025em" }}>
          PUSH
        </div>
        {!isMobile && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Painel Administrativo</div>
        )}
      </div>
      <div
        style={{
          padding: isMobile ? "0" : "0 12px",
          display: "flex",
          flexDirection: isMobile ? "row" : "column",
          gap: 2,
        }}
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item}
            onClick={() => setActiveNav(item)}
            style={{
              padding: isMobile ? "6px 12px" : "8px 12px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: activeNav === item ? 700 : 500,
              color: activeNav === item ? "var(--accent)" : "var(--text-muted)",
              background: activeNav === item ? "var(--accent)14" : "transparent",
              cursor: "pointer",
              border: "none",
              fontFamily: "inherit",
              textAlign: "left" as const,
              whiteSpace: "nowrap",
            }}
          >
            {item}
          </button>
        ))}
      </div>
    </>
  );

  const mainContent = (
    <>
      {/* Main header */}
      <div
        style={{
          padding: "18px 26px",
          borderBottom: "1px solid var(--divider)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          flexWrap: "wrap" as const,
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              letterSpacing: ".06em",
              textTransform: "uppercase" as const,
              marginBottom: 3,
            }}
          >
            Gerenciar
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", letterSpacing: "-.025em" }}>
            {currentRound
              ? pushRoundTitle(currentRound.season, currentRound.number)
              : "Nenhuma rodada"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          {currentRound &&
            canRunPlaylistSync(currentRound, integrations) && (
              <PlaylistSyncButton
                onClick={() => handleSyncPlaylists(currentRound.id)}
                busy={busyId === currentRound.id + "-sync"}
                size="lg"
              />
            )}
          {currentRound && PHASE_NEXT[currentRound.phase] && (
            <button
              type="button"
              onClick={() => handleAdvancePhase(currentRound.id)}
              disabled={!!busyId}
              style={{
                padding: "8px 16px",
                borderRadius: 100,
                background: "var(--fill-inset)",
                color: "var(--text)",
                border: "1px solid var(--divider)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Encerrar etapa
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreating(true)}
            style={{
              padding: "8px 16px",
              borderRadius: 100,
              background: "var(--accent)",
              color: "white",
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Plus size={14} /> Nova Rodada
          </button>
        </div>
      </div>

      {/* Main scrollable area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }}>
        {activeNav === "Rodadas" && (
          <>
            {creating && (
              <CreateRoundForm
                durations={durations}
                onCreated={(r) => {
                  setRounds((prev) => [r, ...prev]);
                  setCreating(false);
                }}
                onCancel={() => setCreating(false)}
              />
            )}

            {/* Stage timeline + Duration controls */}
            {currentRound && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  gap: 24,
                  marginBottom: 24,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      letterSpacing: ".07em",
                      textTransform: "uppercase" as const,
                      marginBottom: 14,
                    }}
                  >
                    Etapas da Rodada #{currentRound.number}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {msgs.oauth && (
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: msgs.oauth.ok ? "#10b981" : "#dc2626",
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: msgs.oauth.ok ? "rgba(16,185,129,0.08)" : "rgba(220,38,38,0.08)",
                        }}
                      >
                        {msgs.oauth.text}
                      </div>
                    )}
                    <PlaylistSetupBanner
                      round={currentRound}
                      integrations={integrations}
                      onSyncPlaylists={() => handleSyncPlaylists(currentRound.id)}
                      syncBusy={busyId === currentRound.id + "-sync"}
                    />
                    <StageTimeline round={currentRound} />
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      letterSpacing: ".07em",
                      textTransform: "uppercase" as const,
                      marginBottom: 14,
                    }}
                  >
                    Duração das Etapas (próxima rodada)
                  </div>
                  <DurationControls durations={durations} onChange={setDurations} />
                </div>
              </div>
            )}

            {rounds.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "40px 0" }}>
                Nenhuma rodada ainda.
              </div>
            )}

            {/* Round list */}
            {rounds.length > 0 && (
              <div style={{ marginTop: currentRound ? 0 : 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    letterSpacing: ".07em",
                    textTransform: "uppercase" as const,
                    marginBottom: 12,
                  }}
                >
                  Todas as rodadas
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rounds.map((round, index) => (
                    <RoundListItem
                      key={round.id}
                      round={round}
                      integrations={integrations}
                      defaultExpanded={index === 0}
                      onAdvance={() => handleAdvancePhase(round.id)}
                      onCreatePlaylist={() => handleCreatePlaylist(round.id)}
                      onCreateYoutubePlaylist={() => handleCreateYoutubePlaylist(round.id)}
                      onSyncPlaylists={() => handleSyncPlaylists(round.id)}
                      onDelete={() => handleDelete(round.id)}
                      onUpdate={(u) => handleUpdate(round.id, u)}
                      busy={!!busyId?.startsWith(round.id)}
                      msg={msgs[round.id] ?? null}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeNav === "Regras" && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text-muted)",
                letterSpacing: ".07em",
                textTransform: "uppercase" as const,
                marginBottom: 14,
              }}
            >
              Regras Ativas
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 8,
              }}
            >
              {RULES.map((rule, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 9,
                    alignItems: "flex-start",
                    padding: "9px 12px",
                    background: "var(--fill-inset)",
                    borderRadius: 10,
                    border: "1px solid var(--divider)",
                  }}
                >
                  <div
                    style={{
                      width: 17,
                      height: 17,
                      borderRadius: 8.5,
                      background: "var(--accent)18",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontWeight: 800,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>{rule}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeNav === "Membros" && (
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Gestão de membros em breve.
          </div>
        )}

        {activeNav === "Histórico" && (
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Histórico completo em breve.
          </div>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--divider)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 16px 0" }}>{sidebarContent}</div>
        <div style={{ display: "flex", flexDirection: "column", minHeight: 400 }}>{mainContent}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 16,
        border: "1px solid var(--divider)",
        boxShadow: "0 4px 24px rgba(0,0,0,.07)",
        minHeight: 640,
        display: "flex",
        overflow: "hidden",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 210,
          background: "var(--fill-inset)",
          borderRight: "1px solid var(--divider)",
          display: "flex",
          flexDirection: "column",
          padding: "22px 0",
          flexShrink: 0,
        }}
      >
        {sidebarContent}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {mainContent}
      </div>
    </div>
  );
}
