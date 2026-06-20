"use client";

import { useState } from "react";
import { Trash2, ExternalLink, RefreshCw, ChevronRight } from "lucide-react";
import { pushRoundTitle } from "@/lib/push-format";
import type { RoundRow, IntegrationStatus } from "./push-admin-types";
import {
  PHASE_COLORS, PHASE_LABELS, PHASE_NEXT,
  isListenAndRankPhase, canRunPlaylistSync,
  toLocalDatetimeInput, inputToISO,
} from "./push-admin-helpers";

export function PlaylistSyncButton({
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
    <button type="button" onClick={onClick} disabled={busy}
      style={{
        padding: large ? "10px 18px" : "7px 14px", borderRadius: large ? 10 : 8, border: "none",
        fontWeight: 700, fontSize: large ? 13 : 12, cursor: busy ? "not-allowed" : "pointer",
        background: "var(--accent)", color: "white",
        display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit",
      }}>
      <RefreshCw size={large ? 14 : 13} />
      {busy ? "Sincronizando…" : "Criar playlists (Spotify + YouTube)"}
    </button>
  );
}

export function PlaylistSetupBanner({
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
  if (needsSpotify && !integrations.spotifyConnected) issues.push("Spotify não conectado");
  else if (needsSpotify) issues.push("Playlists ainda não criadas — use o botão abaixo");
  if (needsYoutube && !integrations.youtubeConnected) issues.push("YouTube @chartFM não conectado");

  return (
    <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>Playlists não criadas para esta rodada</div>
      {issues.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#991b1b", lineHeight: 1.5 }}>
          {issues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {needsSpotify && !integrations.spotifyConnected && (
          <a href="/api/spotify/connect?from=/admin/push&reconnect=1" style={{ fontSize: 12, fontWeight: 600, color: "#b91c1c", textDecoration: "underline" }}>
            Conectar Spotify
          </a>
        )}
        {needsYoutube && !integrations.youtubeConnected && (
          <a href="/api/youtube/connect?from=/admin/push" style={{ fontSize: 12, fontWeight: 600, color: "#b91c1c", textDecoration: "underline" }}>
            Conectar YouTube
          </a>
        )}
        {((needsSpotify && integrations.spotifyConnected) || (needsYoutube && integrations.youtubeConnected)) && (
          <a href="/settings" style={{ fontSize: 12, fontWeight: 600, color: "#b91c1c", textDecoration: "underline" }}>
            Abrir Configurações
          </a>
        )}
        {onSyncPlaylists && canRunPlaylistSync(round, integrations) && (
          <PlaylistSyncButton onClick={onSyncPlaylists} busy={!!syncBusy} />
        )}
      </div>
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
  const [sub, setSub]             = useState(toLocalDatetimeInput(round.submissionEndsAt));
  const [listenStart, setListenStart] = useState(toLocalDatetimeInput(round.listeningEndsAt));
  const [listenVote, setListenVote]   = useState(toLocalDatetimeInput(round.rankingEndsAt));

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
      <button type="button"
        onClick={() => onSave({ submissionEndsAt: inputToISO(sub), listeningEndsAt: inputToISO(listenStart), rankingEndsAt: inputToISO(listenVote) })}
        disabled={busy}
        style={{ padding: "7px 12px", borderRadius: 7, border: "none", fontWeight: 600, fontSize: 12, cursor: busy ? "not-allowed" : "pointer", background: "var(--fill-inset)", color: "var(--text)", alignSelf: "flex-start", fontFamily: "inherit" }}>
        {busy ? "Salvando…" : "Atualizar datas"}
      </button>
    </div>
  );
}

export function RoundListItem({
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
    width: "100%", padding: "8px 10px", borderRadius: 7,
    border: "1px solid var(--divider-strong)", background: "var(--surface)",
    color: "var(--text)", fontSize: 12, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  };

  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--divider)", background: "var(--surface)", overflow: "hidden" }}>
      <button type="button" onClick={() => setExpanded((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" as const }}>
        <ChevronRight size={16} color="var(--text-muted)" style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{pushRoundTitle(round.season, round.number)}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{round.submissionCount} inscrições · {PHASE_LABELS[round.phase]}</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: color + "22", color }}>{PHASE_LABELS[round.phase]}</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--divider)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ height: 12 }} />
          <PlaylistSetupBanner round={round} integrations={integrations} onSyncPlaylists={onSyncPlaylists} syncBusy={busy} />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
            {PHASE_NEXT[round.phase] && (
              <button type="button" onClick={onAdvance} disabled={busy}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 12, cursor: busy ? "not-allowed" : "pointer", background: "var(--accent)", color: "white", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
                <ChevronRight size={13} />
                {busy ? "Avançando…" : PHASE_NEXT[round.phase]}
              </button>
            )}
            {(isListenAndRankPhase(round.phase) || round.phase === "RESULT") && (!round.spotifyPlaylistId || !round.youtubePlaylistId) && (
              <PlaylistSyncButton onClick={onSyncPlaylists} busy={busy} />
            )}
            {(isListenAndRankPhase(round.phase) || round.phase === "RESULT") && !round.spotifyPlaylistId && (
              <button type="button" onClick={onCreatePlaylist} disabled={busy}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 12, cursor: busy ? "not-allowed" : "pointer", background: "#1ed760", color: "white", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
                <RefreshCw size={13} />
                {busy ? "Criando…" : "Criar playlist Spotify"}
              </button>
            )}
            {round.spotifyPlaylistId && (
              <a href={`https://open.spotify.com/playlist/${round.spotifyPlaylistId}`} target="_blank" rel="noopener noreferrer"
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 12, background: "#1ed760", color: "white", display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
                <ExternalLink size={13} /> Spotify
              </a>
            )}
            {(isListenAndRankPhase(round.phase) || round.phase === "RESULT") && !round.youtubePlaylistId && (
              <button type="button" onClick={onCreateYoutubePlaylist} disabled={busy}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 12, cursor: busy ? "not-allowed" : "pointer", background: "#FF0000", color: "white", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
                <RefreshCw size={13} />
                {busy ? "Criando…" : "Criar playlist YouTube"}
              </button>
            )}
            {round.youtubePlaylistId && (
              <a href={`https://www.youtube.com/playlist?list=${round.youtubePlaylistId}`} target="_blank" rel="noopener noreferrer"
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 12, background: "#FF0000", color: "white", display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
                <ExternalLink size={13} /> YouTube
              </a>
            )}
          </div>

          {msg && <div style={{ fontSize: 12, color: msg.ok ? "#10b981" : "#dc2626", fontWeight: 600 }}>{msg.text}</div>}

          <EditDatesInline round={round} onSave={onUpdate} busy={busy} inputStyle={inputStyle} />

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>ID Playlist Spotify (manual)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="text" defaultValue={round.spotifyPlaylistId ?? ""} id={`playlist-${round.id}`}
                placeholder="Ex: 37i9dQZF1DX..." style={{ ...inputStyle, flex: 1 }} />
              <button type="button"
                onClick={() => {
                  const val = (document.getElementById(`playlist-${round.id}`) as HTMLInputElement).value.trim();
                  onUpdate({ spotifyPlaylistId: val || "" });
                }}
                style={{ padding: "7px 12px", borderRadius: 7, border: "none", fontWeight: 600, fontSize: 12, cursor: "pointer", background: "var(--fill-inset)", color: "var(--text)", fontFamily: "inherit", flexShrink: 0 }}>
                Salvar
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>ID Playlist YouTube @chartFM (manual)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="text" defaultValue={round.youtubePlaylistId ?? ""} id={`yt-playlist-${round.id}`}
                placeholder="Ex: PLrAXtmRdnEQy6nuLMH..." style={{ ...inputStyle, flex: 1 }} />
              <button type="button"
                onClick={() => {
                  const val = (document.getElementById(`yt-playlist-${round.id}`) as HTMLInputElement).value.trim();
                  onUpdate({ youtubePlaylistId: val || "" });
                }}
                style={{ padding: "7px 12px", borderRadius: 7, border: "none", fontWeight: 600, fontSize: 12, cursor: "pointer", background: "var(--fill-inset)", color: "var(--text)", fontFamily: "inherit", flexShrink: 0 }}>
                Salvar
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={onDelete} disabled={busy}
              style={{ padding: "7px 12px", borderRadius: 7, border: "none", fontWeight: 600, fontSize: 12, cursor: "pointer", background: "var(--fill-inset)", color: "var(--accent)", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
