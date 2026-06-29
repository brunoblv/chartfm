import Link from "next/link";
import { buildSongPath } from "@/lib/music-routes";
import { formatWeekLabel } from "@/lib/i18n/format";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { getWeeklyEditorialBody } from "@/lib/weekly-editorial";
import type { GlobalChartEntry } from "@/lib/types";

type Props = {
  globalChart: GlobalChartEntry[];
  weekLabel: string;
  weekIndex: number;
};

type TFn = (key: string, params?: Record<string, string | number>) => string;

function formatPoints(locale: string, points: number): string {
  return points.toLocaleString(locale === "en" ? "en-US" : "pt-BR");
}

function movementLabel(t: TFn, entry: GlobalChartEntry): string {
  switch (entry.status) {
    case "new":
      return t("landingEditorial.statusNew");
    case "return":
      return t("landingEditorial.statusReturn");
    case "up":
      return t("landingEditorial.statusUp", { delta: entry.delta ?? 0 });
    case "down":
      return t("landingEditorial.statusDown", { delta: entry.delta ?? 0 });
    default:
      return t("landingEditorial.statusSame");
  }
}

export async function LandingEditorialSection({ globalChart, weekLabel, weekIndex }: Props) {
  const { t, locale } = await getServerTranslations();
  const formattedWeek = formatWeekLabel(locale, weekLabel);
  const top10 = globalChart.slice(0, 10);
  const editorialBody = await getWeeklyEditorialBody(weekIndex, formattedWeek, globalChart);

  return (
    <section
      id="global-100-editorial"
      aria-labelledby="global-100-editorial-title"
      style={{
        padding: "72px 24px",
        background: "#FFFFFF",
        borderTop: "1px solid rgba(0,0,0,0.05)",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <article>
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#FA243C",
              margin: "0 0 12px 0",
            }}
          >
            {t("landingEditorial.eyebrow")}
          </p>

          <h2
            id="global-100-editorial-title"
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              color: "#1D1D1F",
              margin: "0 0 20px 0",
            }}
          >
            {t("landingEditorial.title", { week: formattedWeek })}
          </h2>

          {editorialBody ? (
            <p style={{ fontSize: 16, lineHeight: 1.75, color: "#6B6B70", margin: "0 0 28px 0" }}>
              {editorialBody}
            </p>
          ) : top10.length === 0 ? (
            <p style={{ fontSize: 16, lineHeight: 1.75, color: "#6B6B70", margin: "0 0 28px 0" }}>
              {t("landingEditorial.introEmpty")}
            </p>
          ) : null}

          {top10.length > 0 && (
            <>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "#1D1D1F",
                  margin: editorialBody ? "0 0 16px 0" : "0 0 16px 0",
                }}
              >
                {t("landingEditorial.listHeading", { week: formattedWeek })}
              </h3>

              <ol
                style={{
                  margin: "0 0 28px 0",
                  padding: 0,
                  listStyle: "none",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                {top10.map((entry, index) => {
                  const songHref = buildSongPath({
                    title: entry.song.title,
                    artist: entry.song.artist,
                    slugArtist: entry.song.slugArtist,
                    id: entry.song.id,
                    artistRefId: entry.song.artistRefId,
                    spotifyId: entry.song.spotifyId,
                  });

                  return (
                    <li
                      key={`${entry.position}-${entry.song.title}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "40px 1fr auto",
                        gap: 16,
                        alignItems: "center",
                        padding: "14px 18px",
                        borderTop: index === 0 ? "none" : "1px solid rgba(0,0,0,0.06)",
                        background: index % 2 === 0 ? "#FBFBFD" : "#FFFFFF",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          fontVariantNumeric: "tabular-nums",
                          color: entry.position <= 3 ? "#FA243C" : "#86868B",
                          textAlign: "center",
                        }}
                      >
                        {entry.position}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <Link
                          href={songHref}
                          style={{
                            display: "block",
                            fontSize: 15,
                            fontWeight: 600,
                            color: "#1D1D1F",
                            textDecoration: "none",
                            marginBottom: 2,
                          }}
                        >
                          {entry.song.title}
                        </Link>
                        <span style={{ fontSize: 13, color: "#86868B" }}>{entry.song.artist}</span>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F", fontVariantNumeric: "tabular-nums" }}>
                          {formatPoints(locale, entry.points)} {t("landingEditorial.pts")}
                        </div>
                        <div style={{ fontSize: 11, color: "#86868B", marginTop: 2 }}>
                          {movementLabel(t, entry)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}

          <p style={{ fontSize: 15, lineHeight: 1.75, color: "#6B6B70", margin: "0 0 24px 0" }}>
            {t("landingEditorial.outro")}
          </p>

          <nav
            aria-label={t("landingEditorial.navLabel")}
            style={{ display: "flex", flexWrap: "wrap", gap: 12 }}
          >
            <Link
              href={`/global/100${weekIndex ? `?week=${weekIndex}` : ""}`}
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#FFFFFF",
                background: "#FA243C",
                textDecoration: "none",
                borderRadius: 100,
                padding: "10px 18px",
              }}
            >
              {t("landingEditorial.viewFull")}
            </Link>
            <Link
              href="/guides/como-funciona-o-global-100"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#FA243C",
                background: "rgba(250,36,60,0.08)",
                textDecoration: "none",
                borderRadius: 100,
                padding: "10px 18px",
              }}
            >
              {t("landingEditorial.readGuide")}
            </Link>
            <Link
              href="/about"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#1D1D1F",
                background: "#F2F2F7",
                textDecoration: "none",
                borderRadius: 100,
                padding: "10px 18px",
              }}
            >
              {t("landingEditorial.aboutChartfm")}
            </Link>
          </nav>
        </article>
      </div>
    </section>
  );
}
