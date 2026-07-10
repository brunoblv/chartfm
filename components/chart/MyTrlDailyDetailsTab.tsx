"use client";

import { useEffect, useState } from "react";
import { Cover } from "@/components/ui/Cover";
import { formatSongArtist } from "@/lib/song-artist";
import type { ChartEntry } from "@/lib/types";

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
};
const WEEKDAYS = [1, 2, 3, 4, 5];

type DailyCell = { position: number | null; score: number };
type DailyResponse = {
  weekdays: number[];
  bySongSpotifyId: Record<string, Record<number, DailyCell>>;
};

const gridTemplateColumns = "36px 40px 1fr repeat(5, 56px)";

export function MyTrlDailyDetailsTab({
  chartId,
  entries,
}: {
  chartId: string;
  entries: ChartEntry[];
}) {
  const [data, setData] = useState<DailyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const res = await fetch(`/api/charts/${encodeURIComponent(chartId)}/mytrl-daily`);
        if (cancelled) return;
        if (!res.ok) {
          setError(true);
          setData(null);
          return;
        }
        setData((await res.json()) as DailyResponse);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chartId]);

  if (loading) {
    return (
      <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 14 }}>
        Carregando detalhes…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 14 }}>
        Não foi possível carregar os detalhes desta semana.
      </div>
    );
  }

  const dailyFor = (entry: ChartEntry): Record<number, DailyCell> =>
    (entry.song.spotifyId && data.bySongSpotifyId[entry.song.spotifyId]) || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <DailyTable
        title="Posições"
        entries={entries}
        dailyFor={dailyFor}
        renderCell={(cell) => (cell?.position != null ? `#${cell.position}` : "-")}
      />
      <DailyTable
        title="Pontos"
        entries={entries}
        dailyFor={dailyFor}
        renderCell={(cell) =>
          cell ? cell.score.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "-"
        }
      />
    </div>
  );
}

function DailyTable({
  title,
  entries,
  dailyFor,
  renderCell,
}: {
  title: string;
  entries: ChartEntry[];
  dailyFor: (entry: ChartEntry) => Record<number, DailyCell>;
  renderCell: (cell: DailyCell | undefined) => string;
}) {
  return (
    <div
      style={{
        overflowX: "auto",
        borderRadius: 16,
        border: "1px solid var(--divider)",
      }}
    >
      <div style={{ background: "var(--surface)", minWidth: 560 }}>
        <div
          style={{
            padding: "10px 16px",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text)",
            background: "var(--fill-subtle)",
            borderBottom: "1px solid var(--divider)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns,
            padding: "8px 16px",
            background: "var(--fill-subtle)",
            borderBottom: "1px solid var(--divider)",
            alignItems: "center",
          }}
        >
          <div />
          <div />
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--text-muted)",
            }}
          >
            Artista - Música
          </div>
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--text-muted)",
                textAlign: "right",
              }}
            >
              {WEEKDAY_LABELS[wd]}
            </div>
          ))}
        </div>
        {entries.map((entry) => {
          const daily = dailyFor(entry);
          return (
            <div
              key={entry.song.id}
              style={{
                display: "grid",
                gridTemplateColumns,
                padding: "8px 16px",
                borderBottom: "1px solid var(--divider-soft)",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {entry.position}
              </div>
              <Cover cover={entry.cover} size={32} rounded={7} />
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  paddingRight: 8,
                }}
              >
                {formatSongArtist(entry.song)} - {entry.song.title}
              </div>
              {WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  style={{
                    fontSize: 13,
                    textAlign: "right",
                    color: daily[wd] ? "var(--text)" : "var(--text-disabled)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {renderCell(daily[wd])}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
