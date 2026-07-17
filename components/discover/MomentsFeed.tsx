"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "@/hooks/useTranslations";
import type { RecommendationItem } from "@/lib/recommendations-feed";
import type { AutoMomentItem, MomentsFeedScope, MomentType } from "@/lib/moments-feed";
import { MOMENT_TYPES } from "@/lib/moments-feed";
import { MOMENT_TYPE_META } from "./moment-types";
import { MomentComposer } from "./MomentComposer";
import { AutoMomentCard, MomentCard } from "./MomentCard";

const PAGE_SIZE = 10;

export function MomentsFeed({
  initialItems,
  initialNextCursor,
  autoItems,
  isLoggedIn,
}: {
  initialItems: RecommendationItem[];
  initialNextCursor: string | null;
  autoItems: AutoMomentItem[];
  isLoggedIn: boolean;
}) {
  const { t } = useTranslations();
  const [scope, setScope] = useState<MomentsFeedScope>("all");
  const [typeFilter, setTypeFilter] = useState<MomentType | null>(null);
  const [items, setItems] = useState<RecommendationItem[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Evita aplicar resposta de um filtro antigo depois de trocar de filtro.
  const requestSeq = useRef(0);

  const isDefaultView = scope === "all" && typeFilter === null;

  const fetchPage = useCallback(
    async (
      opts: { scope: MomentsFeedScope; type: MomentType | null; cursor?: string | null },
      append: boolean,
    ) => {
      const seq = ++requestSeq.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({ scope: opts.scope, limit: String(PAGE_SIZE) });
        if (opts.type) params.set("type", opts.type);
        if (opts.cursor) params.set("cursor", opts.cursor);
        const res = await fetch(`/api/moments?${params.toString()}`);
        if (!res.ok) return;
        const page = (await res.json()) as { items: RecommendationItem[]; nextCursor: string | null };
        if (seq !== requestSeq.current) return;
        setItems((prev) => (append ? [...prev, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
      } catch {
        // silencioso: mantém o que está na tela
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  // Primeira montagem já vem com dados do servidor; refetch só quando o filtro muda.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    fetchPage({ scope, type: typeFilter, cursor: null }, false);
  }, [scope, typeFilter, fetchPage]);

  const segStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 18px",
    borderRadius: 100,
    border: "none",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    background: active ? "var(--surface)" : "transparent",
    color: active ? "var(--text)" : "var(--text-subtle)",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
  });

  const chipStyle = (active: boolean): React.CSSProperties => ({
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 14px",
    borderRadius: 100,
    border: `1px solid ${active ? "var(--accent)" : "var(--divider)"}`,
    background: active ? "var(--accent-tint)" : "var(--surface)",
    color: active ? "var(--accent)" : "var(--text-subtle)",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <MomentComposer onCreated={(item) => setItems((prev) => [item, ...prev])} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {isLoggedIn && (
          <div
            style={{
              display: "flex",
              gap: 4,
              background: "var(--fill-subtle)",
              borderRadius: 100,
              padding: 4,
              width: "fit-content",
            }}
          >
            <button type="button" onClick={() => setScope("following")} style={segStyle(scope === "following")}>
              {t("moments.filterFollowing")}
            </button>
            <button type="button" onClick={() => setScope("all")} style={segStyle(scope === "all")}>
              {t("moments.filterAll")}
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {MOMENT_TYPES.map((k) => {
            const { Icon, labelKey } = MOMENT_TYPE_META[k];
            const active = typeFilter === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTypeFilter(active ? null : k)}
                style={chipStyle(active)}
              >
                <Icon size={13} />
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>
          {t("moments.loading")}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px dashed var(--divider-strong)",
            borderRadius: 18,
            padding: "32px 24px",
            textAlign: "center",
            color: "var(--text-subtle)",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {scope === "following" ? (
            <>
              {t("moments.emptyFollowing")}{" "}
              <button
                type="button"
                onClick={() => setScope("all")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent)",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 14,
                  fontFamily: "inherit",
                  padding: 0,
                }}
              >
                {t("moments.emptyFollowingCta")}
              </button>
            </>
          ) : (
            t("moments.emptyAll")
          )}
        </div>
      )}

      {!loading &&
        items.map((item, idx) => (
          <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <MomentCard
              item={item}
              onCommentCountChange={(id, delta) =>
                setItems((prev) =>
                  prev.map((it) => (it.id === id ? { ...it, comments: it.comments + delta } : it)),
                )
              }
            />
            {/* Cards automáticos entram uma vez, depois do 2º momento (só na visão padrão). */}
            {isDefaultView && idx === 1 &&
              autoItems.map((auto) => <AutoMomentCard key={auto.id} item={auto} />)}
          </div>
        ))}

      {/* Feed curto demais para intercalar: autos vão para o fim. */}
      {!loading && isDefaultView && items.length < 2 &&
        autoItems.map((auto) => <AutoMomentCard key={auto.id} item={auto} />)}

      {!loading && nextCursor && (
        <button
          type="button"
          onClick={() => fetchPage({ scope, type: typeFilter, cursor: nextCursor }, true)}
          disabled={loadingMore}
          style={{
            padding: "11px 20px",
            borderRadius: 100,
            border: "1px solid var(--divider)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: loadingMore ? "default" : "pointer",
            opacity: loadingMore ? 0.6 : 1,
            fontFamily: "inherit",
          }}
        >
          {loadingMore ? t("moments.loading") : t("moments.loadMore")}
        </button>
      )}
    </div>
  );
}
