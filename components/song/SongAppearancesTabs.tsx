"use client";

import { useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

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
  myAppearances: Appearance[];
  myStats: UserStats;
  globalStats: GlobalStats;
  topUsers: TopUser[];
};

export function SongAppearancesTabs({ currentUserId, myAppearances, myStats, globalStats, topUsers }: Props) {
  const isLoggedIn = !!currentUserId;
  const [activeTab, setActiveTab] = useState<"mine" | "global">(isLoggedIn ? "mine" : "global");

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
  const showCards = activeTab === "global" || isLoggedIn;

  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ display: "flex", gap: 0, marginBottom: 18, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        {(["mine", "global"] as const).map((tab) => {
          const label = tab === "mine" ? "Nas suas paradas" : "Global";
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
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
              {label}
            </button>
          );
        })}
      </div>

      {showCards && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {cards.map((s) => (
            <div key={s.label} style={{ background: "white", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", padding: 16 }}>
              <div style={{ fontSize: 11, color: "#86868B", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{s.label}</div>
              <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "global" && (
        <>
          <div style={{ marginTop: 14, background: "white", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", padding: 16 }}>
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
                    <div style={{ background: "white", borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)", padding: 14, textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <Avatar
                          user={{ name: row.user.name, avatar: row.user.avatarColor }}
                          imageUrl={row.user.image}
                          size={52}
                        />
                      </div>
                      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: "#1D1D1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
            <div style={{ padding: 16, background: "white", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", fontSize: 14, color: "#86868B", lineHeight: 1.5 }}>
              <span style={{ color: "#1D1D1F", fontWeight: 600 }}>Suas paradas com esta música</span>
              {" — "}
              entre na sua conta para ver posição, datas e ano em cada semana em que você publicou esta faixa.
            </div>
          ) : myAppearances.length > 0 ? (
            <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px minmax(0,1fr) 110px 70px 110px",
                  padding: "0 20px",
                  background: "rgba(0,0,0,0.02)",
                  borderBottom: "1px solid rgba(0,0,0,0.06)",
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
                        color: "#000",
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "right",
                        paddingRight: 12,
                      }}
                    >
                      {row.position}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1D1D1F", padding: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
    </div>
  );
}
