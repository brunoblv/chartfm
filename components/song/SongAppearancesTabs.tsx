"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Star, Upload, Trash2, ThumbsUp, Check } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useTranslations } from "@/hooks/useTranslations";
import type { SongParadaAppearanceGroup, SongParadaUserStats, SongAppearanceRow } from "@/lib/song-parada-appearances";

type TFn = (key: string, params?: Record<string, string | number>) => string;

async function compressImage(file: File, maxBytes = 700 * 1024): Promise<File> {
  if (file.size <= maxBytes) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const scale = Math.min(1, Math.sqrt(maxBytes / file.size));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size <= maxBytes || quality <= 0.3) {
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            } else {
              quality -= 0.1;
              tryCompress();
            }
          },
          "image/jpeg",
          quality,
        );
      };
      tryCompress();
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

type GlobalStats = {
  totalPoints: number;
  uniqueUsers: number;
  weeksTop100: number;
  number1s: number;
  peak: number;
};

type TopUser = {
  user: { id: string; handle: string; name: string; avatarColor: string; image: string | null };
  points: number;
};

type VideoClip = {
  id: string;
  imageUrl: string;
  votes: number;
  uploadedBy: string;
  uploaderName: string;
  uploaderHandle: string;
  hasVoted: boolean;
  isMyChoice: boolean;
  isMyUpload: boolean;
};

type Props = {
  currentUserId: string | null;
  songId: string;
  myParadaSections: SongParadaAppearanceGroup[];
  globalStats: GlobalStats;
  topUsers: TopUser[];
  initialVideoClipUrl: string | null;
  initialClips: VideoClip[];
};

function userStatsCards(stats: SongParadaUserStats, t: TFn): { label: string; value: string | number }[] {
  return [
    { label: t("song.appearancesWeeks"), value: stats.appearances },
    { label: t("song.appearancesBestPosition"), value: stats.bestPosition === 9999 ? "-" : `#${stats.bestPosition}` },
    { label: t("song.appearancesYourPoints"), value: stats.points },
    { label: t("song.appearancesYourNumberOnes"), value: stats.number1s },
  ];
}

function paradaTabLabel(section: SongParadaAppearanceGroup, t: TFn): string {
  return section.isPrimary ? t("song.appearancesPrimaryChart") : section.paradaName || t("song.appearancesSecondaryChart");
}

