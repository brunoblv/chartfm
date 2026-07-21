"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CopaArtistAvatar } from "@/app/copa/CopaArtistAvatar";
import type { CopaLiveFeedData, CopaLiveFeedFixture } from "@/lib/copa-live-feed";
import { useTranslations } from "@/hooks/useTranslations";

const SLIDE_MS = 5500;
const REFRESH_MS = 12000;

function LiveBadge() {
  const { t } = useTranslations();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 10,
        fontWeight: 700,
        background: "var(--accent-tint)",
        color: "var(--accent)",
        padding: "3px 9px",
        borderRadius: 99,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--accent)",
          display: "inline-block",
          animation: "copaFeedPulse 1.4s ease-in-out infinite",
        }}
      />
      {t("copaLiveFeed.live")}
    </span>
  );
}

function FixtureSlide({ f }: { f: CopaLiveFeedFixture }) {
  const { t } = useTranslations();
  const totalVotes = f.votesA + f.votesB || 1;
  const pctA = (f.votesA / totalVotes) * 100;

  return (
    <div style={{ padding: "4px 2px 2px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, textAlign: "center" }}>
        {f.phaseLabel}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
          <CopaArtistAvatar {...f.artistA} coverUrl={f.singleACover} size={52} />
          <div style={{ fontSize: 13, fontWeight: 800, textAlign: "center", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {f.artistA.artistName}
          </div>
          {f.singleAName && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              &quot;{f.singleAName}&quot;
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: f.goalsA >= f.goalsB ? "var(--text)" : "var(--text-muted)" }}>
              {f.goalsA}
            </span>
            <span style={{ fontSize: 16, color: "var(--text-muted)" }}>-</span>
            <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, color: f.goalsB >= f.goalsA ? "var(--text)" : "var(--text-muted)" }}>
              {f.goalsB}
            </span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginTop: 4 }}>
            {f.votesA} × {f.votesB} {t("copaLiveFeed.votes")}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
          <CopaArtistAvatar {...f.artistB} coverUrl={f.singleBCover} size={52} />
          <div style={{ fontSize: 13, fontWeight: 800, textAlign: "center", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {f.artistB.artistName}
          </div>
          {f.singleBName && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              &quot;{f.singleBName}&quot;
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 4, background: "var(--fill-inset)", borderRadius: 3, overflow: "hidden", marginTop: 14 }}>
        <div
          style={{
            height: "100%",
            width: `${pctA}%`,
            background: `linear-gradient(90deg, ${f.artistA.artistColor}, ${f.artistB.artistColor})`,
            borderRadius: 3,
            transition: "width 0.5s ease",
          }}
        />
      </div>

      <div style={{ textAlign: "center", marginTop: 12, fontSize: 13, fontWeight: 700, color: f.myVote ? "var(--up-fg)" : "var(--accent)" }}>
        {f.myVote
          ? t("copaLiveFeed.youVotedFor", { name: f.myVote === "A" ? f.artistA.artistName : f.artistB.artistName })
          : t("copaLiveFeed.tapToVote")}
      </div>
    </div>
  );
}

export function CopaLiveFeedCarousel({ initial }: { initial: CopaLiveFeedData }) {
  const { t } = useTranslations();
  const [data, setData] = useState(initial);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const total = data.fixtures.length;
  const safeIndex = total > 0 ? index % total : 0;

  const next = useCallback(() => {
    if (total <= 1) return;
    setIndex((i) => (i + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    if (total <= 1) return;
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (paused || total <= 1) return;
    const t = setInterval(next, SLIDE_MS);
    return () => clearInterval(t);
  }, [paused, next, total]);

  useEffect(() => {
    const refresh = () => {
      fetch("/api/copa/live-feed")
        .then((r) => r.json())
        .then((json: CopaLiveFeedData | null) => {
          if (json?.fixtures?.length) {
            setData(json);
            setIndex((i) => (json.fixtures.length ? i % json.fixtures.length : 0));
          }
        })
        .catch(() => {});
    };
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  if (total === 0) return null;

  const current = data.fixtures[safeIndex];

  return (
    <article
      style={{
        background: "var(--surface)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "16px 18px 0",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)" }}>
            ⚽ {data.copaName}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {total} {total === 1 ? t("copaLiveFeed.liveDisputeSingular") : t("copaLiveFeed.liveDisputePlural")}
          </div>
        </div>
        <LiveBadge />
      </div>

      <Link href={`/copa/jogo/${current.id}`} style={{ textDecoration: "none", color: "inherit", display: "block", padding: "14px 18px 10px" }}>
        <FixtureSlide f={current} />
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "0 14px 14px",
        }}
      >
        {total > 1 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              onClick={prev}
              aria-label={t("copaLiveFeed.prevDispute")}
              style={{
                width: 28,
                height: 28,
                borderRadius: 99,
                border: "1px solid var(--divider)",
                background: "var(--fill-inset)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text-muted)",
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {data.fixtures.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  aria-label={t("copaLiveFeed.goToDispute", { n: i + 1 })}
                  onClick={() => setIndex(i)}
                  style={{
                    width: i === safeIndex ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    border: "none",
                    padding: 0,
                    background: i === safeIndex ? "#FFD426" : "var(--divider)",
                    cursor: "pointer",
                    transition: "width 0.25s ease, background 0.25s ease",
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={next}
              aria-label={t("copaLiveFeed.nextDispute")}
              style={{
                width: 28,
                height: 28,
                borderRadius: 99,
                border: "1px solid var(--divider)",
                background: "var(--fill-inset)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text-muted)",
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <span />
        )}

        <Link
          href="/copa/ao-vivo"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--accent)",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          {t("copaLiveFeed.viewAll")}
        </Link>
      </div>

      <style>{`
        @keyframes copaFeedPulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
    </article>
  );
}
