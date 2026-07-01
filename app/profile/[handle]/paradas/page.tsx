"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Shell } from "@/components/layout/Shell";
import { ParadaListCard, type ParadaListCardData } from "@/components/paradas/ParadaListCard";
import { PAGE_GUTTER_X } from "@/lib/page-layout";
import { useIsMobile } from "@/hooks/useIsMobile";

type ParadasListResponse = {
  handle: string;
  paradas: ParadaListCardData[];
  canCreate: boolean;
  isOwn: boolean;
};

export default function ParadasListPage() {
  const params = useParams();
  const raw = params?.handle;
  const handle = decodeURIComponent(
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "",
  );
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const gutterX = isMobile ? PAGE_GUTTER_X.mobile : PAGE_GUTTER_X.desktop;

  const [phase, setPhase] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [data, setData] = useState<ParadasListResponse | null>(null);

  useEffect(() => {
    if (!handle) {
      setPhase("missing");
      return;
    }
    let cancelled = false;
    setPhase("loading");
    (async () => {
      try {
        const res = await fetch(`/api/profile/${encodeURIComponent(handle)}/paradas`);
        if (cancelled) return;
        if (res.ok) {
          setData((await res.json()) as ParadasListResponse);
          setPhase("ready");
          return;
        }
        if (res.status === 404) {
          setPhase("missing");
          return;
        }
        setPhase("error");
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const isOwn =
    data?.isOwn ??
    (session?.user?.handle != null && session.user.handle === handle);
  const title = isOwn ? "Minhas Paradas" : "Paradas";
  const countLabel =
    data?.paradas.length === 1
      ? "1 parada"
      : `${data?.paradas.length ?? 0} paradas`;

  if (phase === "loading") {
    return (
      <Shell hideGlobalFooter noPadding>
        <div style={{ padding: gutterX, color: "var(--text-muted)" }}>Carregando…</div>
      </Shell>
    );
  }

  if (phase === "missing" || phase === "error") {
    return (
      <Shell hideGlobalFooter noPadding>
        <div style={{ padding: gutterX, textAlign: "center", paddingTop: 80 }}>
          <p style={{ color: "var(--text-muted)" }}>
            {phase === "missing" ? "Perfil não encontrado." : "Erro ao carregar paradas."}
          </p>
          <Link href="/" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Voltar ao início
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell hideGlobalFooter noPadding>
      <div style={{ padding: `${isMobile ? 20 : 28}px ${gutterX}px 80px` }}>
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Perfil · @{handle}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: isMobile ? 28 : 36,
                  fontWeight: 800,
                  letterSpacing: "-0.035em",
                  margin: 0,
                  color: "var(--text)",
                }}
              >
                {title}
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-muted)",
                  margin: "6px 0 0",
                  letterSpacing: "-0.01em",
                }}
              >
                {countLabel} · clique para ver estatísticas e publicações
              </p>
            </div>
            {data?.canCreate && (
              <Link
                href="/chart/setup?slot=2"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "11px 22px",
                  borderRadius: 100,
                  background: "var(--accent)",
                  color: "white",
                  border: "none",
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Nova parada
              </Link>
            )}
          </div>
        </div>

        {data!.paradas.length === 0 ? (
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 18,
              border: "1px solid var(--divider)",
              padding: 48,
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 16 }}>
              Nenhuma parada publicada ainda.
            </p>
            {isOwn && (
              <Link href="/create" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
                Criar primeira parada →
              </Link>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "1fr"
                : "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {data!.paradas.map((p) => (
              <ParadaListCard
                key={p.id}
                parada={p}
                href={`/profile/${encodeURIComponent(handle)}/paradas/${p.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
