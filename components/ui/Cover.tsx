"use client";

import { useEffect, useState } from "react";
import type { Cover as CoverType, Song } from "@/lib/types";

type SongRef = Pick<Song, "title" | "artist"> & Partial<Pick<Song, "imageUrl" | "album" | "spotifyId">>;

interface CoverProps {
  cover: CoverType;
  /** Quando informado sem imageUrl na capa/música, busca a arte na API `/api/spotify/cover`. */
  song?: SongRef;
  size?: number;
  rounded?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Cover({ cover, song, size = 56, rounded = 10, className, style: extraStyle }: CoverProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const direct = cover.imageUrl || song?.imageUrl || null;
  const imageUrl = direct || resolvedUrl;

  useEffect(() => {
    if (direct) return;
    // Evita tempestade de requisições em listas/grids grandes (miniaturas).
    if (size <= 64) return;
    // Sem track Spotify associada: não buscar capa por texto (import/planilha errava com outra faixa).
    if (!song?.spotifyId?.trim()) return;
    if (!song?.title?.trim() || !song?.artist?.trim()) return;
    let cancelled = false;
    const params = new URLSearchParams({ title: song.title, artist: song.artist });
    fetch(`/api/spotify/cover?${params.toString()}`)
      .then((r) => r.json() as Promise<{ url?: string | null }>)
      .then((data) => {
        if (!cancelled && data.url) setResolvedUrl(data.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [direct, song?.title, song?.artist, song?.spotifyId]);

  const [a, b] = cover.palette;
  const seed = cover.seed;
  const variant = seed % 5;
  const angle = seed % 360;

  const alt = song ? `Capa de ${song.title} — ${song.artist}` : "Capa do álbum";

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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt}
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
