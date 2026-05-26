"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Star, Upload, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { VideoClipCover } from "@/components/ui/VideoClipCover";

type Appearance = {
  chartId: string;
  position: number;
  dateRange: string;
  weekOfYear: number;
  year: number;
};

type UserStats = {
  appearances: number;
  bestPosition: number;
  points: number;
  number1s: number;
};

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

type Props = {
  currentUserId: string | null;
  songId: string;
  myAppearances: Appearance[];
  myStats: UserStats;
  globalStats: GlobalStats;
  topUsers: TopUser[];
  initialVideoClipUrl: string | null;
};

export function SongAppearancesTabs({ currentUserId, songId, myAppearances, myStats, globalStats, topUsers, initialVideoClipUrl }: Props) {
  const isLoggedIn = !!currentUserId;
  const [activeTab, setActiveTab] = useState<"mine" | "global" | "video_clip">(isLoggedIn ? "mine" : "global");
  const [videoClipUrl, setVideoClipUrl] = useState<string | null>(initialVideoClipUrl);
  const [uploading, setUploading] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userCards: { label: string; value: string | number }[] = [
    { label: "Semanas na parada", value: myStats.appearances },
    { label: "Melhor posição", value: myStats.bestPosition === 9999 ? "—" : `#${myStats.bestPosition}` },
    { label: "Seus pontos", value: myStats.points },
    { label: "#1s seus", value: myStats.number1s },
  ];

  const globalCards: { label: string; value: string | number }[] = [
    { label: "Pontos totais", value: globalStats.totalPoints },
    { label: "Usuários únicos", value: globalStats.uniqueUsers },
    { label: "Semanas no Top 100", value: globalStats.weeksTop100 },
    { label: "#1s no Top 100", value: globalStats.number1s },
  ];

  const cards = activeTab === "mine" && isLoggedIn ? userCards : globalCards;
  const showCards = activeTab !== "video_clip" && (activeTab === "global" || isLoggedIn);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setClipError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/user/song-video-clip?songId=${encodeURIComponent(songId)}`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setClipError(data.error ?? "Erro ao enviar a imagem.");
        return;
      }
      setVideoClipUrl(data.url ?? null);
    } catch {
      setClipError("Erro de conexão. Tente novamente.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete() {
    setUploading(true);
    setClipError(null);
    try {
      const res = await fetch(`/api/user/song-video-clip?songId=${encodeURIComponent(songId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setClipError(data.error ?? "Erro ao remover.");
        return;
      }
      setVideoClipUrl(null);
    } catch {
      setClipError("Erro de conexão. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }

  const tabs: { id: "mine" | "global" | "video_clip"; label: string; onlyLoggedIn?: boolean }[] = [
    { id: "mine", label: "Nas suas paradas", onlyLoggedIn: true },
    { id: "global", label: "Global" },
    { id: "video_clip", label: "Vídeo Clipe", onlyLoggedIn: true },
  ];

  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ display: "flex", gap: 0, marginBottom: 18, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        {tabs.filter((t) => !t.onlyLoggedIn || isLoggedIn).map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "#FA243C" : "#86868B",
                borderBottom: `2px solid ${isActive ? "#FA243C" : "transparent"}`,
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {showCards && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {cards.map((s) => (
            <div key={s.label} style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", padding: 16 }}>
              <div style={{ fontSize: 11, color: "#86868B", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{s.label}</div>
              <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "global" && (
        <>
          <div style={{ marginTop: 14, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", padding: 16 }}>
            <div style={{ fontSize: 12, color: "#86868B", marginBottom: 6 }}>Pico no Global Top 100</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 28, fontWeight: 800 }}>
              {globalStats.peak === 1 && <Star size={18} color="#FA243C" fill="#FA243C" />}
              {globalStats.peak === 9999 ? "—" : `#${globalStats.peak}`}
            </div>
          </div>
          {topUsers.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 14 }}>Top 5 usuários da música</h2>
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
                      <div style={{ fontSize: 12, color: "#86868B" }}>@{row.user.handle}</div>
                      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: "#FA243C" }}>{row.points} pts</div>
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
              <span style={{ color: "var(--text)", fontWeight: 600 }}>Suas paradas com esta música</span>
              {" — "}
              entre na sua conta para ver posição, datas e ano em cada semana em que você publicou esta faixa.
            </div>
          ) : myAppearances.length > 0 ? (
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
                {(["Pos", "Semana", "Semana do ano", "Ano", ""] as const).map((h, i) => (
                  <div key={i} style={{ padding: "10px 8px", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B" }}>
                    {h}
                  </div>
                ))}
              </div>
              {myAppearances.map((row, i) => {
                const last = i === myAppearances.length - 1;
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
                    <div style={{ fontSize: 13, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
                      Sem. {row.weekOfYear}
                    </div>
                    <div style={{ fontSize: 13, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
                      {row.year}
                    </div>
                    <div style={{ padding: "0 8px" }}>
                      <Link href={`/chart/${row.chartId}`} style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", textDecoration: "none" }}>
                        Ver parada →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 16, background: "rgba(0,0,0,0.04)", borderRadius: 12, fontSize: 14, color: "#86868B", lineHeight: 1.5 }}>
              Esta música ainda não aparece em nenhuma das suas paradas publicadas. Quando você votar com ela, aparecerá aqui a posição, a data e o ano de cada semana.
            </div>
          )}
        </div>
      )}

      {activeTab === "video_clip" && isLoggedIn && (
        <div style={{ marginTop: 14 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
            <VideoClipCover
              imageUrl={videoClipUrl}
              width={320}
              style={{ borderRadius: 12 }}
            />
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Esta imagem será exibida na sua parada quando alguém visualizá-la em modo <strong>Vídeo Clipe</strong>. Formato ideal: 16:9 (ex.: 1280×720).
            </div>
            {clipError && (
              <div style={{ fontSize: 13, color: "#FA243C", fontWeight: 600 }}>{clipError}</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
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
                {uploading ? "Enviando…" : videoClipUrl ? "Trocar captura" : "Enviar captura"}
              </button>
              {videoClipUrl && !uploading && (
                <button
                  onClick={handleDelete}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: "transparent", color: "#86868B",
                    border: "1px solid var(--divider)", padding: "10px 14px",
                    borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  <Trash2 size={15} />
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
