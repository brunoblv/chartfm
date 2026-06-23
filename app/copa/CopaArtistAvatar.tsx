import Image from "next/image";

type Props = {
  artistName: string;
  artistImage: string | null;
  artistColor: string;
  artistInitials: string;
  size?: number;
};

export function CopaArtistAvatar({
  artistName,
  artistImage,
  artistColor,
  artistInitials,
  size = 44,
}: Props) {
  const r = Math.round(size * 0.26);
  if (artistImage) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: `${r}px`,
          overflow: "hidden",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <Image
          src={artistImage}
          alt={artistName}
          fill
          style={{ objectFit: "cover" }}
          sizes={`${size}px`}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: `${r}px`,
        background: artistColor,
        display: "grid",
        placeItems: "center",
        fontSize: Math.round(size * 0.33),
        fontWeight: 800,
        color: "#fff",
        flexShrink: 0,
        letterSpacing: "-0.02em",
      }}
    >
      {artistInitials}
    </div>
  );
}
