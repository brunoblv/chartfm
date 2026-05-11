import type { CSSProperties } from "react";

export function ChartFMLogo({
  size = 32,
  style,
}: {
  size?: number;
  style?: CSSProperties;
}) {
  const gradId = "chartfm-logo-grad";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 88 88"
      fill="none"
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      <rect width="88" height="88" rx="20" fill={`url(#${gradId})`} />
      <rect x="22" y="50" width="10" height="20" rx="3" fill="white" opacity="0.85" />
      <rect x="39" y="36" width="10" height="34" rx="3" fill="white" opacity="0.92" />
      <rect x="56" y="20" width="10" height="50" rx="3" fill="white" />
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="88" y2="88">
          <stop stopColor="#FA243C" />
          <stop offset="1" stopColor="#FF5858" />
        </linearGradient>
      </defs>
    </svg>
  );
}
