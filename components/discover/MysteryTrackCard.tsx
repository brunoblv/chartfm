"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, SkipForward } from "lucide-react";
import { FollowButton } from "@/components/ui/FollowButton";
import { Avatar } from "@/components/ui/Avatar";
import { useTranslations } from "@/hooks/useTranslations";

type MysteryTrack = {
  title: string;
  artist: string;
  spotifyId: string | null;
  coverUrl: string | null;
  palette: [string, string];
  publisher: {
    id: string;
    handle: string;
    name: string;
    avatarColor: string;
    image: string | null;
  };
};

function maskTitle(title: string): string {
  return title
    .split(" ")
    .map((word) => "▮".repeat(Math.min(word.length, 9)))
    .join(" ");
}

export function MysteryTrackCard() {
  const { t } = useTranslations();
  const [track, setTrack] = useState<MysteryTrack | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

  async function loadTrack() {
    setLoading(true);
    setRevealed(false);
    try {
      const res = await fetch("/api/discover/mystery-track", { cache: "no-store" });
      const data = (await res.json()) as { track: MysteryTrack | null };
      setTrack(data.track);
    } catch {
      setTrack(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrack();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          borderRadius: 18,
          overflow: "hidden",
          background: "#0F0F12",
          minHeight: 140,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.5)",
          fontSize: 13,
        }}
      >
        {t("moments.mysteryLoading")}
      </div>
    );
  }

  if (!track) {
    return (
      <div
        style={{
          borderRadius: 18,
          overflow: "hidden",
          background: "var(--surface)",
          border: "1px solid var(--divider)",
          padding: 24,
          color: "var(--text-muted)",
          fontSize: 13.5,
        }}
      >
        {t("moments.mysteryEmpty")}
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 18, overflow: "hidden", background: "#0F0F12", color: "#fff" }}>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr" }}>
        <div
          style={{
            position: "relative",
            minHeight: 140,
            background: track.coverUrl
              ? undefined
              : `linear-gradient(135deg, ${track.palette[0]}, ${track.palette[1]})`,
            backgroundImage: track.coverUrl ? `url(${track.coverUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: revealed ? "none" : "blur(2px) brightness(0.7)",
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                width: 0,
                height: 0,
                borderTop: "14px solid transparent",
                borderBottom: "14px solid transparent",
                borderLeft: "22px solid rgba(255,255,255,0.92)",
                marginLeft: 5,
              }}
            />
          </span>
        </div>
        <div style={{ padding: "26px 28px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
          {!revealed ? (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#FF8C8C",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                {t("moments.mysteryBadge")}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{maskTitle(track.title)}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>
                {t("moments.mysteryArtistHidden")}
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#6FE3C4",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                {t("moments.mysteryRevealed")}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{track.title}</div>
              <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>{track.artist}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                <Avatar
                  user={{ name: track.publisher.name, avatar: track.publisher.avatarColor }}
                  imageUrl={track.publisher.image}
                  size={28}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)" }}>
                    {t("moments.mysteryNominatedBy")}{" "}
                    <Link
                      href={`/profile/${track.publisher.handle}`}
                      style={{ color: "#fff", fontWeight: 700, textDecoration: "none" }}
                    >
                      {track.publisher.name}
                    </Link>
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <FollowButton targetId={track.publisher.id} variant="outline" size="sm" />
                </div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {!revealed && (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 100,
                  border: "none",
                  background: "#fff",
                  color: "#0F0F12",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <Heart size={16} />
                {t("moments.mysteryLikeReveal")}
              </button>
            )}
            <button
              type="button"
              onClick={loadTrack}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 100,
                border: revealed ? "none" : "1px solid rgba(255,255,255,0.25)",
                background: revealed ? "#fff" : "transparent",
                color: revealed ? "#0F0F12" : "#fff",
                fontSize: 13.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <SkipForward size={16} />
              {revealed ? t("moments.mysteryNextTrack") : t("moments.mysterySkipToNext")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
