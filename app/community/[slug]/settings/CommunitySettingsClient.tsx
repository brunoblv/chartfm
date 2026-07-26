"use client";

import { ChangeEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Palette, Trophy, Users2 } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { CommunityHeader, type CommunityHeaderData } from "@/components/community/CommunityHeader";
import { Avatar } from "@/components/ui/Avatar";
import { calcularPontosPrimary } from "@/lib/parada-points";
import {
  COMMUNITY_COVER_SIZE_LABEL,
  readImageFileAsDataUrl,
  validateCommunityCoverFile,
} from "@/lib/community-cover";
import { communityRequiresMusicVideo } from "@/lib/community-song-rules";
import { useTranslations } from "@/hooks/useTranslations";

const CHART_SIZE_OPTIONS = [10, 15, 20, 25, 30, 40, 50, 75, 100] as const;

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: { id: string; handle: string; name: string; avatarColor: string; image: string | null };
};

type SettingsData = {
  paradaName: string;
  maxSongs: number;
  memberPositionLimit: number | null;
  pointsMode: string;
  customPoints: number[] | null;
  name: string;
  tagline: string;
  logoUrl: string | null;
  coverA: string;
  coverB: string;
  coverImageUrl: string | null;
  icon: string;
  privacy: "public" | "private";
  members: MemberRow[];
};

type Section = "identity" | "parada" | "members";

const SECTIONS: { key: Section; labelKey: string; icon: typeof Palette }[] = [
  { key: "identity", labelKey: "settingsSectionIdentity", icon: Palette },
  { key: "parada", labelKey: "settingsSectionParada", icon: Trophy },
  { key: "members", labelKey: "settingsSectionMembers", icon: Users2 },
];

