"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

const BANNERS = [
  { src: "/copa/banner-1.jpg", alt: "Music World Cup – ChartFM Site Game" },
  { src: "/copa/banner-2.jpg", alt: "Music World Cup – ChartFM Site Game" },
  { src: "/copa/banner-3.jpg", alt: "Music World Cup – ChartFM Site Game" },
];

const INTERVAL_MS = 5000;

export function CopaBannerCarousel() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % BANNERS.length);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const t = setInterval(next, INTERVAL_MS);
    return () => clearInterval(t);
  }, [isPaused, next]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "3.2 / 1",
        overflow: "hidden",
        borderRadius: 0,
        cursor: "pointer",
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={next}
    >
      {BANNERS.map((b, i) => (
        <div
          key={b.src}
          style={{
            position: "absolute",
            inset: 0,
            opacity: i === current ? 1 : 0,
            transition: "opacity 0.6s ease",
            pointerEvents: i === current ? "auto" : "none",
          }}
        >
          <Image
            src={b.src}
            alt={b.alt}
            fill
            priority={i === 0}
            style={{ objectFit: "cover", objectPosition: "center top" }}
            sizes="100vw"
          />
        </div>
      ))}

      {/* Gradient overlay at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "40%",
          background: "linear-gradient(to top, var(--bg, #0C0C0E) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Dot indicators */}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 6,
          pointerEvents: "none",
        }}
      >
        {BANNERS.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === current ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === current ? "#FFD426" : "rgba(255,255,255,.4)",
              transition: "width 0.3s ease, background 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* Progress bar */}
      {!isPaused && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: 2,
            background: "#FFD426",
            animation: `bannerProgress ${INTERVAL_MS}ms linear`,
            animationIterationCount: "infinite",
            animationPlayState: isPaused ? "paused" : "running",
          }}
        />
      )}

      <style>{`
        @keyframes bannerProgress {
          from { width: 0% }
          to { width: 100% }
        }
      `}</style>
    </div>
  );
}
