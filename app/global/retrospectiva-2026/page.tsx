import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { loadCoverUrlsForSongIds } from "@/lib/chart-entry-cover";
import { loadYearRetrospective } from "@/lib/global-retrospective";
import { buildArtistPath, buildSongPath } from "@/lib/music-routes";
import { prisma } from "@/lib/prisma";
import { ChevronLeft } from "lucide-react";

const YEAR = 2026;

export const metadata: Metadata = {
  title: "Retrospectiva 2026 do Global 100 | ChartFM",
  description: "As músicas e artistas mais pontuados de 2026 no Global 100 do ChartFM, somando todas as semanas consolidadas no ano.",
  alternates: { canonical: "/global/retrospectiva-2026" },
};

export default async function GlobalRetrospective2026Page() {
  const data = await loadYearRetrospective(YEAR);

  const songIds = [
    ...new Set(data.topSongs.map((s) => s.song.id).filter((id): id is string => Boolean(id))),
  ];
  const coverBySongId = songIds.length > 0 ? await loadCoverUrlsForSongIds(prisma, songIds) : new Map<string, string>();

  const hasData = data.weeksCount > 0;

  const introText = hasData
    ? `Em ${data.weeksCount} ${data.weeksCount === 1 ? "semana consolidada" : "semanas consolidadas"} do Global 100 em ${YEAR} (${data.firstDateRange} até ${data.lastDateRange}), ${data.distinctSongsCount} músicas diferentes e ${data.distinctArtistsCount} artistas diferentes entraram no ranking semanal, somando ${data.totalParadas} paradas pessoais publicadas no período.`
    : `Ainda não há semanas consolidadas do Global 100 em ${YEAR}.`;

  return (
    <Shell title={`Retrospectiva ${YEAR}`} subtitle="O ano no Global 100, em números reais">
      <Link
        href="/global/100"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 24,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-muted)",
          textDecoration: "none",
        }}
      >
        <ChevronLeft size={16} />
        Voltar para o Global 100
      </Link>

      <section style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: 0 }}>{introText}</p>
        {hasData && (
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-muted)", marginTop: 12 }}>
            {YEAR} é o primeiro ano de histórico do Global 100 - por isso toda música e todo artista desta lista
            estreou no ranking em {YEAR}. O ranking soma os pontos de cada música e artista em todas as semanas em
            que apareceram no top 100 semanal do ano.
          </p>
        )}
      </section>

      {hasData && (
        <>
          <section style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>
              Top {data.topSongs.length} músicas de {YEAR}
            </h2>
            <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 16, overflow: "hidden" }}>
              {data.topSongs.map((row, i) => {
                const imageUrl = row.song.id ? coverBySongId.get(row.song.id) ?? null : null;
                return (
                  <Link
                    key={row.key}
                    href={buildSongPath(row.song)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "36px 44px 1fr auto",
                      gap: 12,
                      alignItems: "center",
                      padding: "10px 18px",
                      borderBottom: i < data.topSongs.length - 1 ? "1px solid var(--divider-soft)" : "none",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 800, color: i === 0 ? "var(--accent)" : "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                      {i + 1}
                    </div>
                    <Cover
                      cover={{ ...row.cover, imageUrl: imageUrl ?? row.cover.imageUrl ?? null }}
                      song={{ ...row.song, imageUrl: imageUrl ?? row.song.imageUrl ?? null }}
                      size={44}
                      rounded={8}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.song.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.song.artist}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{row.totalPoints}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {row.weeksOnChart} {row.weeksOnChart === 1 ? "semana" : "semanas"} · pico #{row.bestPosition}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>
              Top {data.topArtists.length} artistas de {YEAR}
            </h2>
            <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 16, overflow: "hidden" }}>
              {data.topArtists.map((row, i) => (
                <Link
                  key={row.key}
                  href={buildArtistPath(row.name, row.spotifyId)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "36px 1fr auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px 18px",
                    borderBottom: i < data.topArtists.length - 1 ? "1px solid var(--divider-soft)" : "none",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 800, color: i === 0 ? "var(--accent)" : "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                    {i + 1}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.name}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{row.totalPoints}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {row.weeksOnChart} {row.weeksOnChart === 1 ? "semana" : "semanas"} · pico #{row.bestPosition}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </Shell>
  );
}
