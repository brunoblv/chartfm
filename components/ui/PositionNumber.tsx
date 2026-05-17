interface PositionNumberProps {
  n: number;
  size?: number;
}

export function PositionNumber({ n, size = 22 }: PositionNumberProps) {
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        color: "var(--text)",
        fontVariantNumeric: "tabular-nums",
        minWidth: size * 1.6,
        textAlign: "right",
      }}
    >
      {n}
    </div>
  );
}
