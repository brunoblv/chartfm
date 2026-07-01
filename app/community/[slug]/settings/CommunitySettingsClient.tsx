"use client";

import { ChangeEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { CommunityHeader, type CommunityHeaderData } from "@/components/community/CommunityHeader";
import { Avatar } from "@/components/ui/Avatar";
import { calcularPontosPrimary } from "@/lib/parada-points";
import {
  COMMUNITY_COVER_SIZE_LABEL,
  communityCoverSizeHint,
  readImageFileAsDataUrl,
  validateCommunityCoverFile,
} from "@/lib/community-cover";

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
  members: MemberRow[];
};

export function CommunitySettingsClient({
  community,
  initial,
}: {
  community: CommunityHeaderData;
  initial: SettingsData;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
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
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar.");
        return;
      }
      setSuccess("Configurações salvas.");
      router.refresh();
    } catch {
      setError("Erro de rede.");
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
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.warning) setCoverWarning(result.warning);
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setCoverImageUrl(dataUrl);
    } catch {
      setError("Não foi possível ler a imagem da capa.");
    }
  }

  async function onLogoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 1 * 1024 * 1024) {
      setError("Imagem muito grande (máx. 1 MB).");
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
    fontSize: 12,
    fontWeight: 700,
    color: "#86868B",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
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
      <div style={{ padding: "28px 40px 80px 40px", maxWidth: 720 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Configurações da comunidade</h2>
        <p style={{ fontSize: 14, color: "#86868B", marginBottom: 28, lineHeight: 1.6 }}>
          Personalize a parada coletiva, aparência e administradores.
        </p>

        <section style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Identidade</h3>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={fieldLabel}>Nome da comunidade</div>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={fieldLabel}>Descrição</div>
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={fieldLabel}>Nome da parada</div>
              <input value={paradaName} onChange={(e) => setParadaName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={fieldLabel}>Capa do header</div>
              <p style={{ fontSize: 13, color: "#86868B", margin: "0 0 10px 0", lineHeight: 1.55 }}>
                {communityCoverSizeHint()}
              </p>
              <div
                style={{
                  width: "100%",
                  maxWidth: 600,
                  aspectRatio: "15 / 4",
                  borderRadius: 14,
                  overflow: "hidden",
                  border: "1px solid rgba(0,0,0,0.1)",
                  marginBottom: 12,
                  background: `linear-gradient(135deg, ${coverA}, ${coverB})`,
                  position: "relative",
                }}
              >
                {coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverImageUrl}
                    alt="Prévia da capa"
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
                    border: "1px solid rgba(0,0,0,0.12)",
                    borderRadius: 10,
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: "white",
                  }}
                >
                  Enviar capa
                </button>
                {coverImageUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImageUrl(null);
                      setCoverWarning(null);
                    }}
                    style={{ fontSize: 13, color: "#86868B", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Remover capa
                  </button>
                )}
                <input ref={coverFileRef} type="file" accept="image/*" onChange={(e) => void onCoverFile(e)} style={{ display: "none" }} />
              </div>
              {coverWarning && (
                <p style={{ fontSize: 12, color: "#B45309", margin: "8px 0 0 0", lineHeight: 1.5 }}>{coverWarning}</p>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <div style={fieldLabel}>Ícone</div>
                <input value={icon} onChange={(e) => setIcon(e.target.value)} style={inputStyle} maxLength={8} />
              </div>
              <div>
                <div style={fieldLabel}>Cor A (fallback)</div>
                <input type="color" value={coverA} onChange={(e) => setCoverA(e.target.value)} style={{ ...inputStyle, padding: 4, height: 42 }} />
              </div>
              <div>
                <div style={fieldLabel}>Cor B (fallback)</div>
                <input type="color" value={coverB} onChange={(e) => setCoverB(e.target.value)} style={{ ...inputStyle, padding: 4, height: 42 }} />
              </div>
            </div>
            <div>
              <div style={fieldLabel}>Logo</div>
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
                    border: "1px solid rgba(0,0,0,0.12)",
                    borderRadius: 10,
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: "white",
                  }}
                >
                  Enviar imagem
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    style={{ fontSize: 13, color: "#86868B", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Remover
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={onLogoFile} style={{ display: "none" }} />
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Parada coletiva</h3>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={fieldLabel}>Posições no ranking da comunidade</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CHART_SIZE_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onMaxSongsChange(n)}
                    style={{
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: maxSongs === n ? "#1D1D1F" : "rgba(0,0,0,0.06)",
                      color: maxSongs === n ? "white" : "#1D1D1F",
                    }}
                  >
                    Top {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={fieldLabel}>Contagem de pontos dos membros</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => setPointsMode("member")}
                  style={{
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: pointsMode === "member" ? "#1D1D1F" : "rgba(0,0,0,0.06)",
                    color: pointsMode === "member" ? "white" : "#1D1D1F",
                  }}
                >
                  Pontos da parada do membro
                </button>
                <button
                  type="button"
                  onClick={() => setPointsMode("custom")}
                  style={{
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: pointsMode === "custom" ? "#1D1D1F" : "rgba(0,0,0,0.06)",
                    color: pointsMode === "custom" ? "white" : "#1D1D1F",
                  }}
                >
                  Pontos personalizados
                </button>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={useLimit}
                  onChange={(e) => setUseLimit(e.target.checked)}
                />
                Limitar posições contadas de cada membro
              </label>
              {useLimit && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 14 }}>Contar apenas as</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={memberPositionLimit}
                    onChange={(e) => setMemberPositionLimit(Number(e.target.value))}
                    style={{ ...inputStyle, width: 72 }}
                  />
                  <span style={{ fontSize: 14 }}>primeiras posições</span>
                </div>
              )}
            </div>

            {pointsMode === "custom" && (
              <div>
                <div style={fieldLabel}>Pontos por posição</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                    gap: 8,
                    maxHeight: 280,
                    overflowY: "auto",
                    padding: 12,
                    background: "rgba(0,0,0,0.02)",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  {customPoints.slice(0, maxSongs).map((pts, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 11, color: "#86868B", marginBottom: 4 }}>#{i + 1}</div>
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
                        style={{ ...inputStyle, padding: "6px 8px", fontSize: 13 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Administradores</h3>
          <div style={{ background: "white", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                }}
              >
                <Avatar user={{ name: m.user.name, avatar: m.user.avatarColor }} imageUrl={m.user.image} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.user.name}</div>
                  <Link href={`/profile/${m.user.handle}`} style={{ fontSize: 12, color: "#86868B", textDecoration: "none" }}>
                    @{m.user.handle}
                  </Link>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B", textTransform: "capitalize" }}>
                  {m.role === "owner" ? "Dono" : m.role === "admin" ? "Admin" : "Membro"}
                </span>
                {m.role === "member" && (
                  <button
                    type="button"
                    onClick={() => void promoteMember(m.userId)}
                    style={{
                      border: "none",
                      background: "#1D1D1F",
                      color: "white",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Tornar admin
                  </button>
                )}
                {m.role === "admin" && (
                  <button
                    type="button"
                    onClick={() => void demoteMember(m.userId)}
                    style={{
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "white",
                      color: "#1D1D1F",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Remover admin
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {error && <div style={{ color: "#DC2626", fontSize: 14, marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ color: "#16A34A", fontSize: 14, marginBottom: 12 }}>{success}</div>}

        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          style={{
            background: community.cover[0],
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.75 : 1,
          }}
        >
          {saving ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>
    </Shell>
  );
}
