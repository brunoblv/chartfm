"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useTranslations } from "@/hooks/useTranslations";
import type { RecommendationItem } from "@/lib/recommendations-feed";
import { MOMENT_TYPES, type MomentType } from "@/lib/moments-feed";
import { MOMENT_TYPE_META } from "./moment-types";
import type { SpotifyTrack } from "@/components/push/push-types";

const MAX_TEXT = 280;

type SearchHit =
  | { source: "db"; songId: string; spotifyId: string | null; title: string; artist: string; album: string | null; imageUrl: string | null }
  | { source: "spotify"; spotifyId: string; title: string; artist: string; album: string; imageUrl: string | null };

export function MomentComposer({ onCreated }: { onCreated: (item: RecommendationItem) => void }) {
  const { data: session } = useSession();
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MomentType>("loop");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [text, setText] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const query = q.trim();
    if (!open || selected || query.length < 2) {
      setResults([]);
      return;
    }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
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
        setResults(merged.slice(0, 8));
      } catch {
        if (!ac.signal.aborted) setResults([]);
      } finally {
        if (!ac.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [q, open, selected]);

  function reset() {
    setOpen(false);
    setQ("");
    setResults([]);
    setSelected(null);
    setText("");
    setRating(null);
    setError(null);
  }

  const canPublish = !!selected && (type !== "review" || rating !== null) && !publishing;

  async function publish() {
    if (!canPublish || !selected) return;
    setPublishing(true);
    setError(null);
    try {
      const body =
        selected.source === "db"
          ? { type, songId: selected.songId, text: text.trim() || undefined, rating: rating ?? undefined }
          : {
              type,
              spotifyId: selected.spotifyId,
              title: selected.title,
              artist: selected.artist,
              album: selected.album,
              text: text.trim() || undefined,
              rating: rating ?? undefined,
            };
      const res = await fetch("/api/moments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        setError(t("recommendations.loginRequired"));
        return;
      }
      if (res.status === 429) {
        setError(t("moments.dailyLimit"));
        return;
      }
      if (!res.ok) {
        setError(t("recommendations.shareError"));
        return;
      }
      const item = (await res.json()) as RecommendationItem;
      onCreated(item);
      reset();
    } catch {
      setError(t("recommendations.shareError"));
    } finally {
      setPublishing(false);
    }
  }

  const chipStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 13px",
    borderRadius: 100,
    border: `1px solid ${active ? "var(--accent)" : "var(--divider)"}`,
    background: active ? "var(--accent-tint)" : "var(--fill-subtle)",
    color: active ? "var(--accent)" : "var(--text-subtle)",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  });

  if (!session?.user) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--divider)",
          borderRadius: 18,
          padding: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 14, color: "var(--text-subtle)" }}>{t("moments.loggedOutCta")}</span>
        <Link
          href="/login"
          style={{
            flexShrink: 0,
            padding: "9px 18px",
            borderRadius: 100,
            background: "var(--accent)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {t("nav.signIn")}
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--divider)",
        borderRadius: 18,
        padding: 16,
      }}
    >
      {!open ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar
              user={{ name: session.user.name ?? "?", avatar: "#FA243C" }}
              imageUrl={session.user.image ?? undefined}
              size={38}
            />
            <button
              type="button"
              onClick={() => setOpen(true)}
              style={{
                flex: 1,
                textAlign: "left",
                padding: "10px 16px",
                borderRadius: 100,
                border: "none",
                background: "var(--fill-subtle)",
                color: "var(--text-muted)",
                fontSize: 14,
                cursor: "text",
                fontFamily: "inherit",
              }}
            >
              {t("moments.composerPlaceholder")}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, paddingLeft: 48, flexWrap: "wrap" }}>
            {MOMENT_TYPES.map((k) => {
              const { Icon, labelKey } = MOMENT_TYPE_META[k];
              return (
                <button
                  key={k}
                  type="button"
                  title={t(labelKey)}
                  onClick={() => {
                    setType(k);
                    setOpen(true);
                  }}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: "1px solid var(--divider)",
                    background: "var(--surface)",
                    color: "var(--text-subtle)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={15} />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14.5, fontWeight: 800 }}>{t("moments.composerTitle")}</span>
            <button
              type="button"
              onClick={reset}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {MOMENT_TYPES.map((k) => {
              const { Icon, labelKey } = MOMENT_TYPE_META[k];
              return (
                <button key={k} type="button" onClick={() => setType(k)} style={chipStyle(type === k)}>
                  <Icon size={13} />
                  {t(labelKey)}
                </button>
              );
            })}
          </div>

          {(type === "descobri" || type === "throwback") && (
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>
              {t(type === "descobri" ? "moments.descobriHint" : "moments.throwbackHint")}
            </div>
          )}

          {!selected ? (
            <>
              <div style={{ position: "relative" }}>
                <Search
                  size={15}
                  color="var(--text-muted)"
                  style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={t("moments.searchPlaceholder")}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 16px 10px 38px",
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
              {searching && (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("recommendations.searching")}</div>
              )}
              {!searching && q.trim().length >= 2 && results.length === 0 && (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("recommendations.noResults")}</div>
              )}
              {results.length > 0 && (
                <div
                  style={{
                    border: "1px solid var(--divider)",
                    borderRadius: 12,
                    overflow: "hidden",
                    maxHeight: 260,
                    overflowY: "auto",
                  }}
                >
                  {results.map((hit) => {
                    const key = hit.source === "db" ? hit.songId : hit.spotifyId;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelected(hit)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 12px",
                          border: "none",
                          borderBottom: "1px solid var(--divider-soft)",
                          background: "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "inherit",
                        }}
                      >
                        {hit.imageUrl ? (
                          <img
                            src={hit.imageUrl}
                            alt=""
                            width={36}
                            height={36}
                            style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              background: "var(--fill-subtle)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13.5,
                              fontWeight: 600,
                              color: "var(--text)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
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
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                padding: 10,
                border: "1px solid var(--accent)",
                borderRadius: 12,
                background: "var(--accent-tint)",
              }}
            >
              {selected.imageUrl ? (
                <img
                  src={selected.imageUrl}
                  alt=""
                  width={48}
                  height={48}
                  style={{ borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{ width: 48, height: 48, borderRadius: 10, background: "var(--fill-subtle)", flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {selected.title}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-subtle)" }}>{selected.artist}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setQ("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 4,
                  flexShrink: 0,
                }}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {type === "review" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-subtle)", marginRight: 4 }}>
                {t("moments.ratingLabel")}
              </span>
              {Array.from({ length: 11 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: `1px solid ${rating === n ? "var(--accent)" : "var(--divider)"}`,
                    background: rating === n ? "var(--accent)" : "var(--surface)",
                    color: rating === n ? "#fff" : "var(--text-subtle)",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
            maxLength={MAX_TEXT}
            placeholder={t("moments.textPlaceholder")}
            rows={2}
            style={{
              width: "100%",
              minHeight: 56,
              resize: "none",
              border: "1px solid var(--divider)",
              borderRadius: 12,
              padding: 12,
              background: "var(--fill-inset)",
              color: "var(--text)",
              fontFamily: "inherit",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          {error && <div style={{ fontSize: 13, color: "var(--accent)" }}>{error}</div>}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t("moments.charsLeft", { count: MAX_TEXT - text.length })}
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  padding: "9px 18px",
                  borderRadius: 100,
                  border: "1px solid var(--divider)",
                  background: "transparent",
                  color: "var(--text)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t("moments.cancel")}
              </button>
              <button
                type="button"
                onClick={publish}
                disabled={!canPublish}
                style={{
                  padding: "9px 20px",
                  borderRadius: 100,
                  border: "none",
                  background: "var(--accent)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: canPublish ? "pointer" : "default",
                  opacity: canPublish ? 1 : 0.5,
                  fontFamily: "inherit",
                }}
              >
                {publishing ? t("moments.publishing") : t("moments.publish")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
