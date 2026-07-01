"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Shell } from "@/components/layout/Shell";
import { ParadaDetailTabs } from "@/components/paradas/ParadaDetailTabs";
import { ParadaEditPanel } from "@/components/paradas/ParadaEditPanel";
import { ParadaLogo, PARADA_HERO_LOGO_SIZE } from "@/components/paradas/ParadaLogo";
import {
  aggregateArtists,
  countDistinctNumberOnes,
} from "@/lib/profile-parada-aggregates";
import { paradaGradientStyle, paradaPalette } from "@/lib/parada-palette";
import { PAGE_GUTTER_X } from "@/lib/page-layout";
import type { ParadaScoringTier } from "@/lib/parada-points";
import type { UserWithCharts } from "@/lib/types";
import { useIsMobile } from "@/hooks/useIsMobile";

type ParadaInfo = {
  id: string;
  name: string;
  logo: string | null;
  genres: string[];
  isPrimary: boolean;
  sortOrder: number;
  cadence?: "weekly" | "daily";
  chartSize?: number | null;
};

type ApiProfile = {
  user: UserWithCharts;
  paradas?: ParadaInfo[];
  activeParadaId?: string | null;
  scoringTier?: ParadaScoringTier;
  totalCharts?: number;
  statsSummary?: { totalRankedSlots: number; numberOnes: number };
  artistImages?: Record<string, string | null>;
};

