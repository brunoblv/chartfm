"use client";

type PositionButton = {
  position: number;
  isCurrent: boolean;
  onSelect: () => void;
};

type Props = {
  title: string;
  buttons: PositionButton[];
  onClose: () => void;
};

export function MobileReorderPositionSheet({ title, buttons, onClose }: Props) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30 }}>
      <div
        role="presentation"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.38)" }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--surface-elevated)",
          borderRadius: "20px 20px 0 0",
          padding: "16px 16px 48px",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            background: "var(--divider-strong)",
            borderRadius: 2,
            margin: "0 auto 16px",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 14,
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--accent)",
                marginBottom: 3,
              }}
            >
              Mover para posição
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "var(--text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "var(--fill-subtle)",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 13,
              padding: "7px 14px",
              borderRadius: 100,
              cursor: "pointer",
              fontWeight: 600,
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            Cancelar
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {buttons.map((btn) => (
            <button
              key={btn.position}
              type="button"
              disabled={btn.isCurrent}
              onClick={btn.onSelect}
              style={{
                padding: "13px 0",
                borderRadius: 10,
                border: "none",
                fontSize: 16,
                fontWeight: 700,
                cursor: btn.isCurrent ? "default" : "pointer",
                background: btn.isCurrent ? "var(--down-bg)" : "var(--fill-inset)",
                color: btn.isCurrent ? "var(--down-fg)" : "var(--text)",
                opacity: btn.isCurrent ? 0.5 : 1,
                fontVariantNumeric: "tabular-nums",
                fontFamily: "inherit",
                width: "100%",
              }}
            >
              {btn.position}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
