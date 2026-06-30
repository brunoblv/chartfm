"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { pushRoundTitle } from "@/lib/push-format";
import { spotifyConnectErrorMessage } from "@/lib/spotify-connect-messages";
import { youtubeConnectErrorMessage } from "@/lib/youtube-connect-messages";
import type { RoundRow, IntegrationStatus } from "@/components/push/admin/push-admin-types";
import { PHASE_LABELS, PHASE_NEXT, RULES, NAV_ITEMS, canRunPlaylistSync } from "@/components/push/admin/push-admin-helpers";
import { PlaylistSyncButton, PlaylistSetupBanner, RoundListItem } from "@/components/push/admin/PushAdminRoundItem";
import { StageTimeline, DurationControls, CreateRoundForm } from "@/components/push/admin/PushAdminForms";

export default function PushAdminClient({
  initialRounds,
  integrations: initialIntegrations,
}: {
  initialRounds: RoundRow[];
  integrations: IntegrationStatus;
}) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [rounds, setRounds]           = useState<RoundRow[]>(initialRounds);
  const [integrations, setIntegrations] = useState<IntegrationStatus>(initialIntegrations);
  const [activeNav, setActiveNav]     = useState("Rodadas");
  const [creating, setCreating]       = useState(false);
  const [durations, setDurations]     = useState({ sub: 48, listenVote: 96 });
  const [busyId, setBusyId]           = useState<string | null>(null);
  const [msgs, setMsgs]               = useState<Record<string, { text: string; ok: boolean }>>({});

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
      flash("oauth", 'Spotify conectado! Clique em "Criar playlists (Spotify + YouTube)".', true);
    } else if (spotifyParam) {
      flash("oauth", spotifyConnectErrorMessage(spotifyParam, spotifyReason) ?? "Erro ao conectar o Spotify.", false);
    }

    if (youtubeParam === "connected") {
      flash("oauth", 'YouTube conectado! Clique em "Criar playlists (Spotify + YouTube)".', true);
    } else if (youtubeParam) {
      flash("oauth", youtubeConnectErrorMessage(youtubeParam, youtubeReason) ?? "Erro ao conectar o YouTube.", false);
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
        ...r, phase: data.phase,
        listeningEndsAt: data.listeningEndsAt ?? r.listeningEndsAt,
        spotifyPlaylistId: data.spotifyPlaylistId ?? r.spotifyPlaylistId,
        youtubePlaylistId: data.youtubePlaylistId ?? r.youtubePlaylistId,
      } : r));

      const warnings: string[] = [];
      if (data.playlistSync?.spotify && !data.playlistSync.spotify.ok) warnings.push(`Spotify: ${data.playlistSync.spotify.message}`);
      if (data.playlistSync?.youtube && !data.playlistSync.youtube.ok) warnings.push(`YouTube: ${data.playlistSync.youtube.message}`);

      const okParts: string[] = [`Fase avançada para ${PHASE_LABELS[data.phase]}`];
      if (data.playlistSync?.spotify?.ok) okParts.push("Spotify ✓");
      if (data.playlistSync?.youtube?.ok) {
        const n = data.playlistSync.youtube.videoCount;
        okParts.push(n ? `YouTube ✓ (${n} vídeos)` : "YouTube ✓");
      }

      if (warnings.length > 0) flash(roundId, `${okParts.join(" · ")} — ${warnings.join(" · ")}`, false);
      else flash(roundId, okParts.join(" · "), true);
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
        setRounds((prev) => prev.map((r) => r.id === roundId ? {
          ...r,
          spotifyPlaylistId: data.spotifyPlaylistId ?? r.spotifyPlaylistId,
          youtubePlaylistId: data.youtubePlaylistId ?? r.youtubePlaylistId,
        } : r));
      }

      const parts: string[] = [];
      const errors: string[] = [];
      if (data.playlistSync?.spotify?.ok) parts.push("Spotify ✓");
      else if (data.playlistSync?.spotify) errors.push(`Spotify: ${data.playlistSync.spotify.message}`);
      if (data.playlistSync?.youtube?.ok) {
        const n = data.playlistSync.youtube.videoCount;
        parts.push(n ? `YouTube ✓ (${n} vídeos)` : "YouTube ✓");
      } else if (data.playlistSync?.youtube) {
        errors.push(`YouTube: ${data.playlistSync.youtube.message}`);
      }

      if (parts.length > 0 && errors.length === 0) flash(roundId, parts.join(" · "), true);
      else if (parts.length > 0) flash(roundId, `${parts.join(" · ")} — ${errors.join(" · ")}`, false);
      else flash(roundId, errors.length > 0 ? `${errors.join(" · ")} — reconecte em /settings` : data.error ?? "Não foi possível criar as playlists", false);
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
        flash(roundId, data.needsReconnect ? `${data.error ?? "Erro"} — reconecte em /settings` : data.error ?? "Erro ao criar playlist", false);
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
      const data = (await res.json()) as { playlistId?: string; videoCount?: number; missingCount?: number; error?: string; needsReconnect?: boolean };
      if (!res.ok) {
        flash(roundId, data.needsReconnect ? `${data.error ?? "Erro"} — reconecte YouTube em /settings` : data.error ?? "Erro ao criar playlist YouTube", false);
        return;
      }
      setRounds((prev) => prev.map((r) => r.id === roundId ? { ...r, youtubePlaylistId: data.playlistId ?? r.youtubePlaylistId } : r));
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

  const sidebarContent = (
    <>
      <div style={{ padding: isMobile ? "0 0 12px" : "0 20px 18px", borderBottom: "1px solid var(--divider)", marginBottom: 14 }}>
        <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 900, color: "var(--text)", letterSpacing: "-.025em" }}>PUSH</div>
        {!isMobile && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Painel Administrativo</div>}
      </div>
      <div style={{ padding: isMobile ? "0" : "0 12px", display: "flex", flexDirection: isMobile ? "row" : "column", gap: 2 }}>
        {NAV_ITEMS.map((item) => (
          <button key={item} onClick={() => setActiveNav(item)}
            style={{
              padding: isMobile ? "6px 12px" : "8px 12px", borderRadius: 8,
              fontSize: 13, fontWeight: activeNav === item ? 700 : 500,
              color: activeNav === item ? "var(--accent)" : "var(--text-muted)",
              background: activeNav === item ? "var(--accent)14" : "transparent",
              cursor: "pointer", border: "none", fontFamily: "inherit",
              textAlign: "left" as const, whiteSpace: "nowrap",
            }}>
            {item}
          </button>
        ))}
      </div>
    </>
  );

  const mainContent = (
    <>
      <div style={{
        padding: "18px 26px", borderBottom: "1px solid var(--divider)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, flexWrap: "wrap" as const, gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: ".06em", textTransform: "uppercase" as const, marginBottom: 3 }}>Gerenciar</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", letterSpacing: "-.025em" }}>
            {currentRound ? pushRoundTitle(currentRound.season, currentRound.number) : "Nenhuma rodada"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          {currentRound && canRunPlaylistSync(currentRound, integrations) && (
            <PlaylistSyncButton onClick={() => handleSyncPlaylists(currentRound.id)} busy={busyId === currentRound.id + "-sync"} size="lg" />
          )}
          {currentRound && PHASE_NEXT[currentRound.phase] && (
            <button type="button" onClick={() => handleAdvancePhase(currentRound.id)} disabled={!!busyId}
              style={{ padding: "8px 16px", borderRadius: 100, background: "var(--fill-inset)", color: "var(--text)", border: "1px solid var(--divider)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Encerrar etapa
            </button>
          )}
          <button type="button" onClick={() => setCreating(true)}
            style={{ padding: "8px 16px", borderRadius: 100, background: "var(--accent)", color: "white", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
            <Plus size={14} /> Nova Rodada
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }}>
        {activeNav === "Rodadas" && (
          <>
            {creating && (
              <CreateRoundForm durations={durations}
                onCreated={(r) => { setRounds((prev) => [r, ...prev]); setCreating(false); }}
                onCancel={() => setCreating(false)} />
            )}

            {currentRound && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24, marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase" as const, marginBottom: 14 }}>
                    Etapas da Rodada #{currentRound.number}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {msgs.oauth && (
                      <div style={{ fontSize: 12, fontWeight: 600, color: msgs.oauth.ok ? "#10b981" : "#dc2626", padding: "10px 12px", borderRadius: 8, background: msgs.oauth.ok ? "rgba(16,185,129,0.08)" : "rgba(220,38,38,0.08)" }}>
                        {msgs.oauth.text}
                      </div>
                    )}
                    <PlaylistSetupBanner round={currentRound} integrations={integrations}
                      onSyncPlaylists={() => handleSyncPlaylists(currentRound.id)}
                      syncBusy={busyId === currentRound.id + "-sync"} />
                    <StageTimeline round={currentRound} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase" as const, marginBottom: 14 }}>
                    Duração das Etapas (próxima rodada)
                  </div>
                  <DurationControls durations={durations} onChange={setDurations} />
                </div>
              </div>
            )}

            {rounds.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "40px 0" }}>Nenhuma rodada ainda.</div>
            )}

            {rounds.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase" as const, marginBottom: 12 }}>
                  Todas as rodadas
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rounds.map((round, index) => (
                    <RoundListItem key={round.id} round={round} integrations={integrations} defaultExpanded={index === 0}
                      onAdvance={() => handleAdvancePhase(round.id)}
                      onCreatePlaylist={() => handleCreatePlaylist(round.id)}
                      onCreateYoutubePlaylist={() => handleCreateYoutubePlaylist(round.id)}
                      onSyncPlaylists={() => handleSyncPlaylists(round.id)}
                      onDelete={() => handleDelete(round.id)}
                      onUpdate={(u) => handleUpdate(round.id, u)}
                      busy={!!busyId?.startsWith(round.id)}
                      msg={msgs[round.id] ?? null} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeNav === "Regras" && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase" as const, marginBottom: 14 }}>Regras Ativas</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
              {RULES.map((rule, i) => (
                <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 12px", background: "var(--fill-inset)", borderRadius: 10, border: "1px solid var(--divider)" }}>
                  <div style={{ width: 17, height: 17, borderRadius: 8.5, background: "var(--accent)18", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>
                    {i + 1}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>{rule}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeNav === "Membros" && <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Gestão de membros em breve.</div>}
        {activeNav === "Histórico" && <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Histórico completo em breve.</div>}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", overflow: "hidden" }}>
        <div style={{ padding: "16px 16px 0" }}>{sidebarContent}</div>
        <div style={{ display: "flex", flexDirection: "column", minHeight: 400 }}>{mainContent}</div>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)",
      boxShadow: "0 4px 24px rgba(0,0,0,.07)", minHeight: 640, display: "flex", overflow: "hidden",
    }}>
      <div style={{ width: 210, background: "var(--fill-inset)", borderRight: "1px solid var(--divider)", display: "flex", flexDirection: "column", padding: "22px 0", flexShrink: 0 }}>
        {sidebarContent}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {mainContent}
      </div>
    </div>
  );
}
