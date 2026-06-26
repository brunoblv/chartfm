"use client";

import { useEffect, useState } from "react";

type Props = {
  artistName: string;
  artistImage: string | null;
  artistColor: string;
  artistInitials: string;
  size?: number;
  /** Capa do single em disputa; tem prioridade sobre a foto do artista. */
  coverUrl?: string | null;
};

export function CopaArtistAvatar({
  artistName,
  artistImage,
  artistColor,
  artistInitials,
  size = 44,
  coverUrl,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const r = Math.round(size * 0.26);
  const src = (coverUrl?.trim() || artistImage?.trim() || null);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  if (src && !imgError) {
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={artistName}
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={() => setImgError(true)}
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
