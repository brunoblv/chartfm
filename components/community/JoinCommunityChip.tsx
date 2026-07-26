"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check } from "lucide-react";
import { useTranslations } from "@/hooks/useTranslations";

export function JoinCommunityChip({ slug }: { slug: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const { t } = useTranslations();
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    if (!session?.user?.id) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/community/${slug}`)}`);
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/members`, {
        method: "POST",
      });
      if (res.ok) setJoined(true);
    } finally {
      setJoining(false);
    }
  }

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 12px",
    borderRadius: 100,
    border: "none",
    whiteSpace: "nowrap",
  };

  if (joined) {
    return (
      <span
        style={{
          ...baseStyle,
          color: "var(--text-muted)",
          background: "var(--fill-subtle)",
        }}
      >
        <Check size={12} /> {t("communities.joinedLabel")}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleJoin()}
      disabled={joining}
      style={{
        ...baseStyle,
        color: "var(--accent)",
        background: "var(--accent-tint)",
        cursor: joining ? "wait" : "pointer",
      }}
    >
      {joining ? "..." : t("communities.join")}
    </button>
  );
}
