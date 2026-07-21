"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Cover } from "@/components/ui/Cover";
import { useSpotifySearch } from "@/hooks/useSpotifySearch";
import { useTranslations } from "@/hooks/useTranslations";
import { COVER_PALETTES } from "@/lib/data";
import type { Cover as CoverModel, Song } from "@/lib/types";
import type { SpotlightCategory } from "@/lib/weekly-spotlight-poll";

type DbSong = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  spotifyId: string | null;
  coverUrl: string | null;
};

function coverForSong(song: Song): CoverModel {
  const key = song.artist + song.title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const palette = COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
  const base: CoverModel = { palette, seed: Math.abs(hash) };
  return song.imageUrl ? { ...base, imageUrl: song.imageUrl } : base;
}

type Props = {
  label: string;
  accentColor: string;
  category: SpotlightCategory;
  song: Song | null;
  onSelect: (song: Song) => void;
  onClear: () => void;
};

export function SpotlightSearchCard({ label, accentColor, category, song, onSelect, onClear }: Props) {
  const { t } = useTranslations();
  const [dbQuery, setDbQuery] = useState("");
  const [dbSongs, setDbSongs] = useState<Song[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [spotifyQuery, setSpotifyQuery] = useState("");
  const { tracks: spotifyTracks, loading: spotifyLoading } = useSpotifySearch(spotifyQuery);
  const [wonBefore, setWonBefore] = useState(false);

  useEffect(() => {
    if (!song) {
      setWonBefore(false);
      return;
    }
    const ac = new AbortController();
    const params = new URLSearchParams({ category });
    if (song.id) params.set("songId", song.id);
    if (song.spotifyId) params.set("spotifyId", song.spotifyId);
    fetch(`/api/weekly-poll/prior-winner?${params.toString()}`, { signal: ac.signal, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { wonBefore: false }))
      .then((data: { wonBefore?: boolean }) => {
        if (!ac.signal.aborted) setWonBefore(Boolean(data.wonBefore));
      })
      .catch(() => {
        if (!ac.signal.aborted) setWonBefore(false);
      });
    return () => ac.abort();
  }, [song, category]);

  useEffect(() => {
    const q = dbQuery.trim();
    if (q.length < 2) {
      setDbSongs([]);
      setDbLoading(false);
      return;
    }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      setDbLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ac.signal, cache: "no-store" });
        if (ac.signal.aborted) return;
        if (!res.ok) {
          setDbSongs([]);
        } else {
          const data = (await res.json()) as { songs?: DbSong[] };
          if (ac.signal.aborted) return;
          setDbSongs(
            (data.songs ?? []).map((s) => ({
              id: s.id,
              title: s.title,
              artist: s.artist,
              album: s.album ?? "",
              spotifyId: s.spotifyId ?? undefined,
              imageUrl: s.coverUrl ?? undefined,
            }))
          );
        }
      } catch {
        if (!ac.signal.aborted) setDbSongs([]);
      } finally {
        if (!ac.signal.aborted) setDbLoading(false);
      }
    }, 220);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [dbQuery]);

  const handleSelect = (picked: Song) => {
    onSelect(picked);
    setDbQuery("");
    setSpotifyQuery("");
    setDbSongs([]);
  };

  const renderRow = (s: Song, key: string) => (
    <div
      key={key}
      onClick={() => handleSelect(s)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderRadius: 8, cursor: "pointer" }}
    >
      <Cover cover={coverForSong(s)} song={s} size={36} rounded={6} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {s.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {s.artist}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--divider)", background: "var(--fill-subtle)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>{label}</div>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("create.spotlightOptional")}</span>
      </div>

      {song ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Cover cover={coverForSong(song)} song={song} size={44} rounded={8} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {song.title}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {song.artist}
              </div>
            </div>
            <button
              type="button"
              onClick={onClear}
              aria-label={t("create.spotlightRemoveAria", { label: label.toLowerCase() })}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "none",
                background: "var(--surface)",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>
          {wonBefore && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
              {t("create.spotlightWonBeforePrefix")}{label.toLowerCase()}{t("create.spotlightWonBeforeSuffix")}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-muted)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              {t("create.spotlightCatalogLabel")}
            </div>
            <input
              value={dbQuery}
              onChange={(e) => setDbQuery(e.target.value)}
              placeholder={t("create.searchLocal")}
              style={{
                width: "100%",
                border: "1px solid var(--divider-strong)",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 13,
                outline: "none",
                color: "var(--text)",
                background: "var(--surface)",
                boxSizing: "border-box",
              }}
            />
            {dbQuery.trim().length >= 2 && (
              <div style={{ marginTop: 6 }}>
                {dbLoading && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("create.spotlightSearching")}</div>}
                {!dbLoading && dbSongs.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("create.noCatalogSongs")}</div>
                )}
                {!dbLoading && dbSongs.map((s) => renderRow(s, `db-${s.id ?? s.title}-${s.artist}`))}
              </div>
            )}
          </div>

          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-muted)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              {t("create.searchSpotify")}
            </div>
            <input
              value={spotifyQuery}
              onChange={(e) => setSpotifyQuery(e.target.value)}
              placeholder={t("chart.edit.spotifySearchPlaceholder")}
              style={{
                width: "100%",
                border: "1px solid var(--divider-strong)",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 13,
                outline: "none",
                color: "var(--text)",
                background: "var(--surface)",
                boxSizing: "border-box",
              }}
            />
            {spotifyQuery.trim().length >= 1 && (
              <div style={{ marginTop: 6 }}>
                {spotifyLoading && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("create.spotlightSearching")}</div>}
                {!spotifyLoading && spotifyTracks.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("chart.edit.noSpotifyResults")}</div>
                )}
                {!spotifyLoading && spotifyTracks.map((s, i) => renderRow(s, `sp-${s.spotifyId ?? i}`))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
