"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { FeedRecommendationCard } from "@/components/home/FeedRecommendationCard";
import { ShareRecommendationModal } from "@/components/home/ShareRecommendationModal";
import type { RecommendationItem } from "@/lib/recommendations-feed";
import { useTranslations } from "@/hooks/useTranslations";

export function RecommendationsTab({ initialItems }: { initialItems: RecommendationItem[] }) {
  const { t } = useTranslations();
  const [items, setItems] = useState(initialItems);
  const [modalOpen, setModalOpen] = useState(false);

  function handleShared(item: RecommendationItem) {
    setItems((prev) => [item, ...prev.filter((p) => p.id !== item.id)]);
  }

  function handleCommentCountChange(id: string, delta: number) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, comments: p.comments + delta } : p)));
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: 100,
            border: "none",
            background: "var(--accent)",
            color: "white",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
          }}
        >
          <Plus size={16} />
          {t("recommendations.shareCta")}
        </button>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 18,
            border: "1px solid var(--divider)",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎧</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{t("recommendations.emptyTitle")}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("recommendations.emptySub")}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {items.map((item) => (
            <FeedRecommendationCard key={item.id} item={item} onCommentCountChange={handleCommentCountChange} />
          ))}
        </div>
      )}

      {modalOpen && (
        <ShareRecommendationModal onClose={() => setModalOpen(false)} onShared={handleShared} />
      )}
    </div>
  );
}
