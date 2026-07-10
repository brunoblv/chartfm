"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSpotifySearch } from "@/hooks/useSpotifySearch";
import type { Song } from "@/lib/types";
import type { RoundData, SpotifyTrack, SongData } from "./push-types";
import { formatReleaseDate } from "./push-helpers";
import { TrackCover, CheckIcon } from "./PushAtoms";

function songToTrack(song: Song): SpotifyTrack | null {
  if (!song.spotifyId) return null;
  return {
    spotifyId: song.spotifyId,
    title: song.title,
    artist: song.artist,
    album: song.album ?? "",
    imageUrl: song.imageUrl ?? null,
    previewUrl: null,
    externalUrl: "",
  };
}

export function SubmissionView({
  round,
  onSubmitted,
}: {
  round: RoundData;
  onSubmitted: (sub: RoundData["mySubmission"]) => void;
}) {
  const { data: session } = useSession();
  const authed = !!session?.user?.id;

  const [query, setQuery]           = useState("");
  const [selected, setSelected]     = useState<SpotifyTrack | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [editing, setEditing]       = useState(!round.mySubmission);

  const {
    tracks: spotifyTracks,
    loading: spotifyLoading,
    configured: spotifyConfigured,
    unavailable: spotifyUnavailable,
  } = useSpotifySearch(query);

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

      {mySong && !editing && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase" as const, marginBottom: 8 }}>
            Sua indicação
          </div>
          <div style={{
            background: "var(--surface)",
            border: "1.5px solid color-mix(in srgb, var(--accent) 28%, transparent)",
            borderRadius: 14, padding: 13, display: "flex", alignItems: "center", gap: 11,
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
            <button type="button"
              onClick={() => { setEditing(true); setQuery(""); setSelected(null); }}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11, fontFamily: "inherit", padding: "4px 8px", flexShrink: 0 }}>
              Trocar
            </button>
          </div>
        </div>
      )}

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
            <input type="text" value={query}
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
          {query.trim().length < 1 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Digite para pesquisar no Spotify.</div>
          ) : (
            <>
              {spotifyLoading && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Buscando…</div>}
              {!spotifyLoading && !spotifyConfigured && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Spotify indisponível no momento.
                </div>
              )}
              {!spotifyLoading && spotifyConfigured && spotifyUnavailable && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Spotify indisponível no momento. Tente novamente.</div>
              )}
              {!spotifyLoading && spotifyConfigured && !spotifyUnavailable && spotifyTracks.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhum resultado no Spotify.</div>
              )}
              {!spotifyLoading && !selected && spotifyTracks.length > 0 && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 13, overflow: "hidden" }}>
                  {spotifyTracks.map((song, i) => {
                    const track = songToTrack(song);
                    if (!track) return null;
                    return (
                      <button key={track.spotifyId} type="button"
                        onClick={() => { setSelected(track); setQuery(`${track.title} - ${track.artist}`); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 11, padding: "11px 14px",
                          borderTop: "none", borderLeft: "none", borderRight: "none",
                          borderBottom: i < spotifyTracks.length - 1 ? "1px solid var(--divider)" : "none",
                          cursor: "pointer", background: "none", width: "100%", textAlign: "left" as const,
                        }}>
                        <TrackCover imageUrl={track.imageUrl} size={42} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.artist}</div>
                        </div>
                        <span style={{ padding: "2px 7px", borderRadius: 100, background: "rgba(29,185,84,.12)", color: "#1DB954", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                          Spotify
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
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
          <button type="button" disabled={!selected || submitting} onClick={handleSubmit}
            style={{
              padding: "14px", borderRadius: 14, border: "none",
              background: selected && !submitting ? "var(--accent)" : "var(--fill-subtle)",
              color: selected && !submitting ? "white" : "var(--text-muted)",
              fontSize: 15, fontWeight: 700,
              cursor: selected && !submitting ? "pointer" : "not-allowed",
              fontFamily: "inherit", transition: "background 160ms",
            }}>
            {submitting ? "Inscrevendo…" : "Confirmar indicação"}
          </button>
        </div>
      )}

      {round.participants.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" as const, color: "var(--text-muted)" }}>Participantes</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{round.participants.length}/{round.submissionCount} indicaram</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {round.participants.map((p) => (
              <div key={p.userId} style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "4px 9px 4px 5px", borderRadius: 100,
                background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
              }}>
                <div style={{ width: 15, height: 15, borderRadius: 7.5, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CheckIcon size={7} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>
                  {p.isMe ? "Você" : (p.name?.split(" ")[0] ?? p.handle ?? "?")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
