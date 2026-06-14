"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Music2, RefreshCw, Star, Link2, AlertCircle } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { MYTRL_WEEKDAYS, type MyTrlChartEntry } from "@/lib/mytrl-chart-engine";
import { buildArtistPath, buildSongPath } from "@/lib/music-routes";
import { formatSongArtist } from "@/lib/song-artist";
import {
  DESKTOP_COVER_SIZE,
  MOBILE_ARTIST_SIZE,
  MOBILE_COVER_SIZE,
  MOBILE_POS_WIDTH,
  MOBILE_ROW_GAP,
  MOBILE_STATS_INDENT,
  MOBILE_TITLE_SIZE,
  desktopCoverGridColumn,
  desktopListGrid,
} from "@/lib/chart-list-layout";
import { DesktopPosCell } from "@/components/chart/DesktopPosCell";
import type { Cover as CoverType } from "@/lib/types";

type SnapshotPayload = {
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
  computedAt: string;
  entries: MyTrlChartEntry[];
};

type HistoryRow = {
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
  computedAt: string;
};

type SpotifyStatus = {
  configured: boolean;
  connected: boolean;
  playlistFound: boolean;
  playlistId: string | null;
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

function StatPill({ label, value, accent, compact }: { label: string; value: number | string; accent?: string; compact?: boolean }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: compact ? 8 : 9, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1.2 }}>{label}</div>
      <div style={{ fontSize: compact ? 12 : 14, fontWeight: 700, color: accent ?? "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

function entryToSong(e: MyTrlChartEntry) {
  return {
    title: e.track,
    artist: e.artist,
    album: e.album,
    spotifyId: e.spotifyId,
    artistSpotifyId: null as string | null,
    artistRefId: null as number | null,
    albumRefId: null as number | null,
  };
}

function entryCover(e: MyTrlChartEntry): CoverType {
  const seed = e.track.length + e.artist.length;
  return {
    palette: ["#FF6B6B", "#FFE66D"],
    seed,
    imageUrl: e.imageUrl,
  };
}

function MyTrlList({ entries }: { entries: MyTrlChartEntry[] }) {
  const isMobile = useIsMobile();
  const coverSize = DESKTOP_COVER_SIZE;
  const gridColumns = desktopListGrid(desktopCoverGridColumn(coverSize), "80px 80px 60px 90px");

  if (entries.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
        Nenhuma música elegível nesta edição. Verifique Last.fm, a playlist <strong>new hits</strong> e gere um snapshot.
      </div>
    );
  }

  if (isMobile) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: 0, borderTop: "1px solid var(--divider)", borderBottom: "1px solid var(--divider)", overflow: "hidden" }}>
        {entries.map((e) => (
          <div key={e.position} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderBottom: "1px solid var(--divider-soft)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: MOBILE_ROW_GAP, minWidth: 0 }}>
              <div style={{ width: MOBILE_POS_WIDTH, textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: e.position <= 3 ? 20 : 16, fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{e.position}</div>
                <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
                  <MovementBadge status={e.status} delta={e.delta} compact />
                </div>
              </div>
              <Cover cover={entryCover(e)} song={entryToSong(e)} size={MOBILE_COVER_SIZE} rounded={6} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: MOBILE_TITLE_SIZE, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.track}</div>
                <div style={{ fontSize: MOBILE_ARTIST_SIZE, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{formatSongArtist(entryToSong(e))}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, paddingLeft: MOBILE_STATS_INDENT }}>
              <StatPill compact label="ANT" value={e.prevPos ?? "—"} />
              <StatPill compact label="PICO" value={e.peak} accent={e.peak === 1 ? "var(--accent)" : undefined} />
              <StatPill compact label="DIAS" value={e.weeks} />
              <StatPill compact label="#1" value={e.numberOnes > 0 ? `${e.numberOnes}x` : "—"} accent={e.numberOnes > 0 ? "var(--accent)" : undefined} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: gridColumns, padding: "0 20px", background: "var(--fill-inset)", borderBottom: "1px solid var(--divider)" }}>
        {["Pos", "", "Música", "Anterior", "Dias", "Pico", "#1s"].map((h, i) => (
          <div key={i} style={{ padding: "10px 8px", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>{h}</div>
        ))}
      </div>
      {entries.map((e) => {
        const song = entryToSong(e);
        return (
          <div key={e.position} style={{ display: "grid", gridTemplateColumns: gridColumns, alignItems: "center", padding: "8px 20px", borderBottom: "1px solid var(--divider-soft)" }}>
            <DesktopPosCell position={e.position}>
              <MovementBadge status={e.status} delta={e.delta} compact />
            </DesktopPosCell>
            <Cover cover={entryCover(e)} song={song} size={coverSize} rounded={8} />
            <div style={{ minWidth: 0, padding: "0 12px" }}>
              <Link href={e.spotifyId ? buildSongPath(song) : "#"} style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}>{e.track}</Link>
              <Link href={buildArtistPath(e.artist, null, null)} style={{ display: "block", fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>{formatSongArtist(song)}</Link>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>{e.prevPos ?? "—"}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>{e.weeks}</div>
            <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", padding: "0 8px", display: "flex", alignItems: "center", gap: 3 }}>
              {e.peak === 1 && <Star size={12} color="var(--accent)" fill="var(--accent)" />}
              {e.peak}
            </div>
            <div style={{ padding: "0 8px", fontSize: 13, fontWeight: e.numberOnes > 0 ? 700 : 400, color: e.numberOnes > 0 ? "var(--text)" : "var(--text-disabled)" }}>
              {e.numberOnes > 0 ? `${e.numberOnes}x` : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MyTrlClient() {
  const searchParams = useSearchParams();
  const [weekday, setWeekday] = useState(1);
  const [weekIndex, setWeekIndex] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotPayload | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [weekdayLabel, setWeekdayLabel] = useState("Segunda");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateDate, setGenerateDate] = useState("");
  const [spotify, setSpotify] = useState<SpotifyStatus | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const loadData = useCallback(async (wd: number, wi: number | null) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ weekday: String(wd) });
      if (wi != null) qs.set("weekIndex", String(wi));
      const res = await fetch(`/api/mytrl?${qs}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setSnapshot(data.snapshot);
      setHistory(data.history ?? []);
      setWeekdayLabel(data.weekdayLabel ?? "");
      if (!wi && data.snapshot?.weekIndex) setWeekIndex(data.snapshot.weekIndex);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSpotify = useCallback(async () => {
    const res = await fetch("/api/spotify/status", { cache: "no-store" });
    if (res.ok) setSpotify(await res.json());
  }, []);

  useEffect(() => {
    void loadSpotify();
  }, [loadSpotify]);

  useEffect(() => {
    const spotifyParam = searchParams.get("spotify");
    if (spotifyParam === "connected") setBanner("Spotify conectado com sucesso!");
    else if (spotifyParam === "connected_no_playlist") setBanner("Spotify conectado, mas a playlist \"new hits\" não foi encontrada.");
    else if (spotifyParam === "error") setBanner("Erro ao conectar Spotify.");
    else if (spotifyParam === "invalid_state") setBanner("Sessão OAuth inválida. Tente novamente.");
    else if (spotifyParam === "token_error") setBanner("Não foi possível obter token do Spotify.");
  }, [searchParams]);

  useEffect(() => {
    void loadData(weekday, weekIndex);
  }, [weekday, weekIndex, loadData]);

  const handleWeekdayChange = (wd: number) => {
    setWeekday(wd);
    setWeekIndex(null);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const body = generateDate.trim() ? { date: generateDate.trim() } : undefined;
      const res = await fetch("/api/mytrl/generate", {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (data.ok) {
        setBanner(
          `Parada gerada (${data.referenceDate}): ${data.count} faixas · ${data.dateRange}.`,
        );
        if (data.weekday) setWeekday(data.weekday);
        setWeekIndex(data.weekIndex ?? null);
        await loadData(data.weekday ?? weekday, data.weekIndex ?? null);
      } else {
        setBanner(data.error ?? "Erro ao gerar parada.");
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Shell title="MyTRL" subtitle="Top 10 new hits · Last.fm 7 dias · seg–sex 18h">
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {banner && (
          <div style={{ padding: "12px 16px", borderRadius: 12, background: "var(--accent-tint)", color: "var(--text)", fontSize: 14 }}>
            {banner}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {MYTRL_WEEKDAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => handleWeekdayChange(d.value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid var(--divider)",
                  background: weekday === d.value ? "var(--accent)" : "var(--surface)",
                  color: weekday === d.value ? "#fff" : "var(--text)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!spotify?.connected ? (
              <a
                href="/api/spotify/auth"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: "#1DB954",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                <Link2 size={16} />
                Conectar Spotify
              </a>
            ) : !spotify.playlistFound ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
                <AlertCircle size={16} />
                Crie a playlist &quot;new hits&quot; no Spotify
              </span>
            ) : null}
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>Data:</span>
              <input
                type="date"
                value={generateDate}
                onChange={(e) => setGenerateDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--divider)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  fontSize: 13,
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid var(--divider)",
                background: "var(--surface)",
                color: "var(--text)",
                fontWeight: 600,
                fontSize: 13,
                cursor: generating ? "wait" : "pointer",
                opacity: generating ? 0.7 : 1,
              }}
            >
              <RefreshCw size={16} />
              {generateDate ? "Gerar para data" : "Gerar agora"}
            </button>
          </div>
        </div>

        {snapshot ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "baseline" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Music2 size={20} color="var(--accent)" />
              <span style={{ fontSize: 18, fontWeight: 700 }}>{weekdayLabel}</span>
            </div>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{snapshot.weekLabel}</span>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>· {snapshot.dateRange}</span>
            <span style={{ fontSize: 12, color: "var(--text-disabled)" }}>
              Atualizado {new Date(snapshot.computedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </span>
          </div>
        ) : !loading ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Nenhuma edição de {weekdayLabel.toLowerCase()} ainda. Conecte o Spotify e gere a primeira parada.</p>
        ) : null}

        {history.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Edições:</span>
            {history.map((h) => (
              <button
                key={h.weekIndex}
                type="button"
                onClick={() => setWeekIndex(h.weekIndex)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--divider)",
                  background: snapshot?.weekIndex === h.weekIndex ? "var(--accent-tint)" : "transparent",
                  fontSize: 12,
                  cursor: "pointer",
                  color: "var(--text)",
                }}
              >
                {h.dateRange}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Carregando…</div>
        ) : (
          <MyTrlList entries={snapshot?.entries ?? []} />
        )}

        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Pesos Last.fm (7 dias): ontem ×20, −2 ×18, −3 ×15, −4 ×13, −5 ×12, −6 ×11, −7 ×10.
          Só entram faixas da playlist <strong>new hits</strong>. Cron automático: seg–sex às 18h (BRT).
          Para testar um dia passado, escolha a data e clique em <strong>Gerar para data</strong> — ou via API:{" "}
          <code style={{ fontSize: 11 }}>POST /api/mytrl/generate</code> com{" "}
          <code style={{ fontSize: 11 }}>{`{"date":"YYYY-MM-DD"}`}</code>.
        </p>
      </div>
    </Shell>
  );
}
