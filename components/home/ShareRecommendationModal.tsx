"use client";

import { useEffect, useRef, useState } from "react";
import { Music2, Search, Youtube } from "lucide-react";
import type { RecommendationItem } from "@/lib/recommendations-feed";
import { useTranslations } from "@/hooks/useTranslations";
import type { SpotifyTrack } from "@/components/push/push-types";
import { extractYouTubeId, youtubeThumbnailUrl } from "@/lib/youtube-id";

type Mode = "song" | "youtube";

type SearchHit =
  | { source: "db"; songId: string; spotifyId: string | null; title: string; artist: string; album: string | null; imageUrl: string | null }
  | { source: "spotify"; spotifyId: string; title: string; artist: string; album: string; imageUrl: string | null };

export function ShareRecommendationModal({
  onClose,
  onShared,
}: {
  onClose: () => void;
  onShared: (item: RecommendationItem) => void;
}) {
  const { t } = useTranslations();
  const [mode, setMode] = useState<Mode>("song");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [text, setText] = useState("");
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const youtubeId = extractYouTubeId(youtubeUrl);
  const canShare = mode === "song" ? !!selected : !!youtubeId;

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (mode !== "song") return;
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [dbRes, spotifyRes] = await Promise.all([
          fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ac.signal }),
          fetch(`/api/spotify/search?q=${encodeURIComponent(query)}&limit=8`, { signal: ac.signal }),
        ]);
        if (ac.signal.aborted) return;

        const dbData = dbRes.ok
          ? ((await dbRes.json()) as {
              songs: {
                id: string;
                title: string;
                artist: string;
                album: string | null;
                spotifyId: string | null;
                coverUrl: string | null;
              }[];
            })
          : { songs: [] };
        const spotifyData = spotifyRes.ok
          ? ((await spotifyRes.json()) as { tracks?: SpotifyTrack[] })
          : { tracks: [] };

        const seen = new Set<string>();
        const merged: SearchHit[] = [];

        for (const s of dbData.songs) {
          const key = s.spotifyId ?? `db:${s.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push({
            source: "db",
            songId: s.id,
            spotifyId: s.spotifyId,
            title: s.title,
            artist: s.artist,
            album: s.album,
            imageUrl: s.coverUrl,
          });
        }

        for (const track of spotifyData.tracks ?? []) {
          if (seen.has(track.spotifyId)) continue;
          seen.add(track.spotifyId);
          merged.push({
            source: "spotify",
            spotifyId: track.spotifyId,
            title: track.title,
            artist: track.artist,
            album: track.album,
            imageUrl: track.imageUrl,
          });
        }

        setResults(merged.slice(0, 12));
      } catch {
        if (!ac.signal.aborted) setResults([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [q, mode]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    if (next === "song") {
      setYoutubeUrl("");
    } else {
      setQ("");
      setResults([]);
      setSelected(null);
    }
  }

  async function handleShare() {
    if (!canShare || sharing) return;
    setSharing(true);
    setError(null);
    try {
      const body =
        mode === "youtube"
          ? { youtubeUrl: youtubeUrl.trim(), text: text.trim() || undefined }
          : selected!.source === "db"
            ? { songId: selected!.songId, text: text.trim() || undefined }
            : {
                spotifyId: selected!.spotifyId,
                title: selected!.title,
                artist: selected!.artist,
                album: selected!.album,
                text: text.trim() || undefined,
              };
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        setError(t("recommendations.loginRequired"));
        return;
      }
      if (!res.ok) {
        setError(t("recommendations.shareError"));
        return;
      }
      const item = (await res.json()) as RecommendationItem;
      onShared(item);
      onClose();
    } catch {
      setError(t("recommendations.shareError"));
    } finally {
      setSharing(false);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "9px 12px",
    borderRadius: 10,
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    background: active ? "var(--surface)" : "transparent",
    color: active ? "var(--text)" : "var(--text-muted)",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
        }}
      >
        <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <Music2 size={18} color="var(--accent)" />
          <span style={{ fontSize: 15, fontWeight: 700 }}>{t("recommendations.shareTitle")}</span>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 22,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "14px 20px 0" }}>
          <div
            style={{
              display: "flex",
              gap: 3,
              background: "var(--fill-subtle)",
              borderRadius: 12,
              padding: 3,
            }}
          >
            <button type="button" onClick={() => switchMode("song")} style={tabStyle(mode === "song")}>
              <Music2 size={14} />
              {t("recommendations.modeSong")}
            </button>
            <button type="button" onClick={() => switchMode("youtube")} style={tabStyle(mode === "youtube")}>
              <Youtube size={14} />
              {t("recommendations.modeYoutube")}
            </button>
          </div>
        </div>

        {mode === "song" ? (
          <div style={{ padding: "14px 20px" }}>
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                color="var(--text-muted)"
                style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                ref={inputRef}
                type="text"
                placeholder={t("recommendations.searchPlaceholder")}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSelected(null);
                }}
                style={{
                  width: "100%",
                  padding: "10px 16px 10px 40px",
                  borderRadius: 12,
                  border: "1px solid var(--divider-strong)",
                  fontSize: 14,
                  fontFamily: "inherit",
                  outline: "none",
                  background: "var(--fill-inset)",
                  color: "var(--text)",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ padding: "14px 20px" }}>
            <input
              ref={inputRef}
              type="url"
              placeholder={t("recommendations.youtubePlaceholder")}
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 12,
                border: "1px solid var(--divider-strong)",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
                background: "var(--fill-inset)",
                color: "var(--text)",
                boxSizing: "border-box",
              }}
            />
            {youtubeUrl.trim() && !youtubeId && (
              <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 8 }}>
                {t("recommendations.youtubeInvalid")}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px", minHeight: 120 }}>
          {mode === "song" ? (
            <>
              {loading && (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  {t("recommendations.searching")}
                </div>
              )}
              {!loading && q.trim().length >= 2 && results.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  {t("recommendations.noResults")}
                </div>
              )}
              {results.map((hit) => {
                const key = hit.source === "db" ? hit.songId : hit.spotifyId;
                const active =
                  selected &&
                  ((selected.source === "db" && hit.source === "db" && selected.songId === hit.songId) ||
                    (selected.source === "spotify" &&
                      hit.source === "spotify" &&
                      selected.spotifyId === hit.spotifyId));
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(hit)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 8px",
                      border: "none",
                      borderRadius: 12,
                      background: active ? "var(--accent-tint)" : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {hit.imageUrl ? (
                      <img
                        src={hit.imageUrl}
                        alt=""
                        width={44}
                        height={44}
                        style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 8,
                          background: "var(--fill-subtle)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--text)",
                        }}
                      >
                        {hit.title}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {hit.artist}
                      </div>
                    </div>
                    {hit.source === "db" && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          background: "var(--fill-subtle)",
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                      >
                        BD
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          ) : (
            youtubeId && (
              <div style={{ padding: "8px 8px 12px" }}>
                <div
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid var(--divider)",
                    background: "var(--bg)",
                  }}
                >
                  <img
                    src={youtubeThumbnailUrl(youtubeId)}
                    alt=""
                    style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
                  />
                  <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-muted)" }}>
                    {t("recommendations.youtubePreview")}
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        <div style={{ padding: "12px 20px 0", borderTop: "1px solid var(--divider-soft)" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("recommendations.textPlaceholder")}
            rows={3}
            maxLength={1000}
            style={{
              width: "100%",
              border: "1px solid var(--divider)",
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 14,
              fontFamily: "inherit",
              resize: "none",
              outline: "none",
              background: "var(--fill-inset)",
              color: "var(--text)",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          {error && <div style={{ fontSize: 13, color: "var(--accent)" }}>{error}</div>}
          <button
            onClick={handleShare}
            disabled={!canShare || sharing}
            style={{
              width: "100%",
              padding: "12px 20px",
              borderRadius: 100,
              border: "none",
              background: "var(--accent)",
              color: "white",
              fontSize: 14,
              fontWeight: 700,
              cursor: !canShare || sharing ? "default" : "pointer",
              opacity: !canShare || sharing ? 0.5 : 1,
            }}
          >
            {sharing ? t("recommendations.sharing") : t("recommendations.shareButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
