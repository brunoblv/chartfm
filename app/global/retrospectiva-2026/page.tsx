import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { loadCoverUrlsForSongIds } from "@/lib/chart-entry-cover";
import { loadYearRetrospective } from "@/lib/global-retrospective";
import { buildArtistPath, buildSongPath } from "@/lib/music-routes";
import { prisma } from "@/lib/prisma";
import { ChevronLeft } from "lucide-react";
import { getServerTranslations } from "@/lib/i18n/server-translations";

const YEAR = 2026;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("globalRetrospective.metaTitle", { year: YEAR }),
    description: t("globalRetrospective.metaDescription", { year: YEAR }),
    alternates: { canonical: "/global/retrospectiva-2026" },
  };
}

export default async function GlobalRetrospective2026Page() {
  const { t } = await getServerTranslations();
  const data = await loadYearRetrospective(YEAR);

  const songIds = [
    ...new Set(data.topSongs.map((s) => s.song.id).filter((id): id is string => Boolean(id))),
  ];
  const coverBySongId = songIds.length > 0 ? await loadCoverUrlsForSongIds(prisma, songIds) : new Map<string, string>();

  const hasData = data.weeksCount > 0;

  const introText = hasData
    ? t("globalRetrospective.introWithData", {
        weeksCount: data.weeksCount,
        weekWord: data.weeksCount === 1 ? t("globalRetrospective.weekConsolidatedSingular") : t("globalRetrospective.weekConsolidatedPlural"),
        year: YEAR,
        firstRange: data.firstDateRange ?? "",
        lastRange: data.lastDateRange ?? "",
        songsCount: data.distinctSongsCount,
        artistsCount: data.distinctArtistsCount,
        paradasCount: data.totalParadas,
      })
    : t("globalRetrospective.introEmpty", { year: YEAR });

  return (
    <Shell title={t("globalRetrospective.title", { year: YEAR })} subtitle={t("globalRetrospective.subtitle")}>
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
        {t("globalRetrospective.backToGlobal100")}
      </Link>

      <section style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: 0 }}>{introText}</p>
        {hasData && (
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-muted)", marginTop: 12 }}>
            {t("globalRetrospective.firstYearNote", { year: YEAR })}
          </p>
        )}
      </section>

      {hasData && (
        <>
          <section style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>
              {t("globalRetrospective.topSongsTitle", { count: data.topSongs.length, year: YEAR })}
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
                        {t("globalRetrospective.weeksOnChart", {
                          count: row.weeksOnChart,
                          weekWord: row.weeksOnChart === 1 ? t("globalRetrospective.weekSingular") : t("globalRetrospective.weekPlural"),
                          position: row.bestPosition,
                        })}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>
              {t("globalRetrospective.topArtistsTitle", { count: data.topArtists.length, year: YEAR })}
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
                      {t("globalRetrospective.weeksOnChart", {
                        count: row.weeksOnChart,
                        weekWord: row.weeksOnChart === 1 ? t("globalRetrospective.weekSingular") : t("globalRetrospective.weekPlural"),
                        position: row.bestPosition,
                      })}
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
