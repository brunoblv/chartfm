"use client";

import Image from "next/image";
import type { Cover as CoverType, Song } from "@/lib/types";

type SongRef = Pick<Song, "title" | "artist"> & Partial<Pick<Song, "imageUrl" | "album" | "spotifyId">>;

// Capas remotas (Spotify, Google, Cover Art Archive) já vêm pré-otimizadas pelas
// próprias CDNs. Deixamos `unoptimized` para essas: a otimização via /_next/image
// exige que a própria VPS busque a imagem no upstream, e isso vinha travando
// ("upstream image response timed out") por causa da conexão de saída da VPS,
// deixando as capas quebradas em produção. Só uploads locais (`/...`) passam pelo
// otimizador do Next, já que são servidos localmente.
function isOptimizableImageHost(url: string): boolean {
  return url.startsWith("/");
}

interface CoverProps {
  cover: CoverType;
  song?: SongRef;
  size?: number;
  rounded?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Cover({ cover, song, size = 56, rounded = 10, className, style: extraStyle }: CoverProps) {
  const direct = cover.imageUrl || song?.imageUrl || null;
  const imageUrl = direct;

  const [a, b] = cover.palette;
  const seed = cover.seed;
  const variant = seed % 5;
  const angle = seed % 360;

  const alt = song ? `Capa de ${song.title} - ${song.artist}` : "Capa do álbum";

  return (
    <div
      className={className}
      style={{
        width: size || "100%",
        height: size || "100%",
        borderRadius: rounded,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: "0 1px 2px rgba(0,0,0,0.08), inset 0 0 0 0.5px rgba(0,0,0,0.06)",
        ...extraStyle,
      }}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes={`${size}px`}
          unoptimized={!isOptimizableImageHost(imageUrl)}
          style={{ objectFit: "cover" }}
        />
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(${angle}deg, ${a} 0%, ${b} 100%)`,
            }}
          />
          {variant === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(circle at ${30 + (seed % 40)}% ${20 + (seed % 50)}%, rgba(255,255,255,0.35), transparent 55%)`,
              }}
            />
          )}
          {variant === 1 && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: size * 0.6,
                height: size * 0.6,
                transform: "translate(-50%,-50%)",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)",
              }}
            />
          )}
          {variant === 2 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(${angle + 90}deg, transparent 40%, rgba(0,0,0,0.15) 60%, transparent 80%)`,
              }}
            />
          )}
          {variant === 3 && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "40%",
                background: "linear-gradient(0deg, rgba(0,0,0,0.25), transparent)",
              }}
            />
          )}
          {variant === 4 && (
            <div
              style={{
                position: "absolute",
                inset: "15%",
                borderRadius: "50%",
                border: `${Math.max(1, size * 0.04)}px solid rgba(255,255,255,0.3)`,
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
