import { paradaPalette } from "@/lib/parada-palette";

/** Logo quadrado fixo no hero da página de parada. */
export const PARADA_HERO_LOGO_SIZE = {
  mobile: 88,
  desktop: 112,
} as const;

type ParadaLogoProps = {
  name: string;
  logo?: string | null;
  sortOrder?: number;
  size?: number;
  rounded?: number;
  shadow?: boolean;
};

export function ParadaLogo({
  name,
  logo,
  sortOrder = 0,
  size = 76,
  rounded = 18,
  shadow = false,
}: ParadaLogoProps) {
  const palette = paradaPalette(sortOrder);
  const initial = (name.trim()[0] ?? "P").toUpperCase();
  const fontSize = Math.round(size * 0.37);

  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: rounded,
          objectFit: "cover",
          flexShrink: 0,
          boxShadow: shadow ? `0 8px 28px ${palette[0]}55` : "inset 0 0 0 0.5px rgba(0,0,0,0.08)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`,
        display: "grid",
        placeItems: "center",
        fontSize,
        fontWeight: 800,
        color: "#fff",
        flexShrink: 0,
        boxShadow: shadow ? `0 8px 28px ${palette[0]}55` : undefined,
      }}
    >
      {initial}
    </div>
  );
}

export function ParadaLogoSmall({
  name,
  logo,
  sortOrder = 0,
}: {
  name: string;
  logo?: string | null;
  sortOrder?: number;
}) {
  return <ParadaLogo name={name} logo={logo} sortOrder={sortOrder} size={32} rounded={9} />;
}
