"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { FollowButton } from "@/components/ui/FollowButton";
import { PositionNumber } from "@/components/ui/PositionNumber";
import { COVER_PALETTES } from "@/lib/data";
import { buildArtistPath, buildSongPath } from "@/lib/music-routes";
import { useLocale, useTranslations } from "@/hooks/useTranslations";
import type { GlobalChartEntry } from "@/lib/types";

type PublisherRow = {
  userId: string;
  chartId: string;
  handle: string;
  name: string;
  avatarColor: string;
  image: string | null;
  entryCount: number;
};

export function FriendsRow({ publishers }: { publishers: PublisherRow[] }) {
  const { t } = useTranslations();
  return (
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>{t("home.latestCharts")}</div>
      </div>
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingTop: 4, paddingBottom: 4, paddingLeft: 4 }}>
        {publishers.map((p) => (
          <Link
            key={p.userId}
            href={`/profile/${p.handle}`}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textDecoration: "none", color: "inherit", flexShrink: 0 }}
          >
            <div style={{ position: "relative" }}>
              <Avatar user={{ name: p.name, avatar: p.avatarColor }} imageUrl={p.image} size={56} ring />
              <div
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  background: "var(--accent)",
                  color: "white",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 8,
                  border: "2px solid var(--surface)",
                }}
              >
                {p.entryCount}
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                maxWidth: 70,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "center",
              }}
            >
              {p.name.split(" ")[0]}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function GlobalTeaser({ topSongs, weekLabel }: { topSongs: GlobalChartEntry[]; weekLabel: string }) {
  const { t } = useTranslations();
  const top3 = topSongs.slice(0, 3);
  return (
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--btn-dark-bg)", color: "var(--btn-dark-fg)", display: "grid", placeItems: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em" }}>{t("home.globalChart")}</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{weekLabel}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {top3.map((e) => (
          <div key={e.position} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PositionNumber n={e.position} size={14} />
            <Link href={buildSongPath(e.song)} style={{ lineHeight: 0, flexShrink: 0 }}>
              <Cover cover={e.cover} song={e.song} size={36} rounded={6} />
            </Link>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Link href={buildSongPath(e.song)} style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}>
                {e.song.title}
              </Link>
              <Link href={buildArtistPath(e.song.artist, e.song.artistSpotifyId, e.song.artistRefId)} style={{ display: "block", fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>
                {e.song.artist}
              </Link>
            </div>
          </div>
        ))}
      </div>
      <Link href="/global" style={{ marginTop: 14, fontSize: 12, color: "var(--accent)", fontWeight: 600, textDecoration: "none", display: "inline-block" }}>
        {t("home.viewFullChart")}
      </Link>
    </div>
  );
}

type SuggestedUserRow = {
  id: string;
  handle: string;
  name: string;
  followers: number;
  avatarColor: string;
  image: string | null;
  commonGenres: number;
  isFollowing?: boolean;
};

type SuggestedTab = "forYou" | "newUsers";

function SuggestedUserList({ users, emptyMessage }: { users: SuggestedUserRow[]; emptyMessage: string }) {
  const { t } = useTranslations();
  const { locale } = useLocale();
  const numberLocale = locale === "en" ? "en-US" : "pt-BR";

  if (users.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {users.map((u) => (
        <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href={`/profile/${u.handle}`}>
            <Avatar user={{ name: u.name, avatar: u.avatarColor }} imageUrl={u.image} size={40} />
          </Link>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Link href={`/profile/${u.handle}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                @{u.handle} · {u.followers.toLocaleString(numberLocale)} {t("home.followers")}
              </div>
            </Link>
          </div>
          <FollowButton targetId={u.id} initialFollowing={u.isFollowing} variant="dark" />
        </div>
      ))}
    </div>
  );
}

export function SuggestedUsers({ users, newUsers }: { users: SuggestedUserRow[]; newUsers: SuggestedUserRow[] }) {
  const [activeTab, setActiveTab] = useState<SuggestedTab>("forYou");
  const { t } = useTranslations();

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 12px",
    borderRadius: 8,
    border: "none",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    background: active ? "var(--surface)" : "transparent",
    color: active ? "var(--text)" : "var(--text-muted)",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
    transition: "all 150ms",
    whiteSpace: "nowrap" as const,
  });

  const tabs: { key: SuggestedTab; label: string }[] = [
    { key: "forYou", label: t("home.whoToFollowForYou") },
    { key: "newUsers", label: t("home.whoToFollowNewUsers") },
  ];

  return (
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em", marginBottom: 12 }}>{t("home.whoToFollow")}</div>
      <div style={{ display: "inline-flex", gap: 3, background: "var(--fill-subtle)", borderRadius: 11, padding: 3, marginBottom: 14 }}>
        {tabs.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} style={tabStyle(activeTab === tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>
      <SuggestedUserList
        users={activeTab === "forYou" ? users : newUsers}
        emptyMessage={activeTab === "forYou" ? t("home.noSuggestedUsers") : t("home.noNewUsers")}
      />
    </div>
  );
}

export function TrendingArtists({
  artists,
  weekLabel,
}: {
  artists: { name: string; totalPoints: number; chartCount: number; imageUrl: string | null }[];
  weekLabel: string;
}) {
  const { t } = useTranslations();
  if (artists.length === 0) return null;
  return (
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em" }}>{t("home.trendingArtists")}</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{weekLabel}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {artists.map((a, i) => (
          <Link key={a.name} href={buildArtistPath(a.name)} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", width: 20, fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: a.imageUrl
                  ? `url(${a.imageUrl}) center/cover no-repeat`
                  : `linear-gradient(135deg, ${COVER_PALETTES[i * 3][0]}, ${COVER_PALETTES[i * 3][1]})`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {t("home.chartsPoints", { charts: a.chartCount, points: a.totalPoints })}
              </div>
            </div>
          </Link>
        ))}
      </div>
      <Link href="/global" style={{ display: "inline-block", marginTop: 14, fontSize: 12, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
        {t("home.viewFullChart")}
      </Link>
    </div>
  );
}
