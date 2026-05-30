import { desktopPosFontSize } from "@/lib/chart-list-layout";

export function DesktopPosCell({
  position,
  muted = false,
  large = false,
  alignSelf,
  children,
}: {
  position: number;
  muted?: boolean;
  large?: boolean;
  alignSelf?: React.CSSProperties["alignSelf"];
  children?: React.ReactNode;
}) {
  return (
    <div style={{ textAlign: "center", alignSelf }}>
      <div
        style={{
          fontSize: desktopPosFontSize(position, { large }),
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: muted ? "var(--text-muted)" : "var(--text)",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {position}
      </div>
      {children ? (
        <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
