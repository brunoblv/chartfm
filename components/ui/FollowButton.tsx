"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";

interface FollowButtonProps {
  targetId: string;
  initialFollowing?: boolean;
  /** "primary" = vermelho, "outline" = borda preta, "dark" = fundo preto */
  variant?: "primary" | "outline" | "dark";
  size?: "sm" | "md";
  label?: string;
}

const STYLES = {
  primary: { background: "#FA243C", color: "white", border: "none" },
  outline: { background: "none", color: "#1D1D1F", border: "1px solid rgba(0,0,0,0.12)" },
  dark: { background: "#1D1D1F", color: "white", border: "none" },
  following: { background: "rgba(0,0,0,0.06)", color: "#1D1D1F", border: "none" },
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
  label = "Seguir",
}: FollowButtonProps) {
  const { data: session } = useSession();
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
      {following ? "Seguindo" : label}
    </button>
  );
}
