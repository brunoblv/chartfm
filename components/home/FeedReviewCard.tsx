"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  Repeat2,
  Share2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { ScoreSquare } from "@/components/ui/ScoreSquare";
import { COVER_PALETTES } from "@/lib/data";
import { useTranslations } from "@/hooks/useTranslations";
import type { ReviewItem } from "@/components/home/TimelineTabs";

export function FeedReviewCard({ review }: { review: ReviewItem }) {
  const { t } = useTranslations();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(review.helpful);

  const coverPalette = COVER_PALETTES[review.album.id % COVER_PALETTES.length];
  const truncated =
    review.body && review.body.length > 280 ? review.body.slice(0, 280) + "…" : review.body;

  function toggleLike() {
    setLiked((prev) => {
      setLikeCount((c) => c + (prev ? -1 : 1));
      return !prev;
    });
  }

  return (
    <article
      style={{
        background: "var(--surface)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        overflow: "hidden",
        color: "var(--text)",
      }}
    >
      <div style={{ display: "flex", gap: 14, marginBottom: 18, alignItems: "flex-start", padding: "20px 20px 0" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Link href={`/profile/${review.user.handle}`}>
            <Avatar user={review.user} imageUrl={review.user.imageUrl} size={44} />
          </Link>
          <span
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#FF9F0A",
              border: "2px solid var(--surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <PenLine size={8} strokeWidth={2.5} />
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              flexWrap: "wrap",
              lineHeight: 1.2,
            }}
          >
            <Link
              href={`/profile/${review.user.handle}`}
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text)",
                textDecoration: "none",
                letterSpacing: "-0.01em",
              }}
            >
              {review.user.name}
            </Link>
            {review.user.verified && <BadgeCheck size={15} color="#0A84FF" fill="#0A84FF" />}
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>@{review.user.handle}</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>·</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{review.postedAgo}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: "2px 9px",
                borderRadius: 100,
                background: "#FF9F0A20",
                color: "#FF9F0A",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Review
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 4 }}>
            {t("timeline.actionReview")}
          </div>
        </div>
        <button
          type="button"
          style={{
            padding: 4,
            color: "var(--text-muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div style={{ padding: "0 20px" }}>
        <div
          style={{
            border: "1px solid var(--divider)",
            borderRadius: 16,
            overflow: "hidden",
            background: "var(--bg)",
            boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          }}
        >
        <div style={{ display: "flex", gap: 16, padding: 18, alignItems: "flex-start" }}>
          <Link href={`/criticsfm/${review.album.id}`} style={{ lineHeight: 0, flexShrink: 0 }}>
            {review.album.coverUrl ? (
              <img
                src={review.album.coverUrl}
                alt={review.album.title}
                width={78}
                height={78}
                style={{ borderRadius: 13, objectFit: "cover" }}
              />
            ) : (
              <Cover
                cover={{ palette: coverPalette, seed: review.album.id, imageUrl: null }}
                song={{ title: review.album.title, artist: review.album.artistName }}
                size={78}
                rounded={13}
              />
            )}
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link
              href={`/criticsfm/${review.album.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "var(--text)",
                  letterSpacing: "-0.03em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {review.album.title}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                {review.album.artistName}
              </div>
            </Link>
          </div>
          <ScoreSquare score={review.rating} size={44} />
        </div>
        {truncated && (
          <div style={{ padding: "0 18px 18px" }}>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-subtle)", margin: 0 }}>
              {truncated}
            </p>
          </div>
        )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 18,
          padding: "14px 20px 20px",
          borderTop: "1px solid var(--divider-soft)",
        }}
      >
        <button
          type="button"
          onClick={toggleLike}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            color: liked ? "var(--accent)" : "var(--text-muted)",
            fontSize: 14,
            padding: "6px 16px 6px 0",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Heart size={17} fill={liked ? "currentColor" : "none"} />
          <span style={{ fontWeight: 500 }}>{likeCount > 0 ? likeCount : ""}</span>
        </button>
        <Link
          href={`/criticsfm/${review.album.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            color: "var(--text-muted)",
            fontSize: 14,
            padding: "6px 16px",
            textDecoration: "none",
          }}
        >
          <MessageCircle size={17} />
        </Link>
        <button
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            color: "var(--text-muted)",
            fontSize: 14,
            padding: "6px 16px",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Repeat2 size={17} />
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          style={{
            color: "var(--text-muted)",
            padding: "6px 8px",
            border: "none",
            background: "none",
            cursor: "pointer",
          }}
        >
          <Share2 size={17} />
        </button>
        <button
          type="button"
          style={{
            color: "var(--text-muted)",
            padding: "6px 2px 6px 4px",
            border: "none",
            background: "none",
            cursor: "pointer",
          }}
        >
          <Bookmark size={17} />
        </button>
      </div>
    </article>
  );
}
