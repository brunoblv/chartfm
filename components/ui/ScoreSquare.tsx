import { scoreColor } from "@/lib/album-score";

type ScoreSquareProps = {
  score: number;
  size?: number;
  /** Melhora leitura sobre capas de álbum escuras */
  overlay?: boolean;
};

export function ScoreSquare({ score, size = 40, overlay = false }: ScoreSquareProps) {
  const color = scoreColor(score);
  const radius = Math.max(8, Math.round(size * 0.22));
  const fontSize = Math.max(12, Math.round(size * 0.38));

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: color,
        color: "white",
        display: "grid",
        placeItems: "center",
        fontSize,
        fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
        flexShrink: 0,
        boxShadow: overlay
          ? `0 2px 10px rgba(0,0,0,0.28), 0 2px 8px ${color}40`
          : `0 2px 8px ${color}40`,
      }}
    >
      {score}
    </div>
  );
}