export function CommunitySettingsClient({
  community,
  initial,
}: {
  community: CommunityHeaderData;
  initial: SettingsData;
}) {
  const router = useRouter();
  const { t } = useTranslations();
  const fileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState<Section>("identity");
  const [paradaName, setParadaName] = useState(initial.paradaName);
  const [maxSongs, setMaxSongs] = useState(initial.maxSongs);
  const [useLimit, setUseLimit] = useState(initial.memberPositionLimit != null);
  const [memberPositionLimit, setMemberPositionLimit] = useState(initial.memberPositionLimit ?? 20);
  const [pointsMode, setPointsMode] = useState<"member" | "custom">(
    initial.pointsMode === "custom" ? "custom" : "member",
  );
  const [customPoints, setCustomPoints] = useState<number[]>(
    initial.customPoints?.length
      ? initial.customPoints
      : Array.from({ length: maxSongs }, (_, i) => calcularPontosPrimary(i + 1)),
  );
  const [name, setName] = useState(initial.name);
  const [tagline, setTagline] = useState(initial.tagline);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [coverA, setCoverA] = useState(initial.coverA);
  const [coverB, setCoverB] = useState(initial.coverB);
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl);
  const [coverWarning, setCoverWarning] = useState<string | null>(null);
  const [icon, setIcon] = useState(initial.icon);
  const [privacy, setPrivacy] = useState<"public" | "private">(initial.privacy);
  const [members, setMembers] = useState(initial.members);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function resizeCustomPoints(size: number) {
    setCustomPoints((prev) => {
      const next = [...prev];
      while (next.length < size) {
        next.push(calcularPontosPrimary(next.length + 1));
      }
      return next.slice(0, size);
    });
  }

  function onMaxSongsChange(size: number) {
    setMaxSongs(size);
    resizeCustomPoints(size);
  }

  async function saveSettings() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/communities/${encodeURIComponent(community.slug)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paradaName: paradaName.trim(),
          maxSongs,
          memberPositionLimit: useLimit ? memberPositionLimit : null,
          pointsMode,
          customPoints: pointsMode === "custom" ? customPoints : null,
          name: name.trim(),
          tagline: tagline.trim(),
          logoUrl,
          coverImageUrl,
          coverA,
          coverB,
          icon,
          privacy,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("communities.settingsSaveError"));
        return;
      }
      setSuccess(t("communities.settingsSaveSuccess"));
      router.refresh();
    } catch {
      setError(t("communities.settingsNetworkError"));
    } finally {
      setSaving(false);
    }
  }

  async function onCoverFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverWarning(null);
    setError(null);
    const result = await validateCommunityCoverFile(file);
    if (result.error === "not_image") {
      setError(t("communities.settingsCoverNotImage"));
      return;
    }
    if (result.error === "too_large") {
      setError(t("communities.settingsCoverTooLarge"));
      return;
    }
    if (result.warning === "aspect") {
      setCoverWarning(
        t("communities.settingsCoverAspectWarning", {
          size: COMMUNITY_COVER_SIZE_LABEL,
          width: result.width,
          height: result.height,
        }),
      );
    }
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setCoverImageUrl(dataUrl);
    } catch {
      setError(t("communities.settingsCoverReadError"));
    }
  }

  async function onLogoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 1 * 1024 * 1024) {
      setError(t("communities.postImageTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(String(reader.result ?? ""));
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function promoteMember(userId: string) {
    const res = await fetch(`/api/communities/${encodeURIComponent(community.slug)}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promoteUserId: userId }),
    });
    if (!res.ok) return;
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, role: "admin" } : m)),
    );
  }

  async function demoteMember(userId: string) {
    const res = await fetch(`/api/communities/${encodeURIComponent(community.slug)}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demoteUserId: userId }),
    });
    if (!res.ok) return;
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, role: "member" } : m)),
    );
  }

  const fieldLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--divider)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    background: "var(--fill-inset)",
    color: "var(--text)",
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--surface)",
    borderRadius: 16,
    border: "1px solid var(--divider)",
    padding: 20,
  };

  const saveBtnStyle: React.CSSProperties = {
    background: "var(--accent)",
    color: "white",
    border: "none",
    padding: "10px 22px",
    borderRadius: 100,
    fontSize: 14,
    fontWeight: 700,
    cursor: saving ? "wait" : "pointer",
    opacity: saving ? 0.75 : 1,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };

  const headerPreview: CommunityHeaderData = {
    ...community,
    name,
    tagline,
    cover: [coverA, coverB],
    coverImageUrl,
    logoUrl,
    icon,
    paradaName,
  };

  return (
    <Shell title="" noPadding>
      <CommunityHeader community={headerPreview} activeTab="parada" />

      <div
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--divider)",
          padding: "0 clamp(16px, 4vw, 40px)",
          position: "sticky",
          top: 0,
          zIndex: 30,
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, height: 52 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, fontSize: 14 }}>
            <span style={{ fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            <span style={{ color: "var(--divider-strong)" }}>/</span>
            <span style={{ color: "var(--text-muted)" }}>{t("communities.settingsBreadcrumb")}</span>
          </div>
          <button type="button" onClick={() => void saveSettings()} disabled={saving} style={saveBtnStyle}>
            {saving ? t("settings.saving") : t("settings.saveChanges")}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px clamp(16px, 4vw, 40px) 64px", display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ width: 192, flexShrink: 0, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", padding: 8, position: "sticky", top: 64 }}>
          {SECTIONS.map((sec) => {
            const active = activeSection === sec.key;
            const Icon = sec.icon;
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => setActiveSection(sec.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: active ? "var(--accent-tint)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-subtle)",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  fontFamily: "inherit",
                  fontWeight: active ? 700 : 500,
                  fontSize: 14,
                  letterSpacing: "-0.01em",
                  marginBottom: 2,
                }}
              >
                <Icon size={15} />
                <span>{t(`communities.${sec.labelKey}`)}</span>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {activeSection === "identity" && (
            <>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text)" }}>{t("communities.settingsIdentityTitle")}</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{t("communities.settingsIdentitySubtitle")}</div>
              </div>

              <div style={cardStyle}>
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <div style={fieldLabel}>{t("communities.createNameLabel")}</div>
                    <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <div style={fieldLabel}>{t("communities.settingsDescriptionLabel")}</div>
                    <input value={tagline} onChange={(e) => setTagline(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <div style={fieldLabel}>{t("communities.settingsParadaNameLabel")}</div>
                    <input value={paradaName} onChange={(e) => setParadaName(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <div style={fieldLabel}>{t("communities.createPrivacyLabel")}</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {(["public", "private"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPrivacy(p)}
                          style={{
                            flex: 1,
                            minWidth: 160,
                            padding: "12px 14px",
                            borderRadius: 12,
                            textAlign: "left",
                            border: `1.5px solid ${privacy === p ? "var(--accent)" : "var(--divider)"}`,
                            background: privacy === p ? "var(--accent-tint)" : "var(--fill-inset)",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
                            {p === "public" ? t("communities.settingsPublicLabel") : t("communities.settingsPrivateLabel")}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                            {p === "public" ? t("communities.createPublicDesc") : t("communities.createPrivateDesc")}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 16, color: "var(--text)" }}>{t("communities.settingsAppearanceTitle")}</div>
                <div style={{ marginBottom: 18 }}>
                  <div style={fieldLabel}>{t("communities.settingsCoverLabel")}</div>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 10px 0", lineHeight: 1.55 }}>
                    {t("communities.settingsCoverHint", { size: COMMUNITY_COVER_SIZE_LABEL })}
                  </p>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 600,
                      aspectRatio: "15 / 4",
                      borderRadius: 14,
                      overflow: "hidden",
                      border: "1px solid var(--divider)",
                      marginBottom: 12,
                      background: `linear-gradient(135deg, ${coverA}, ${coverB})`,
                      position: "relative",
                    }}
                  >
                    {coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverImageUrl}
                        alt={t("communities.settingsCoverPreviewAlt")}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: 13,
                          fontWeight: 600,
                          opacity: 0.85,
                        }}
                      >
                        {COMMUNITY_COVER_SIZE_LABEL}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => coverFileRef.current?.click()}
                      style={{
                        border: "1px solid var(--divider)",
                        borderRadius: 10,
                        padding: "8px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        background: "var(--surface)",
                        color: "var(--text)",
                        fontFamily: "inherit",
                      }}
                    >
                      {t("communities.settingsUploadCover")}
                    </button>
                    {coverImageUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setCoverImageUrl(null);
                          setCoverWarning(null);
                        }}
                        style={{ fontSize: 13, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        {t("communities.settingsRemoveCover")}
                      </button>
                    )}
                    <input ref={coverFileRef} type="file" accept="image/*" onChange={(e) => void onCoverFile(e)} style={{ display: "none" }} />
                  </div>
                  {coverWarning && (
                    <p style={{ fontSize: 12, color: "#B45309", margin: "8px 0 0 0", lineHeight: 1.5 }}>{coverWarning}</p>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 18 }}>
                  <div>
                    <div style={fieldLabel}>{t("communities.settingsIconLabel")}</div>
                    <input value={icon} onChange={(e) => setIcon(e.target.value)} style={inputStyle} maxLength={8} />
                  </div>
                  <div>
                    <div style={fieldLabel}>{t("communities.settingsColorALabel")}</div>
                    <input type="color" value={coverA} onChange={(e) => setCoverA(e.target.value)} style={{ ...inputStyle, padding: 4, height: 42 }} />
                  </div>
                  <div>
                    <div style={fieldLabel}>{t("communities.settingsColorBLabel")}</div>
                    <input type="color" value={coverB} onChange={(e) => setCoverB(e.target.value)} style={{ ...inputStyle, padding: 4, height: 42 }} />
                  </div>
                </div>

                <div>
                  <div style={fieldLabel}>{t("communities.settingsLogoLabel")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 14,
                        background: `linear-gradient(135deg, ${coverA}, ${coverB})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 28,
                        overflow: "hidden",
                      }}
                    >
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        icon
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      style={{
                        border: "1px solid var(--divider)",
                        borderRadius: 10,
                        padding: "8px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        background: "var(--surface)",
                        color: "var(--text)",
                        fontFamily: "inherit",
                      }}
                    >
                      {t("communities.settingsUploadImage")}
                    </button>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl(null)}
                        style={{ fontSize: 13, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        {t("communities.settingsRemove")}
                      </button>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" onChange={onLogoFile} style={{ display: "none" }} />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeSection === "parada" && (
            <>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text)" }}>{t("communities.settingsSectionParada")}</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{t("communities.settingsParadaSubtitle")}</div>
              </div>

              <div style={cardStyle}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4, color: "var(--text)" }}>{t("communities.settingsRankingSizeTitle")}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>{t("communities.settingsRankingSizeDesc")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {CHART_SIZE_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onMaxSongsChange(n)}
                      style={{
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 14px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        background: maxSongs === n ? "var(--text)" : "var(--fill-subtle)",
                        color: maxSongs === n ? "var(--bg)" : "var(--text)",
                      }}
                    >
                      {t("communities.settingsTopN", { count: n })}
                    </button>
                  ))}
                </div>
              </div>

              {communityRequiresMusicVideo(community.slug) && (
                <div style={cardStyle}>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4, color: "var(--text)" }}>
                    {t("communities.settingsMusicVideoRuleTitle")}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.45 }}>
                    {t("communities.settingsMusicVideoRuleDesc")}
                  </div>
                </div>
              )}

              <div style={cardStyle}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4, color: "var(--text)" }}>{t("communities.settingsPointsModeTitle")}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{t("communities.settingsPointsModeDesc")}</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setPointsMode("member")}
                    style={{
                      flex: 1,
                      minWidth: 180,
                      padding: "12px 14px",
                      borderRadius: 12,
                      textAlign: "left",
                      border: `1.5px solid ${pointsMode === "member" ? "var(--accent)" : "var(--divider)"}`,
                      background: pointsMode === "member" ? "var(--accent-tint)" : "var(--fill-inset)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{t("communities.settingsPointsModeChartTitle")}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>{t("communities.settingsPointsModeChartDesc")}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPointsMode("custom")}
                    style={{
                      flex: 1,
                      minWidth: 180,
                      padding: "12px 14px",
                      borderRadius: 12,
                      textAlign: "left",
                      border: `1.5px solid ${pointsMode === "custom" ? "var(--accent)" : "var(--divider)"}`,
                      background: pointsMode === "custom" ? "var(--accent-tint)" : "var(--fill-inset)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{t("communities.settingsPointsModeCustomTitle")}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>{t("communities.settingsPointsModeCustomDesc")}</div>
                  </button>
                </div>

                <div style={{ borderTop: "1px solid var(--divider)", paddingTop: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, color: "var(--text)", fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={useLimit}
                      onChange={(e) => setUseLimit(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    <span>{t("communities.settingsLimitPositionsLabel")}</span>
                  </label>
                  {useLimit && (
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, paddingLeft: 26, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, color: "var(--text-subtle)" }}>{t("communities.settingsCountFirstPrefix")}</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={memberPositionLimit}
                        onChange={(e) => setMemberPositionLimit(Number(e.target.value))}
                        style={{ ...inputStyle, width: 76, textAlign: "center" }}
                      />
                      <span style={{ fontSize: 14, color: "var(--text-subtle)" }}>{t("communities.settingsCountFirstSuffix")}</span>
                    </div>
                  )}
                </div>
              </div>

              {pointsMode === "custom" && (
                <div style={cardStyle}>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4, color: "var(--text)" }}>{t("communities.settingsPointsPerPositionTitle")}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{t("communities.settingsPointsPerPositionDesc")}</div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                      gap: 8,
                      maxHeight: 320,
                      overflowY: "auto",
                      padding: 12,
                      background: "var(--fill-inset)",
                      borderRadius: 12,
                      border: "1px solid var(--divider-soft)",
                    }}
                  >
                    {customPoints.slice(0, maxSongs).map((pts, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textAlign: "center" }}>#{i + 1}</div>
                        <input
                          type="number"
                          min={0}
                          value={pts}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value) || 0);
                            setCustomPoints((prev) => {
                              const next = [...prev];
                              next[i] = v;
                              return next;
                            });
                          }}
                          style={{ ...inputStyle, padding: "6px 8px", fontSize: 13, textAlign: "center", background: "var(--surface)" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeSection === "members" && (
            <>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text)" }}>{t("communities.settingsSectionMembers")}</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{t("communities.settingsMembersSubtitle")}</div>
              </div>

              <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", overflow: "hidden" }}>
                {members.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--divider-soft)",
                    }}
                  >
                    <Avatar user={{ name: m.user.name, avatar: m.user.avatarColor }} imageUrl={m.user.image} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{m.user.name}</div>
                      <Link href={`/profile/${m.user.handle}`} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
                        @{m.user.handle}
                      </Link>
                    </div>
                    <span
                      style={{
                        background: m.role === "owner" ? "var(--accent-tint)" : m.role === "admin" ? "rgba(59,130,246,0.1)" : "var(--fill-subtle)",
                        color: m.role === "owner" ? "var(--accent)" : m.role === "admin" ? "#3B82F6" : "var(--text-subtle)",
                        borderRadius: 100,
                        padding: "3px 10px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {m.role === "owner" ? t("communities.roleOwner") : m.role === "admin" ? t("communities.roleAdmin") : t("communities.roleMember")}
                    </span>
                    {m.role === "member" && (
                      <button
                        type="button"
                        onClick={() => void promoteMember(m.userId)}
                        style={{
                          border: "none",
                          background: "var(--text)",
                          color: "var(--bg)",
                          borderRadius: 8,
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t("communities.settingsPromote")}
                      </button>
                    )}
                    {m.role === "admin" && (
                      <button
                        type="button"
                        onClick={() => void demoteMember(m.userId)}
                        style={{
                          border: "none",
                          background: "var(--fill-subtle)",
                          color: "var(--text)",
                          borderRadius: 8,
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t("communities.settingsDemote")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ marginTop: 8, paddingTop: 20, borderTop: "1px solid var(--divider)", display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" onClick={() => void saveSettings()} disabled={saving} style={saveBtnStyle}>
              {saving ? t("settings.saving") : t("communities.settingsSaveConfig")}
            </button>
            {error && <span style={{ fontSize: 13, color: "#DC2626" }}>{error}</span>}
            {success && <span style={{ fontSize: 13, color: "#16A34A" }}>{success}</span>}
          </div>
        </div>
      </div>
    </Shell>
  );
}
