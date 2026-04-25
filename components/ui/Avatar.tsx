import type { User } from "@/lib/types";

function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const r = Math.max(0, Math.min(255, parseInt(h.slice(0, 2), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(h.slice(2, 4), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(h.slice(4, 6), 16) + amt));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

interface AvatarProps {
  user: Pick<User, "name" | "avatar">;
  /** Foto de perfil (ex.: URL do Google) */
  imageUrl?: string | null;
  size?: number;
  ring?: boolean;
  className?: string;
}

export function Avatar({ user, imageUrl, size = 40, ring = false, className }: AvatarProps) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  if (imageUrl) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          boxShadow: ring ? `0 0 0 2px white, 0 0 0 4px ${user.avatar}` : "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <img src={imageUrl} alt={user.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${user.avatar}, ${shade(user.avatar, -20)})`,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 600,
        letterSpacing: "-0.02em",
        flexShrink: 0,
        boxShadow: ring ? `0 0 0 2px white, 0 0 0 4px ${user.avatar}` : "0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      {initials}
    </div>
  );
}
