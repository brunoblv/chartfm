"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "@/hooks/useTranslations";

interface FollowButtonProps {
  targetId: string;
  initialFollowing?: boolean;
  /** "primary" = vermelho, "outline" = borda, "dark" = fundo invertido */
  variant?: "primary" | "outline" | "dark";
  size?: "sm" | "md";
  label?: string;
}

const STYLES = {
  primary: { background: "var(--accent)", color: "#fff", border: "none" },
  outline: {
    background: "transparent",
    color: "var(--text)",
    border: "1px solid var(--divider-strong)",
  },
  dark: { background: "var(--text)", color: "var(--bg)", border: "none" },
  following: {
    background: "var(--fill-subtle)",
    color: "var(--text)",
    border: "1px solid var(--divider)",
  },
} as const;

const SIZES = {
  sm: { padding: "6px 14px", fontSize: 13, borderRadius: 20 },
  md: { padding: "11px 26px", fontSize: 14, borderRadius: 100 },
} as const;

export function FollowButton({
  targetId,
  initialFollowing = false,
  variant = "outline",
  size = "sm",
  label,
}: FollowButtonProps) {
  const { data: session } = useSession();
  const { t } = useTranslations();
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();

  // Não renderiza para o próprio usuário ou se não estiver logado
  if (!session?.user?.id || session.user.id === targetId) return null;

  function toggle() {
    startTransition(async () => {
      const prev = following;
      setFollowing(!prev);
      try {
        const res = await fetch("/api/user/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetId }),
        });
        if (!res.ok) {
          setFollowing(prev);
          return;
        }
        const data = (await res.json()) as { following: boolean };
        setFollowing(data.following);
      } catch {
        setFollowing(prev);
      }
    });
  }

  const baseStyle = following ? STYLES.following : STYLES[variant];
  const sizeStyle = SIZES[size];
  const followLabel = label ?? t("communities.followCta");

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      style={{
        ...baseStyle,
        ...sizeStyle,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        cursor: isPending ? "default" : "pointer",
        opacity: isPending ? 0.65 : 1,
        transition: "all 150ms",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {following ? t("notifications.following") : followLabel}
    </button>
  );
}
