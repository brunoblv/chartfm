"use client";

import { useState, useRef } from "react";
import { ExternalLink, Music } from "lucide-react";
import { useSession } from "next-auth/react";
import { pushRoundTitle } from "@/lib/push-format";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMobileReorder } from "@/hooks/useMobileReorder";
import {
  MobileReorderPositionSheet,
  MobileReorderToolbar,
} from "@/components/mobile-reorder";
import { MobileReorderRowControls } from "@/components/mobile-reorder/MobileReorderRowControls";
import type { MobileReorderRowState } from "@/components/mobile-reorder/MobileReorderListRow";
import type { MobileReorderMode } from "@/lib/mobile-reorder";
import type { RoundData, SubmissionData } from "./push-types";
import { SPOTIFY_PATH, pushPoints, formatDate } from "./push-helpers";
import { TrackCover, RankBadge, CheckIcon } from "./PushAtoms";

const YT_PATH = "M23.495 2.205a3.02 3.02 0 0 0-2.122-2.138C19.505 0 12 0 12 0S4.495 0 2.627.07a3.02 3.02 0 0 0-2.122 2.138C0 4.07 0 8.123 0 8.123s0 4.052.505 5.917a3.02 3.02 0 0 0 2.122 2.138C4.495 16.246 12 16.246 12 16.246s7.505 0 9.373-.07a3.02 3.02 0 0 0 2.122-2.138C24 12.175 24 8.123 24 8.123s0-4.052-.505-5.918zM9.546 11.56V4.686l6.273 3.437-6.273 3.437z";

function ListeningView({ round }: { round: RoundData }) {
  const submissions = round.submissions ?? [];
  const [platform, setPlatform] = useState<"spotify" | "youtube">("spotify");

  const spotifyUrl = round.spotifyPlaylistId ? `https://open.spotify.com/playlist/${round.spotifyPlaylistId}` : null;
  const youtubeUrl = round.youtubePlaylistId ? `https://www.youtube.com/playlist?list=${round.youtubePlaylistId}` : null;

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
      <div style={{ background: "var(--fill-subtle)", borderRadius: 13, padding: 3, display: "flex", gap: 3 }}>
        <button type="button" onClick={() => setPlatform("spotify")} style={tabStyle(platform === "spotify") as React.CSSProperties}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill={platform === "spotify" ? "#1DB954" : "var(--text-muted)"}><path d={SPOTIFY_PATH} /></svg>
          Spotify
        </button>
        <button type="button" onClick={() => setPlatform("youtube")} style={tabStyle(platform === "youtube") as React.CSSProperties}>
          <svg width={16} height={12} viewBox="0 0 24 18" fill={platform === "youtube" ? "#FF0000" : "var(--text-muted)"}><path d={YT_PATH} /></svg>
          YouTube
        </button>
      </div>

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

      {platform === "youtube" && youtubeUrl && (
        <div style={{ background: "#0F0F0F", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: "#FF0000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width={20} height={16} viewBox="0 0 24 18" fill="white"><path d={YT_PATH} /></svg>
            </div>
            <div>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{pushRoundTitle(round.season, round.number)}</div>
              <div style={{ color: "#AAAAAA", fontSize: 11, marginTop: 2 }}>@chartFM · {submissions.length} vídeos</div>
            </div>
          </div>
          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 11, borderRadius: 100, background: "#FF0000", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            <svg width={15} height={12} viewBox="0 0 24 18" fill="white"><path d={YT_PATH} /></svg>
            Abrir no YouTube
          </a>
        </div>
      )}
      {platform === "youtube" && !youtubeUrl && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 16, padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          Playlist ainda não disponível no @chartFM.
        </div>
      )}

      {submissions.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase" as const, marginBottom: 12 }}>
            Playlist da semana
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {submissions.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < submissions.length - 1 ? "1px solid var(--divider)" : "none" }}>
                <div style={{ width: 20, textAlign: "right" as const, fontSize: 12, fontWeight: 700, color: "var(--text-disabled)", flexShrink: 0 }}>{i + 1}</div>
                <TrackCover imageUrl={s.song.coverUrl} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.song.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.song.artist}</div>
                </div>
                {s.userHandle && <div style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>@{s.userHandle}</div>}
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
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Ouça as músicas inscritas e avalie-as abaixo.</div>
      )}
    </div>
  );
}

