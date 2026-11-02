import { getServerSession } from "next-auth";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { authOptions } from "@/lib/auth-options";
import { getActiveClubeRound } from "@/lib/clube-album";
import { getCriticsFMCatalog } from "@/lib/criticsfm-data";
import { CRITICSFM_PAGE_SIZE, queryCriticsFMAlbums, topRatedCriticsFM } from "@/lib/criticsfm-query";
import { getActiveWeeklyRelease } from "@/lib/weekly-releases";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { CriticsFMClient } from "./CriticsFMClient";
import { ScoreScaleCard } from "./ScoreScaleCard";
import type { ClubeRoundData } from "@/lib/clube-album";
import type { WeeklyReleaseData, WeeklyReleaseAlbumInfo } from "@/lib/weekly-releases";

export const revalidate = 60;

type Translate = Awaited<ReturnType<typeof getServerTranslations>>["t"];

function getPhaseStatus(t: Translate): Record<string, { label: string; dot: string; cta: string }> {
  return {
    "0": { label: t("criticsfm.waitingSignups"), dot: "#86868B", cta: t("criticsfm.viewClube") },
    "1": { label: t("criticsfm.signupsOpen"), dot: "#1B873F", cta: t("criticsfm.ctaNominate") },
    "2": { label: t("criticsfm.pollOpen"), dot: "#E09F00", cta: t("criticsfm.ctaVoteNow") },
    "3": { label: t("criticsfm.resultPublished"), dot: "var(--accent)", cta: t("criticsfm.ctaViewResult") },
    "4": { label: t("criticsfm.listeningPeriod"), dot: "#5856D6", cta: t("criticsfm.viewClube") },
  };
}

function SectionHeader({
  title,
  subtitle,
  href,
  linkText,
}: {
  title: string;
  subtitle?: string;
  href: string;
  linkText: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 20,
        gap: 12,
      }}
    >
      <div>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "var(--text)",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              margin: "4px 0 0",
              letterSpacing: "-0.01em",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <Link
        href={href}
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-muted)",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
          paddingTop: 3,
        }}
      >
        {linkText} →
      </Link>
    </div>
  );
}

function LancamentoAlbumCard({ album }: { album: WeeklyReleaseAlbumInfo }) {
  const hue = Math.abs(
    album.title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0),
  ) % 360;

  return (
    <Link
      href={`/criticsfm/${album.albumId}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--divider)",
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ position: "relative", width: "100%", aspectRatio: "1/1" }}>
          {album.coverUrl ? (
            <img
              src={album.coverUrl}
              alt={album.title}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `hsl(${hue},50%,60%)`,
                display: "grid",
                placeItems: "center",
                color: "white",
                fontSize: 40,
                fontWeight: 800,
              }}
            >
              {album.title[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ padding: "12px 14px 14px" }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: "var(--text)",
            }}
          >
            {album.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {album.artist}
          </div>
          {album.year && (
            <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 4 }}>
              {album.year}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function LancamentosSection({ release, t }: { release: WeeklyReleaseData | null; t: Translate }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <SectionHeader
        title={t("criticsfm.weeklyReleasesTitle")}
        subtitle={
          release
            ? t(
                release.albums.length === 1
                  ? "criticsfm.weeklyReleaseSubtitleSingular"
                  : "criticsfm.weeklyReleaseSubtitlePlural",
                { week: release.weekLabel, count: release.albums.length },
              )
            : t("criticsfm.newAlbumsSubtitle")
        }
        href="/criticsfm/lancamentos"
        linkText={t("criticsfm.viewAll")}
      />
      {!release ? (
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 16,
            border: "1px solid var(--divider)",
            padding: "32px 24px",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 14,
          }}
        >
          {t("criticsfm.noReleasesThisWeek")}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
            gap: 14,
          }}
        >
          {release.albums.map((album) => (
            <LancamentoAlbumCard key={album.albumId} album={album} />
          ))}
        </div>
      )}
    </section>
  );
}

function ClubeSection({ round, t }: { round: ClubeRoundData | null; t: Translate }) {
  const phaseStatus = getPhaseStatus(t);
  const phaseInfo = round ? (phaseStatus[round.phase] ?? phaseStatus["0"]) : null;

  return (
    <section style={{ marginBottom: 48 }}>
      <SectionHeader
        title={t("criticsfm.albumClub")}
        subtitle={t("criticsfm.clubeSubtitle")}
        href="/criticsfm/clube"
        linkText={t("criticsfm.viewClube")}
      />
      <Link
        href="/criticsfm/clube"
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 20,
            border: "1px solid var(--divider)",
            padding: "24px 28px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            cursor: "pointer",
          }}
        >
          {!round ? (
            <div
              style={{
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 14,
                padding: "16px 0",
              }}
            >
              {t("criticsfm.noActiveRound")}
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      marginBottom: 8,
                    }}
                  >
                    {t("criticsfm.roundNumber", { number: round.number })}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                      color: "var(--text)",
                      marginBottom: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {round.theme}
                  </div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "var(--fill-inset)",
                      borderRadius: 100,
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-subtle)",
                      border: "1px solid var(--divider)",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: phaseInfo?.dot,
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    {phaseInfo?.label}
                  </span>
                </div>
                <div
                  style={{
                    background: "var(--btn-dark-bg)",
                    color: "var(--btn-dark-fg)",
                    padding: "9px 18px",
                    borderRadius: 100,
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    alignSelf: "center",
                  }}
                >
                  {phaseInfo?.cta} →
                </div>
              </div>
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 20,
                  borderTop: "1px solid var(--divider)",
                  display: "flex",
                  gap: 28,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      color: "var(--text)",
                    }}
                  >
                    {round.nominations.length}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {t("criticsfm.nominationsLabel")}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      color: "var(--text)",
                    }}
                  >
                    {round.participantCount}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {t("criticsfm.membersLabel")}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Link>
    </section>
  );
}

export default async function CriticsFMPage() {
  const { t } = await getServerTranslations();
  const session = await getServerSession(authOptions);
  const [catalog, round, weeklyRelease] = await Promise.all([
    getCriticsFMCatalog(),
    getActiveClubeRound(session?.user?.id ?? null),
    getActiveWeeklyRelease(),
  ]);
  return (
    <Shell
      title={t("criticsfm.title")}
      subtitle={t("criticsfm.pageSubtitle")}
    >
      <p
        style={{
          fontSize: 15,
          color: "var(--text-muted)",
          lineHeight: 1.65,
          marginBottom: 48,
          letterSpacing: "-0.01em",
        }}
      >
        {t("criticsfm.introText")}
      </p>

      <LancamentosSection release={weeklyRelease} t={t} />
      <ClubeSection round={round} t={t} />
      <ScoreScaleCard />

      <section style={{ marginTop: 8 }}>
        <CriticsFMClient
          initialPage={queryCriticsFMAlbums(catalog, {
            filter: "all",
            sort: "recent",
            q: "",
            offset: 0,
            limit: CRITICSFM_PAGE_SIZE,
          })}
          topAlbums={topRatedCriticsFM(catalog)}
        />
      </section>
    </Shell>
  );
}
