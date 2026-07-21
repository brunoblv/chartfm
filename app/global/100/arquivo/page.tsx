import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { loadCoverUrlsForSongIds } from "@/lib/chart-entry-cover";
import type { GlobalSnapshotPayload } from "@/lib/global-snapshot";
import { ChevronLeft } from "lucide-react";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("globalArchive.metaTitle"),
    description: t("globalArchive.metaDescription"),
    alternates: { canonical: "/global/100/arquivo" },
  };
}

type WeekRow = {
  weekIndex: number;
  weekLabel: string;
  dateRange: string;
  topSong: GlobalSnapshotPayload["weeklySongs"][number] | null;
};

export default async function GlobalArchivePage() {
  const { t } = await getServerTranslations();
  const snapshots = await prisma.globalSnapshot.findMany({
    select: { weekIndex: true, weekLabel: true, dateRange: true, weeklySongs: true },
    orderBy: { weekIndex: "desc" },
  });

  const weeks: WeekRow[] = snapshots.map((s) => {
    const songs = s.weeklySongs as unknown as GlobalSnapshotPayload["weeklySongs"];
    const topSong = songs.find((song) => song.position === 1) ?? songs[0] ?? null;
    return {
      weekIndex: s.weekIndex,
      weekLabel: s.weekLabel,
      dateRange: s.dateRange,
      topSong,
    };
  });

  const songIds = [
    ...new Set(
      weeks
        .map((w) => w.topSong?.song.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const coverBySongId = songIds.length > 0 ? await loadCoverUrlsForSongIds(prisma, songIds) : new Map<string, string>();

  const totalWeeks = weeks.length;
  const oldest = weeks[weeks.length - 1] ?? null;
  const newest = weeks[0] ?? null;

  const introText =
    totalWeeks > 0
      ? t("globalArchive.introWithData", {
          count: totalWeeks,
          weekWord: totalWeeks === 1 ? t("globalArchive.weekSingular") : t("globalArchive.weekPlural"),
          oldestLabel: oldest?.weekLabel ?? "",
          oldestRange: oldest?.dateRange ?? "",
          newestLabel: newest?.weekLabel ?? "",
          newestRange: newest?.dateRange ?? "",
        })
      : t("globalArchive.introEmpty");

  return (
    <Shell title={t("globalArchive.title")} subtitle={t("globalArchive.subtitle")}>
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
        {t("globalArchive.backToGlobal100")}
      </Link>

      <section style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: 0 }}>{introText}</p>
      </section>

      {totalWeeks > 0 && (
        <section style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 16, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "48px 1fr auto",
              gap: 12,
              padding: "10px 18px",
              background: "var(--fill-inset)",
              borderBottom: "1px solid var(--divider)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            <div>#</div>
            <div>{t("globalArchive.colWeek")}</div>
            <div style={{ textAlign: "right" }}>{t("globalArchive.colNumberOne")}</div>
          </div>
          {weeks.map((w, i) => {
            const topSong = w.topSong;
            const imageUrl = topSong?.song.id ? coverBySongId.get(topSong.song.id) ?? null : null;
            return (
              <Link
                key={w.weekIndex}
                href={`/global/100?week=${w.weekIndex}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "48px 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 18px",
                  borderBottom: i < weeks.length - 1 ? "1px solid var(--divider-soft)" : "none",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {totalWeeks - i}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {w.weekLabel}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{w.dateRange}</div>
                </div>
                {topSong ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, justifySelf: "end" }}>
                    <div style={{ textAlign: "right", minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
                        {topSong.song.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
                        {topSong.song.artist}
                      </div>
                    </div>
                    <Cover
                      cover={{ ...topSong.cover, imageUrl: imageUrl ?? topSong.cover.imageUrl ?? null }}
                      song={{ ...topSong.song, imageUrl: imageUrl ?? topSong.song.imageUrl ?? null }}
                      size={40}
                      rounded={8}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", justifySelf: "end" }}>-</div>
                )}
              </Link>
            );
          })}
        </section>
      )}
    </Shell>
  );
}