function PushRankingMobileRow({
  sub,
  idx,
  total,
  mode,
  rowProps,
}: {
  sub: SubmissionData;
  idx: number;
  total: number;
  mode: MobileReorderMode;
  rowProps: MobileReorderRowState;
}) {
  const pts = pushPoints(idx + 1, total);
  const { rowStyle, onRowClick, isSelected, isSwapTarget, canMoveUp, canMoveDown, onMoveUp, onMoveDown } = rowProps;

  return (
    <div
      onClick={onRowClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderBottom: "1px solid var(--divider)",
        background: "var(--surface)",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        ...rowStyle,
      }}
    >
      <RankBadge pos={idx + 1} />
      <TrackCover imageUrl={sub.song.coverUrl} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sub.song.title}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sub.song.artist}
        </div>
      </div>
      <div style={{ textAlign: "center", flexShrink: 0, minWidth: 34 }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: "var(--text)", lineHeight: 1, letterSpacing: "-.02em" }}>{pts}</div>
        <div style={{ fontSize: 8, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".05em", marginTop: 1 }}>PTS</div>
      </div>
      <MobileReorderRowControls
        mode={mode}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        isSelected={isSelected}
        isSwapTarget={isSwapTarget}
      />
    </div>
  );
}

function RankingView({ round, onSaved }: { round: RoundData; onSaved: () => void }) {
  const { data: session } = useSession();
  const authed = !!session?.user?.id;
  const isMobile = useIsMobile();

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
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const dragItem              = useRef<number | null>(null);

  const mobileReorder = useMobileReorder({
    items: ranking,
    onChange: (next) => {
      setRanking(next);
      setSaved(false);
    },
    getItemLabel: (item) => item.song.title,
  });

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
    setSaved(false);
  }
  function handleDragEnd() { dragItem.current = null; }

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
  if (toRank.length === 0) return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Não há músicas para avaliar.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {mySubmission && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase" as const, marginBottom: 8 }}>Sua música</div>
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
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round">
          <circle cx={12} cy={12} r={10} /><line x1={12} y1={8} x2={12} y2={12} /><line x1={12} y1={16} x2={12.01} y2={16} />
        </svg>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {!isMobile && "Arraste para ordenar · "}#1 = 20 pts · #{total} = 1 pt
          {hasVoted && <span style={{ color: "#10b981", fontWeight: 600 }}> · ✓ Avaliação salva</span>}
        </span>
      </div>

      {isMobile && ranking.length > 0 ? (
        <div style={{ position: "relative", marginBottom: 16, borderRadius: 13, border: "1px solid var(--divider)", overflow: "hidden" }}>
          <MobileReorderToolbar
            mode={mobileReorder.mode}
            onModeChange={mobileReorder.setMode}
            hint={mobileReorder.hint}
            showSwapBanner={mobileReorder.showSwapBanner}
            swapBannerTitle={mobileReorder.selectedTitle ?? undefined}
            onCancelSwap={mobileReorder.cancelSelection}
          />
          {ranking.map((sub, idx) => (
            <PushRankingMobileRow
              key={sub.id}
              sub={sub}
              idx={idx}
              total={total}
              mode={mobileReorder.mode}
              rowProps={mobileReorder.getRowProps(idx)}
            />
          ))}
          {mobileReorder.showPositionSheet && mobileReorder.editTargetTitle ? (
            <MobileReorderPositionSheet
              title={mobileReorder.editTargetTitle}
              currentPosition={(mobileReorder.editTargetIndex ?? 0) + 1}
              maxPosition={mobileReorder.itemCount}
              onConfirm={mobileReorder.confirmPosition}
              onClose={mobileReorder.closePositionSheet}
            />
          ) : null}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {ranking.map((sub, idx) => {
            const pts = pushPoints(idx + 1, total);
            return (
              <div key={sub.id} draggable
                onDragStart={() => handleDragStart(idx)}
                onDragEnter={() => handleDragEnter(idx)}
                onDragEnd={handleDragEnd}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  borderRadius: 13, background: "var(--surface)", border: "1.5px solid var(--divider)",
                  cursor: "grab", userSelect: "none", boxShadow: "0 1px 2px rgba(0,0,0,.04)",
                }}>
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
      )}

      {error && (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button type="button" onClick={saved ? undefined : handleSave} disabled={saving}
        style={{
          padding: "14px", borderRadius: 14, border: "none",
          background: saved ? "#10b981" : "var(--accent)",
          color: "white", fontSize: 15, fontWeight: 700,
          cursor: saving || saved ? "default" : "pointer",
          fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "background 200ms", marginBottom: 8,
        }}>
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

export function ListenAndRankView({ round, onSaved }: { round: RoundData; onSaved: () => void }) {
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
