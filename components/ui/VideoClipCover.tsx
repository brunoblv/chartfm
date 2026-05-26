"use client";

interface VideoClipCoverProps {
  imageUrl?: string | null;
  paletteA?: string;
  paletteB?: string;
  seed?: number;
  /** desktop width in px (default 320, height = width * 9/16) */
  width?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function VideoClipCover({
  imageUrl,
  paletteA = "#FA243C",
  paletteB = "#FFE66D",
  seed = 0,
  width = 320,
  className,
  style: extraStyle,
}: VideoClipCoverProps) {
  const height = Math.round(width * (9 / 16));
  const angle = seed % 360;

  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius: 8,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: "0 1px 4px rgba(0,0,0,0.12), inset 0 0 0 0.5px rgba(0,0,0,0.06)",
        ...extraStyle,
      }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Captura do clipe"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(${angle}deg, ${paletteA} 0%, ${paletteB} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width={width * 0.18}
            height={width * 0.18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </div>
      )}
    </div>
  );
}