export default function ParadaDetailPage() {
  const params = useParams();
  const rawHandle = params?.handle;
  const rawParadaId = params?.paradaId;
  const handle = decodeURIComponent(
    typeof rawHandle === "string" ? rawHandle : Array.isArray(rawHandle) ? rawHandle[0] : "",
  );
  const paradaId = decodeURIComponent(
    typeof rawParadaId === "string" ? rawParadaId : Array.isArray(rawParadaId) ? rawParadaId[0] : "",
  );

  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const gutterX = isMobile ? PAGE_GUTTER_X.mobile : PAGE_GUTTER_X.desktop;

  const [phase, setPhase] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [payload, setPayload] = useState<ApiProfile | null>(null);
  const [fullPayload, setFullPayload] = useState<ApiProfile | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [paradaMeta, setParadaMeta] = useState<ParadaInfo | null>(null);

  useEffect(() => {
    if (!handle || !paradaId) {
      setPhase("missing");
      return;
    }
    let cancelled = false;
    setPhase("loading");
    setFullPayload(null);
    (async () => {
      try {
        const q = new URLSearchParams({ mode: "summary", page: "1", perPage: "12", paradaId });
        const res = await fetch(`/api/profile/${encodeURIComponent(handle)}?${q}`);
        if (cancelled) return;
        if (!res.ok) {
          setPhase(res.status === 404 ? "missing" : "error");
          return;
        }
        const data = (await res.json()) as ApiProfile;
        const parada = data.paradas?.find((p) => p.id === paradaId) ?? null;
        if (!parada) {
          setPhase("missing");
          return;
        }
        setPayload(data);
        setParadaMeta(parada);
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, paradaId]);

  useEffect(() => {
    if (!handle || !paradaId || phase !== "ready") return;
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams({ mode: "full", paradaId });
        const res = await fetch(`/api/profile/${encodeURIComponent(handle)}?${q}`);
        if (!res.ok || cancelled) return;
        setFullPayload((await res.json()) as ApiProfile);
      } catch {
        // stats tabs fallback to summary data
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, paradaId, phase]);

  const isOwn = session?.user?.handle === handle;
  const parada = paradaMeta;
  const statsUser = fullPayload?.user ?? payload?.user ?? null;
  const scoringTier: ParadaScoringTier =
    fullPayload?.scoringTier ?? payload?.scoringTier ?? "primary";
  const cadence = parada?.cadence;
  const isDaily = cadence === "daily";

  const totalCharts = payload?.totalCharts ?? statsUser?.charts.length ?? 0;
  const totalRanked =
    fullPayload?.statsSummary?.totalRankedSlots ??
    payload?.statsSummary?.totalRankedSlots ??
    statsUser?.charts.reduce((acc, c) => acc + c.entries.length, 0) ??
    0;
  const numberOnes = statsUser
    ? countDistinctNumberOnes(statsUser.charts)
    : (payload?.statsSummary?.numberOnes ?? 0);

  const uniqueArtists = useMemo(() => {
    if (!statsUser?.charts.length) return 0;
    const sorted = [...statsUser.charts].sort((a, b) => a.week - b.week);
    const latest = sorted[sorted.length - 1]?.week;
    if (latest == null) return 0;
    const previous = sorted.filter((c) => c.week < latest);
    return aggregateArtists(sorted, previous, scoringTier, cadence).length;
  }, [statsUser, scoringTier, cadence]);

  const latestChart = statsUser?.charts[0] ?? null;
  const listHref = `/profile/${encodeURIComponent(handle)}/paradas`;
  const paletteSort = parada?.sortOrder ?? 0;

  if (phase === "loading") {
    return (
      <Shell hideGlobalFooter noPadding>
        <div style={{ padding: gutterX, color: "var(--text-muted)" }}>Carregando parada…</div>
      </Shell>
    );
  }

  if (phase === "missing" || phase === "error" || !parada || !statsUser) {
    return (
      <Shell hideGlobalFooter noPadding>
        <div style={{ padding: gutterX, textAlign: "center", paddingTop: 80 }}>
          <p style={{ color: "var(--text-muted)" }}>
            {phase === "missing" ? "Parada não encontrada." : "Erro ao carregar parada."}
          </p>
          <Link href={listHref} style={{ color: "var(--accent)", fontWeight: 600 }}>
            ← Minhas Paradas
          </Link>
        </div>
      </Shell>
    );
  }

  const statCells = [
    { label: isDaily ? "Dias" : "Semanas", value: totalCharts },
    { label: "#1 pessoais", value: numberOnes },
    { label: "Músicas rankeadas", value: totalRanked },
    { label: "Artistas únicos", value: uniqueArtists },
  ];

  return (
    <Shell hideGlobalFooter noPadding>
      <div
        style={{
          background: paradaGradientStyle(paradaPalette(paletteSort), 0.14),
          padding: `${isMobile ? 20 : 28}px ${gutterX}px 32px`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <Link
            href={listHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--text-muted)",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {isOwn ? "Minhas Paradas" : "Paradas"}
          </Link>
          {isOwn && (
            <Link
              href={`/create?paradaId=${encodeURIComponent(paradaId)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 18px",
                borderRadius: 100,
                background: "var(--accent)",
                color: "white",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nova parada
            </Link>
          )}
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <ParadaLogo
            name={parada.name}
            logo={parada.logo}
            sortOrder={parada.sortOrder}
            size={isMobile ? PARADA_HERO_LOGO_SIZE.mobile : PARADA_HERO_LOGO_SIZE.desktop}
            rounded={20}
            shadow
          />
          <div style={{ flex: 1, minWidth: 180, paddingTop: 4 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: isMobile ? 26 : 34,
                    fontWeight: 800,
                    letterSpacing: "-0.035em",
                    margin: 0,
                    color: "var(--text)",
                  }}
                >
                  {parada.name}
                </h1>
                <div
                  style={{
                    display: "flex",
                    gap: 7,
                    flexWrap: "wrap",
                    alignItems: "center",
                    marginTop: 8,
                  }}
                >
                  {parada.isPrimary && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: 100,
                        background: "var(--accent-tint)",
                        color: "var(--accent)",
                        letterSpacing: "0.03em",
                      }}
                    >
                      ★ Principal
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: 100,
                      background: "var(--fill-subtle)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {isDaily ? "Diária" : "Semanal"}
                  </span>
                </div>
                {parada.genres.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {parada.genres.map((genre) => (
                      <span
                        key={genre}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "5px 12px",
                          borderRadius: 100,
                          background: "var(--fill-subtle)",
                          color: "var(--text)",
                        }}
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {isOwn && (
                <button
                  type="button"
                  onClick={() => setEditOpen((o) => !o)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "9px 18px",
                    borderRadius: 100,
                    background: "var(--surface)",
                    border: "1px solid var(--divider-strong)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Configurações
                </button>
              )}
            </div>
            {latestChart && (
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                Última publicação:{" "}
                <b style={{ color: "var(--text-subtle)" }}>{latestChart.weekLabel}</b>
                {" · "}
                {latestChart.dateRange}
              </div>
            )}
          </div>
        </div>
      </div>

      {editOpen && isOwn && (
        <div style={{ padding: `0 ${gutterX}px`, marginTop: -8 }}>
          <ParadaEditPanel
            paradaId={paradaId}
            initialName={parada.name}
            initialChartSize={parada.chartSize ?? null}
            initialCadence={parada.cadence ?? "weekly"}
            isPrimary={parada.isPrimary}
            onClose={() => setEditOpen(false)}
            onSaved={(saved) => {
              setParadaMeta((prev) =>
                prev
                  ? {
                      ...prev,
                      name: saved.name,
                      chartSize: saved.chartSize,
                      cadence: saved.cadence,
                      logo: saved.logo ?? prev.logo,
                    }
                  : prev,
              );
            }}
          />
        </div>
      )}

      <div style={{ padding: `20px ${gutterX}px 0` }}>
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 18,
            border: "1px solid var(--divider)",
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
            overflow: "hidden",
          }}
        >
          {statCells.map(({ label, value }, i) => {
            const isLastCol = isMobile ? i % 2 === 1 : i === 3;
            const isLastRow = isMobile ? i >= 2 : true;
            return (
              <div
                key={label}
                style={{
                  padding: isMobile ? "16px" : "20px 24px",
                  borderRight: isLastCol ? "none" : "1px solid var(--divider)",
                  borderBottom: isMobile && !isLastRow ? "1px solid var(--divider)" : "none",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: 4,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontSize: isMobile ? 24 : 28,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    color: "var(--text)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {value.toLocaleString("pt-BR")}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <ParadaDetailTabs
          handle={handle}
          paradaId={paradaId}
          user={statsUser}
          scoringTier={scoringTier}
          cadence={cadence}
          totalCharts={totalCharts}
          isMobile={isMobile}
          gutterX={gutterX}
        />
      </div>
    </Shell>
  );
}
