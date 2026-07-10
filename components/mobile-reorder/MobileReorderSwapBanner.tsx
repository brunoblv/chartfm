"use client";

type Props = {
  title: string;
  onCancel: () => void;
};

export function MobileReorderSwapBanner({ title, onCancel }: Props) {
  return (
    <div
      style={{
        padding: "10px 16px",
        background: "var(--accent)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "white",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title} - toque no destino
      </div>
      <button
        type="button"
        onClick={onCancel}
        style={{
          background: "rgba(255,255,255,0.22)",
          border: "none",
          color: "white",
          fontSize: 11,
          fontWeight: 700,
          padding: "5px 11px",
          borderRadius: 100,
          cursor: "pointer",
          fontFamily: "inherit",
          flexShrink: 0,
        }}
      >
        Cancelar
      </button>
    </div>
  );
}
