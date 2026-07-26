import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { GlobalSecondaryCards, GlobalGenreList } from "@/components/global/GlobalHubCards";
import { Ad } from "@/components/ui/Ad";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { getRankingWeekReference } from "@/lib/chart-week";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import { prisma } from "@/lib/prisma";
import type { GlobalChartEntry } from "@/lib/types";
import { ChevronLeft } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("global.hubMetaTitle"),
    description: t("global.hubMetaDescription"),
    alternates: { canonical: "/global" },
  };
}

async function getGlobal100Preview(limit = 5): Promise<{ weekLabel: string; songs: GlobalChartEntry[] }> {
  const rankingWeek = getRankingWeekReference(new Date(), await getGlobalPublishSlot());
  const latest = await prisma.globalSnapshot.findFirst({
    where: { weekIndex: { lte: rankingWeek.weekIndex } },
    orderBy: { weekIndex: "desc" },
    select: { weekLabel: true, weeklySongs: true },
  });
  if (!latest) return { weekLabel: rankingWeek.weekLabel, songs: [] };
  const songs = (latest.weeklySongs as unknown as GlobalChartEntry[]).slice(0, limit);
  return { weekLabel: latest.weekLabel, songs };
}

function statusChip(entry: GlobalChartEntry, t: (key: string, params?: Record<string, string | number>) => string) {
  if (entry.status === "new") {
    return (
      <span
        style={{
          background: "rgba(250,36,60,0.18)",
          color: "#FF8C8C",
          fontSize: 9.5,
          fontWeight: 700,
          padding: "2px 6px",
          borderRadius: 100,
          textTransform: "uppercase" as const,
          flexShrink: 0,
        }}
      >
        {t("global.hubStatusNew")}
      </span>
    );
  }
  if (entry.status === "up") {
    return (
      <span style={{ background: "rgba(6,214,160,0.18)", color: "#6FE3C4", fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 100, flexShrink: 0 }}>
        ▲ {entry.delta}
      </span>
    );
  }
  if (entry.status === "down") {
    return (
      <span style={{ background: "rgba(214,69,69,0.18)", color: "#FF8686", fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 100, flexShrink: 0 }}>
        ▼ {Math.abs(entry.delta ?? 0)}
      </span>
    );
  }
  return (
    <span style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 10.5, fontWeight: 600, padding: "2px 6px", borderRadius: 100, flexShrink: 0 }}>
      -
    </span>
  );
}

export default async function GlobalHubPage() {
  const { t } = await getServerTranslations();
  const preview = await getGlobal100Preview(5);

  return (
    <Shell title={t("global.hubTitle")} subtitle={t("global.hubSubtitle")}>
      {/* ===== HERO: GLOBAL 100 EM DESTAQUE, COM PRÉVIA AO VIVO ===== */}
      <section style={{ marginBottom: 20 }}>
        <div
          style={{
            background: "#0F0F12",
            color: "#fff",
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <div style={{ padding: "32px 32px 30px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FA243C", boxShadow: "0 0 0 3px rgba(250,36,60,0.25)" }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>
                  {t("global.hubLiveLabel", { week: preview.weekLabel })}
                </span>
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10 }}>Global 100</div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, margin: "0 0 22px 0" }}>
                {t("global.hubHeroDesc")}
              </p>
              <Link
                href="/global/100"
                style={{
                  alignSelf: "flex-start",
                  padding: "12px 26px",
                  borderRadius: 100,
                  background: "#FA243C",
                  color: "#fff",
                  fontSize: 13.5,
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: "0 4px 16px rgba(250,36,60,0.35)",
                }}
              >
                {t("global.hubViewFullGlobal100")}
              </Link>
            </div>
            <div style={{ padding: "24px 28px", background: "rgba(255,255,255,0.04)" }}>
              {preview.songs.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {preview.songs.map((entry, i) => (
                    <div
                      key={`${entry.song.id}-${entry.position}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "9px 0",
                        borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <span style={{ width: 20, fontSize: 15, fontWeight: 800, color: i < 2 ? "#FA243C" : "rgba(255,255,255,0.5)", textAlign: "center" as const }}>
                        {entry.position}
                      </span>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 7,
                          flexShrink: 0,
                          background: entry.cover.imageUrl
                            ? undefined
                            : `linear-gradient(135deg, ${entry.cover.palette[0]}, ${entry.cover.palette[1]})`,
                          backgroundImage: entry.cover.imageUrl ? `url(${entry.cover.imageUrl})` : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {entry.song.title}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{entry.song.artist}</div>
                      </div>
                      {statusChip(entry, t)}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", padding: "20px 0" }}>
                  {t("global.hubFormingWeek")}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECUNDÁRIAS: AIRPLAY + ÁLBUNS ===== */}
      <section style={{ marginBottom: 48 }}>
        <GlobalSecondaryCards />
      </section>

      {/* ===== GÊNEROS: LISTA COMPACTA ===== */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px 0" }}>
          {t("global.hubGenresTitle")}
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 18px 0", lineHeight: 1.6 }}>
          {t("global.hubGenresDesc")}
        </p>
        <GlobalGenreList />
      </section>

      {/* ===== CTA: PARTICIPAÇÃO ===== */}
      <section style={{ marginBottom: 48 }}>
        <div
          style={{
            padding: "26px 28px",
            display: "flex",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
            borderRadius: 18,
            border: "1px solid rgba(250,36,60,0.15)",
            background: "var(--accent-tint)",
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              {t("global.hubCtaTitle")}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 4 }}>
              {t("global.hubCtaDesc")}
            </div>
          </div>
          <Link
            href="/create/start"
            style={{
              flexShrink: 0,
              padding: "11px 22px",
              borderRadius: 100,
              background: "var(--accent)",
              color: "#fff",
              fontSize: 13.5,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t("global.hubCtaButton")}
          </Link>
        </div>
      </section>

      <Ad placement="globalHub" format="rectangle" style={{ margin: "0 0 28px 0" }} />

      {/* ===== COMO FUNCIONA ===== */}
      <section style={{ borderTop: "1px solid var(--divider)", paddingTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t("global.hubHowTitle")}</h2>
        <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-muted)", fontSize: 14, lineHeight: 1.8 }}>
          <li>{t("global.hubHowCharts")}</li>
          <li>{t("global.hubHowGenres")}</li>
          <li>{t("global.hubHowAirplay")}</li>
          <li>{t("global.hubHowAlbums")}</li>
        </ul>
        <Link
          href="/guides/como-funciona-o-global-100"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 16,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          <ChevronLeft size={16} style={{ transform: "rotate(180deg)" }} />
          {t("global.hubGuideLink")}
        </Link>
      </section>
    </Shell>
  );
}