function AppearancesTable({ rows }: { rows: SongAppearanceRow[] }) {
  const { t } = useTranslations();
  return (
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "60px minmax(0,1fr) 110px 70px 110px",
          padding: "0 20px",
          background: "var(--fill-inset)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        {[t("song.appearancesColPos"), t("song.appearancesColWeek"), t("song.appearancesColWeekOfYear"), t("song.appearancesColYear"), ""].map((h, i) => (
          <div key={i} style={{ padding: "10px 8px", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            {h}
          </div>
        ))}
      </div>
      {rows.map((row, i) => {
        const last = i === rows.length - 1;
        return (
          <div
            key={row.chartId}
            style={{
              display: "grid",
              gridTemplateColumns: "60px minmax(0,1fr) 110px 70px 110px",
              alignItems: "center",
              padding: "8px 20px",
              borderBottom: last ? "none" : "1px solid rgba(0,0,0,0.04)",
              gap: 0,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.04em",
                color: "var(--text)",
                fontVariantNumeric: "tabular-nums",
                textAlign: "right",
                paddingRight: 12,
              }}
            >
              {row.position}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", padding: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.dateRange}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
              {t("song.appearancesWeekOfYearShort", { week: row.weekOfYear })}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
              {row.year}
            </div>
            <div style={{ padding: "0 8px" }}>
              <Link href={`/chart/${row.chartId}`} style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", textDecoration: "none" }}>
                {t("song.appearancesViewChart")}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SongAppearancesTabs({ currentUserId, songId, myParadaSections, globalStats, topUsers, initialVideoClipUrl, initialClips }: Props) {
  const { t } = useTranslations();
  const isLoggedIn = !!currentUserId;
  const [activeTab, setActiveTab] = useState<"mine" | "global" | "video_clip">(isLoggedIn ? "mine" : "global");
  const [activeParadaId, setActiveParadaId] = useState<string | null>(myParadaSections[0]?.paradaId ?? null);
  const activeParadaSection =
    myParadaSections.find((section) => section.paradaId === activeParadaId) ?? myParadaSections[0] ?? null;
  const [videoClipUrl, setVideoClipUrl] = useState<string | null>(initialVideoClipUrl);
  const [uploading, setUploading] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clips, setClips] = useState<VideoClip[]>(initialClips);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [choosingId, setChoosingId] = useState<string | null>(null);

  const userCards = activeParadaSection ? userStatsCards(activeParadaSection.stats, t) : [];

  const globalCards: { label: string; value: string | number }[] = [
    { label: t("song.appearancesTotalPoints"), value: globalStats.totalPoints },
    { label: t("song.appearancesUniqueUsers"), value: globalStats.uniqueUsers },
    { label: t("song.appearancesWeeksTop100"), value: globalStats.weeksTop100 },
    { label: t("song.appearancesNumberOnesTop100"), value: globalStats.number1s },
  ];

  const cards = activeTab === "mine" && isLoggedIn ? userCards : globalCards;
  const showCards = activeTab !== "video_clip" && (activeTab === "global" || isLoggedIn);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setClipError(null);
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("file", compressed);
      const res = await fetch(`/api/user/song-video-clip?songId=${encodeURIComponent(songId)}`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { url?: string; id?: string; error?: string };
      if (!res.ok) {
        setClipError(data.error ?? t("song.appearancesUploadImageError"));
        return;
      }
      setVideoClipUrl(data.url ?? null);
      if (data.url && data.id) {
        setClips((prev) => {
          const without = prev.filter((c) => !c.isMyUpload);
          const newClip: VideoClip = {
            id: data.id!,
            imageUrl: data.url!,
            votes: 0,
            uploadedBy: currentUserId!,
            uploaderName: "",
            uploaderHandle: "",
            hasVoted: false,
            isMyChoice: true,
            isMyUpload: true,
          };
          return [newClip, ...without.map((c) => ({ ...c, isMyChoice: false }))];
        });
      }
    } catch {
      setClipError(t("song.appearancesConnErrorRetry"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete() {
    setUploading(true);
    setClipError(null);
    try {
      const myClip = clips.find((c) => c.isMyUpload);
      const res = await fetch(`/api/user/song-video-clip?songId=${encodeURIComponent(songId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setClipError(data.error ?? t("song.appearancesRemoveError"));
        return;
      }
      setVideoClipUrl(null);
      if (myClip) {
        setClips((prev) => prev.filter((c) => c.id !== myClip.id));
      }
    } catch {
      setClipError(t("song.appearancesConnErrorRetry"));
    } finally {
      setUploading(false);
    }
  }

  const handleVote = useCallback(async (clipId: string) => {
    if (!isLoggedIn || votingId) return;
    setVotingId(clipId);
    try {
      const res = await fetch(`/api/songs/${songId}/video-clips/${clipId}/vote`, { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as { votes: number; hasVoted: boolean };
      setClips((prev) =>
        [...prev]
          .map((c) => c.id === clipId ? { ...c, votes: data.votes, hasVoted: data.hasVoted } : c)
          .sort((a, b) => b.votes - a.votes)
      );
    } finally {
      setVotingId(null);
    }
  }, [isLoggedIn, songId, votingId]);

  const handleChoose = useCallback(async (clipId: string) => {
    if (!isLoggedIn || choosingId) return;
    setChoosingId(clipId);
    try {
      const res = await fetch(
        `/api/user/song-video-clip?songId=${encodeURIComponent(songId)}&clipId=${encodeURIComponent(clipId)}`,
        { method: "PUT" }
      );
      if (!res.ok) return;
      setClips((prev) => prev.map((c) => ({ ...c, isMyChoice: c.id === clipId })));
      // also update the clip url shown in header
      const chosen = clips.find((c) => c.id === clipId);
      if (chosen) setVideoClipUrl(chosen.imageUrl);
    } finally {
      setChoosingId(null);
    }
  }, [isLoggedIn, songId, choosingId, clips]);

  const tabs: { id: "mine" | "global" | "video_clip"; label: string; onlyLoggedIn?: boolean }[] = [
    { id: "mine", label: t("song.appearancesTabMine"), onlyLoggedIn: true },
    { id: "global", label: t("song.appearancesTabGlobal") },
    { id: "video_clip", label: t("chart.variantVideoClip") },
  ];

  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ display: "flex", gap: 0, marginBottom: 18, borderBottom: "1px solid var(--divider)" }}>
        {tabs.filter((tabItem) => !tabItem.onlyLoggedIn || isLoggedIn).map((tabItem) => {
          const isActive = activeTab === tabItem.id;
          return (
            <button
              key={tabItem.id}
              onClick={() => setActiveTab(tabItem.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                borderBottom: `2px solid ${isActive ? "#FA243C" : "transparent"}`,
                marginBottom: -1,
              }}
            >
              {tabItem.label}
            </button>
          );
        })}
      </div>

      {showCards && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {cards.map((s) => (
            <div key={s.label} style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", padding: 16 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{s.label}</div>
              <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "global" && (
        <>
          <div style={{ marginTop: 14, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", padding: 16 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{t("song.appearancesPeakGlobal")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 28, fontWeight: 800 }}>
              {globalStats.peak === 1 && <Star size={18} color="#FA243C" fill="#FA243C" />}
              {globalStats.peak === 9999 ? "-" : `#${globalStats.peak}`}
            </div>
          </div>
          {topUsers.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 14 }}>{t("song.appearancesTopUsersHeading")}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
                {topUsers.map((row) => (
                  <Link key={row.user.id} href={`/profile/${row.user.handle}`} style={{ textDecoration: "none" }}>
                    <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--divider)", padding: 14, textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <Avatar
                          user={{ name: row.user.name, avatar: row.user.avatarColor }}
                          imageUrl={row.user.image}
                          size={52}
                        />
                      </div>
                      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.user.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>@{row.user.handle}</div>
                      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: "#FA243C" }}>{t("song.appearancesPts", { points: row.points })}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "mine" && (
        <div style={{ marginTop: 14 }}>
          {!isLoggedIn ? (
            <div style={{ padding: 16, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
              <span style={{ color: "var(--text)", fontWeight: 600 }}>{t("song.appearancesYourChartsHeading")}</span>
              {" - "}
              {t("song.appearancesLoginToSeeDetails")}
            </div>
          ) : myParadaSections.length > 0 ? (
            <>
              {myParadaSections.length > 1 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16, background: "var(--fill-subtle)", borderRadius: 100, padding: 3 }}>
                  {myParadaSections.map((section) => {
                    const isActive = section.paradaId === activeParadaSection?.paradaId;
                    return (
                      <button
                        key={section.paradaId}
                        type="button"
                        onClick={() => setActiveParadaId(section.paradaId)}
                        style={{
                          padding: "7px 14px",
                          borderRadius: 100,
                          border: "none",
                          fontSize: 13,
                          fontWeight: isActive ? 700 : 500,
                          background: isActive ? "var(--surface)" : "transparent",
                          color: isActive ? "var(--text)" : "var(--text-muted)",
                          cursor: "pointer",
                          boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {paradaTabLabel(section, t)}
                        {section.isPrimary ? " ★" : ""}
                      </button>
                    );
                  })}
                </div>
              )}
              {activeParadaSection && activeParadaSection.appearances.length > 0 ? (
                <AppearancesTable rows={activeParadaSection.appearances} />
              ) : (
                <div style={{ padding: 16, background: "var(--fill-inset)", borderRadius: 12, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {t("song.appearancesNotInChartPrefix")}{activeParadaSection?.isPrimary ? t("song.appearancesPrimaryChartLower") : t("song.appearancesSecondaryChartLower")}
                  {activeParadaSection?.paradaName ? ` (${activeParadaSection.paradaName})` : ""}{t("song.appearancesNotInChartSuffix")}
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: 16, background: "var(--fill-inset)", borderRadius: 12, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
              {t("song.appearancesNoChartsAtAll")}
            </div>
          )}
        </div>
      )}

      {activeTab === "video_clip" && (
        <div style={{ marginTop: 14 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          {/* Upload / manage my own clip */}
          {isLoggedIn && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "#FA243C", color: "white", border: "none",
                  padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.6 : 1,
                }}
              >
                <Upload size={15} />
                {uploading ? t("song.appearancesUploadingClip") : clips.some((c) => c.isMyUpload) ? t("song.appearancesChangeMyCapture") : t("song.appearancesUploadMyCapture")}
              </button>
              {clips.some((c) => c.isMyUpload) && !uploading && (
                <button
                  onClick={handleDelete}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: "transparent", color: "var(--text-muted)",
                    border: "1px solid var(--divider)", padding: "10px 14px",
                    borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  <Trash2 size={15} />
                  {t("song.appearancesRemoveMyCapture")}
                </button>
              )}
              {clipError && (
                <span style={{ fontSize: 13, color: "#FA243C", fontWeight: 600 }}>{clipError}</span>
              )}
            </div>
          )}

          {/* Gallery */}
          {clips.length === 0 ? (
            <div style={{ padding: 20, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {t("song.appearancesNoCapturesYet")}{" "}
              {isLoggedIn
                ? t("song.appearancesBeFirstToAdd")
                : t("song.appearancesLoginToUploadCapture")}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
                {t("song.appearancesVoteHint")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {clips.map((clip, idx) => {
                  const isDefault = idx === 0;
                  const isVoting = votingId === clip.id;
                  const isChoosing = choosingId === clip.id;
                  return (
                    <div
                      key={clip.id}
                      style={{
                        background: "var(--surface)",
                        borderRadius: 16,
                        border: `1.5px solid ${clip.isMyChoice ? "#FA243C" : "var(--divider)"}`,
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      {/* Badges */}
                      <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6, zIndex: 2 }}>
                        {isDefault && (
                          <span style={{ background: "#FA243C", color: "white", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, letterSpacing: "0.03em" }}>
                            {t("song.appearancesDefaultBadge")}
                          </span>
                        )}
                        {clip.isMyUpload && (
                          <span style={{ background: "rgba(0,0,0,0.55)", color: "white", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>
                            {t("song.appearancesMyBadge")}
                          </span>
                        )}
                        {clip.isMyChoice && (
                          <span style={{ background: "#34C759", color: "white", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>
                            {t("song.appearancesInUseBadge")}
                          </span>
                        )}
                      </div>

                      {/* Thumbnail */}
                      <div style={{ width: "100%", aspectRatio: "16/9", overflow: "hidden", background: "var(--fill-inset)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={clip.imageUrl}
                          alt={t("song.appearancesCaptureAlt")}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      </div>

                      {/* Footer */}
                      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          @{clip.uploaderHandle}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          {/* Choose button */}
                          {isLoggedIn && !clip.isMyChoice && (
                            <button
                              onClick={() => handleChoose(clip.id)}
                              disabled={!!isChoosing}
                              title={t("song.appearancesUseThisTooltip")}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                fontSize: 12, fontWeight: 700,
                                color: "#FA243C", background: "transparent",
                                border: "1px solid #FA243C", borderRadius: 7,
                                padding: "5px 10px", cursor: isChoosing ? "not-allowed" : "pointer",
                                opacity: isChoosing ? 0.6 : 1,
                              }}
                            >
                              {t("song.appearancesUseThis")}
                            </button>
                          )}
                          {isLoggedIn && clip.isMyChoice && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#34C759" }}>
                              <Check size={13} />
                              {t("song.appearancesInUseBadge")}
                            </span>
                          )}

                          {/* Thumbs up */}
                          <button
                            onClick={() => handleVote(clip.id)}
                            disabled={!isLoggedIn || isVoting}
                            title={isLoggedIn ? (clip.hasVoted ? t("song.appearancesRemoveVoteTooltip") : t("song.appearancesVoteTooltip")) : t("song.appearancesLoginToVoteTooltip")}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              background: clip.hasVoted ? "#FA243C" : "transparent",
                              color: clip.hasVoted ? "white" : "var(--text-muted)",
                              border: `1px solid ${clip.hasVoted ? "#FA243C" : "var(--divider)"}`,
                              borderRadius: 7, padding: "5px 10px",
                              fontSize: 13, fontWeight: 700,
                              cursor: isLoggedIn && !isVoting ? "pointer" : "default",
                              opacity: isVoting ? 0.6 : 1,
                              transition: "background 0.15s, color 0.15s",
                            }}
                          >
                            <ThumbsUp size={13} />
                            {clip.votes}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
