"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  formatNewsDate,
  type NewsClosingSlide,
  type NewsContentSlide,
  type NewsHighlightSlide,
  type NewsPostInput,
  type NewsTheme,
} from "@/lib/news-posts/types";

/**
 * Artes 1080x1440 dos posts de notícia (design "Posts de notícias para o
 * Instagram"). O mesmo componente é usado no preview do editor (reduzido com
 * transform) e na exportação via html2canvas, então:
 * - só estilos inline com cores explícitas (html2canvas não resolve var() nem
 *   currentColor dentro de SVG);
 * - fotos como background-image/cover (html2canvas não suporta object-fit).
 * Os textos fixos da arte ficam em português: o perfil do Instagram é em pt-BR.
 */

export const ART_W = 1080;
export const ART_H = 1440;
const PAD = 72;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", system-ui, sans-serif';

type Tokens = {
  bg: string;
  surface: string;
  text: string;
  subtle: string;
  muted: string;
  divider: string;
  dividerStrong: string;
  accent: string;
  hero: string;
  btnBg: string;
  btnFg: string;
};

const TOKENS: Record<NewsTheme, Tokens> = {
  light: {
    bg: "#FBFBFD",
    surface: "#FFFFFF",
    text: "#1D1D1F",
    subtle: "#6B6B70",
    muted: "#86868B",
    divider: "rgba(0,0,0,0.06)",
    dividerStrong: "rgba(0,0,0,0.10)",
    accent: "#FA243C",
    hero: "linear-gradient(135deg, #FA243C 0%, #FF5858 100%)",
    btnBg: "#1D1D1F",
    btnFg: "#FFFFFF",
  },
  dark: {
    bg: "#000000",
    surface: "#1C1C1E",
    text: "#F5F5F7",
    subtle: "#C7C7CC",
    muted: "#8E8E93",
    divider: "rgba(255,255,255,0.08)",
    dividerStrong: "rgba(255,255,255,0.14)",
    accent: "#FF3B5C",
    hero: "linear-gradient(135deg, #E81E37 0%, #FF5872 100%)",
    btnBg: "#F5F5F7",
    btnFg: "#0A0A0C",
  },
};

const CREAM = "#F6F2EE";
const CREAM_TEXT = "#1D1D1F";
const CREAM_SUBTLE = "#6B6B70";
const BRAND_RED = "#FA243C";
const PHOTO_PLACEHOLDER =
  "repeating-linear-gradient(135deg, rgba(255,255,255,0.07) 0 2px, transparent 2px 26px), linear-gradient(165deg, #3b3b42 0%, #141417 100%)";
const VIDEO_PLACEHOLDER =
  "radial-gradient(circle at 50% 45%, rgba(250,36,60,0.28) 0%, transparent 62%), linear-gradient(165deg, #2a1215 0%, #0b0b0d 100%)";

export type NewsArtPost = Pick<NewsPostInput, "format" | "theme" | "eyebrow" | "title" | "summary" | "newsDate" | "content"> & {
  photoUrl: string | null;
  videoUrl: string | null;
};

export type NewsArtMode = "preview" | "export";

function cssUrl(url: string): string {
  return `url("${url.replace(/"/g, "%22")}")`;
}

function photoBg(url: string | null): CSSProperties {
  return url
    ? { backgroundImage: cssUrl(url), backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "#141417" }
    : { background: PHOTO_PLACEHOLDER };
}

function BrandMark({ size = 52 }: { size?: number }) {
  // Barras em div (não SVG) para sair igual no html2canvas.
  const u = size / 88;
  const bar = (left: number, top: number, h: number, opacity: number): CSSProperties => ({
    position: "absolute",
    left: left * u,
    top: top * u,
    width: 10 * u,
    height: h * u,
    borderRadius: 3 * u,
    background: "#FFFFFF",
    opacity,
  });
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        flex: "none",
        width: size,
        height: size,
        borderRadius: "22.7%",
        background: "linear-gradient(135deg, #FA243C 0%, #FF5858 100%)",
      }}
    >
      <span style={bar(22, 50, 20, 0.85)} />
      <span style={bar(39, 36, 34, 0.92)} />
      <span style={bar(56, 20, 50, 1)} />
    </span>
  );
}

function Brand({ color }: { color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color }}>
      <BrandMark />
      ChartFM
    </div>
  );
}

function Arrow({ color, size = 32, down = false }: { color: string; size?: number; down?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {down ? (
        <>
          <path d="M12 5v14" />
          <path d="m6 13 6 6 6-6" />
        </>
      ) : (
        <>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </>
      )}
    </svg>
  );
}

const topbar: CSSProperties = {
  position: "absolute",
  left: PAD,
  right: PAD,
  top: 64,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

function GlassChip({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "14px 26px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.16)",
        border: "1px solid rgba(255,255,255,0.24)",
        color: "#FFFFFF",
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function eyebrowStyle(color: string): CSSProperties {
  return { fontSize: 28, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color, lineHeight: 1.3 };
}

function Footer({ index, total, dot, dotOn, color, label, arrow }: { index: number; total: number; dot: string; dotOn: string; color: string; label: string; arrow: boolean }) {
  return (
    <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} style={{ display: "block", width: i === index ? 52 : 14, height: 14, borderRadius: 999, background: i === index ? dotOn : dot }} />
        ))}
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 600, color }}>
        {label}
        {arrow && <Arrow color={color} size={34} />}
      </span>
    </div>
  );
}

function Frame({ bg, color, children }: { bg: string; color: string; children: ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        width: ART_W,
        height: ART_H,
        overflow: "hidden",
        background: bg,
        color,
        fontFamily: FONT,
        WebkitFontSmoothing: "antialiased",
        // ss01/cv11 do body não existem no fillText do canvas e desalinham as palavras no html2canvas.
        fontFeatureSettings: "normal",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

function SinglePost({ post }: { post: NewsArtPost }) {
  const t = TOKENS[post.theme];
  return (
    <Frame bg={t.bg} color={t.text}>
      <div style={{ position: "absolute", left: 0, top: 0, width: ART_W, height: 700, ...photoBg(post.photoUrl) }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: ART_W, height: 240, background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)" }} />
      <div style={topbar}>
        <Brand color="#FFFFFF" />
        <GlassChip>Notícias</GlassChip>
      </div>
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 764 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 24 }}>
          <span style={eyebrowStyle(t.accent)}>{post.eyebrow}</span>
          <span style={{ fontSize: 28, fontWeight: 500, color: t.muted, whiteSpace: "nowrap" }}>{formatNewsDate(post.newsDate)}</span>
        </div>
        <div style={{ marginTop: 22, fontSize: 74, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05 }}>{post.title}</div>
        {post.summary && <div style={{ marginTop: 26, fontSize: 36, lineHeight: 1.4, color: t.subtle }}>{post.summary}</div>}
      </div>
      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          bottom: 60,
          paddingTop: 32,
          borderTop: `2px solid ${t.dividerStrong}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.01em" }}>chartfm.com.br</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            background: t.btnBg,
            color: t.btnFg,
            borderRadius: 999,
            padding: "20px 36px",
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          Leia na íntegra, link na bio
          <Arrow color={t.btnFg} />
        </span>
      </div>
    </Frame>
  );
}

function CarouselCover({ post, total }: { post: NewsArtPost; total: number }) {
  // A capa é fixa (escura) nos dois temas.
  return (
    <Frame bg="#141417" color="#FFFFFF">
      <div style={{ position: "absolute", left: 0, top: 0, width: ART_W, height: ART_H, ...photoBg(post.photoUrl) }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: ART_W,
          height: ART_H,
          background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0.35) 52%, rgba(0,0,0,0.9) 100%)",
        }}
      />
      <div style={topbar}>
        <Brand color="#FFFFFF" />
        <GlassChip>Notícias</GlassChip>
      </div>
      <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 176 }}>
        {post.eyebrow && (
          <span
            style={{
              display: "inline-block",
              background: BRAND_RED,
              color: "#FFFFFF",
              borderRadius: 999,
              padding: "14px 28px",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {post.eyebrow}
          </span>
        )}
        <div style={{ marginTop: 32, fontSize: 96, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.02 }}>{post.title}</div>
        {post.summary && <div style={{ marginTop: 30, fontSize: 38, lineHeight: 1.4, color: "rgba(255,255,255,0.82)" }}>{post.summary}</div>}
      </div>
      <Footer index={0} total={total} dot="rgba(255,255,255,0.4)" dotOn="#FFFFFF" color="#FFFFFF" label="Deslize" arrow />
    </Frame>
  );
}

function Counter({ index, total, color }: { index: number; total: number; color: string }) {
  return <span style={{ fontSize: 30, fontWeight: 600, color, letterSpacing: "0.02em" }}>{`${index + 1} / ${total}`}</span>;
}

function ContentSlide({ slide, theme, index, total }: { slide: NewsContentSlide; theme: NewsTheme; index: number; total: number }) {
  const t = TOKENS[theme];
  const paragraphs = slide.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <Frame bg={t.bg} color={t.text}>
      <div style={topbar}>
        <Brand color={t.text} />
        <Counter index={index} total={total} color={t.subtle} />
      </div>
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 220 }}>
        {slide.eyebrow && <div style={eyebrowStyle(t.accent)}>{slide.eyebrow}</div>}
        <div style={{ marginTop: 22, fontSize: 68, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.08 }}>{slide.title}</div>
        {paragraphs.length > 0 && (
          <div
            style={{
              marginTop: 56,
              paddingLeft: 40,
              borderLeft: `8px solid ${t.accent}`,
              display: "flex",
              flexDirection: "column",
              gap: 32,
              fontSize: 40,
              lineHeight: 1.45,
            }}
          >
            {paragraphs.map((p, i) => (
              <p key={i} style={{ margin: 0, whiteSpace: "pre-line", color: paragraphs.length > 1 && i === paragraphs.length - 1 ? t.subtle : t.text }}>
                {p}
              </p>
            ))}
          </div>
        )}
      </div>
      <Footer index={index} total={total} dot={t.dividerStrong} dotOn={t.accent} color={t.subtle} label="Deslize" arrow />
    </Frame>
  );
}

function highlightValueSize(value: string): number {
  const len = [...value].length;
  if (len <= 3) return 340;
  if (len <= 4) return 280;
  if (len <= 5) return 230;
  return 190;
}

function HighlightSlide({ slide, theme, index, total }: { slide: NewsHighlightSlide; theme: NewsTheme; index: number; total: number }) {
  const t = TOKENS[theme];
  return (
    <Frame bg={t.bg} color={t.text}>
      <div style={topbar}>
        <Brand color={t.text} />
        <Counter index={index} total={total} color={t.subtle} />
      </div>
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 200 }}>
        {slide.eyebrow && <div style={eyebrowStyle(t.accent)}>{slide.eyebrow}</div>}
        <div
          style={{
            marginTop: 28,
            height: 600,
            borderRadius: 48,
            background: t.hero,
            color: "#FFFFFF",
            padding: 56,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxSizing: "border-box",
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.92 }}>{slide.label}</span>
          <div>
            <div style={{ fontSize: highlightValueSize(slide.value), fontWeight: 800, letterSpacing: "-0.06em", lineHeight: 0.9, whiteSpace: "nowrap" }}>
              {slide.value}
            </div>
            {slide.caption && <div style={{ marginTop: 20, fontSize: 44, fontWeight: 600, lineHeight: 1.2 }}>{slide.caption}</div>}
          </div>
        </div>
        {slide.stats.length > 0 && (
          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: `repeat(${slide.stats.length}, minmax(0, 1fr))`, gap: 24 }}>
            {slide.stats.map((s, i) => (
              <div key={i} style={{ background: t.surface, border: `1px solid ${t.divider}`, borderRadius: 32, padding: "32px 36px" }}>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: t.subtle }}>{s.label}</div>
                <div style={{ marginTop: 10, fontSize: 96, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, whiteSpace: "nowrap" }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer index={index} total={total} dot={t.dividerStrong} dotOn={t.accent} color={t.subtle} label="Deslize" arrow />
    </Frame>
  );
}

function ClosingSlide({ closing, theme, index, total }: { closing: NewsClosingSlide; theme: NewsTheme; index: number; total: number }) {
  const t = TOKENS[theme];
  return (
    <Frame bg={t.bg} color={t.text}>
      <div style={topbar}>
        <Brand color={t.text} />
        <Counter index={index} total={total} color={t.subtle} />
      </div>
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 300 }}>
        {closing.eyebrow && <div style={eyebrowStyle(t.accent)}>{closing.eyebrow}</div>}
        <div style={{ marginTop: 24, fontSize: 100, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.03 }}>{closing.title}</div>
        {closing.text && <div style={{ marginTop: 40, fontSize: 40, lineHeight: 1.45, color: t.subtle }}>{closing.text}</div>}
        <div
          style={{
            marginTop: 64,
            display: "inline-flex",
            alignItems: "center",
            gap: 18,
            background: t.btnBg,
            color: t.btnFg,
            borderRadius: 999,
            padding: "30px 52px",
            fontSize: 40,
            fontWeight: 700,
          }}
        >
          {closing.cta}
          <Arrow color={t.btnFg} size={42} />
        </div>
      </div>
      <Footer index={index} total={total} dot={t.dividerStrong} dotOn={t.accent} color={t.subtle} label="Link na bio" arrow={false} />
    </Frame>
  );
}

function VideoPost({ post, mode, videoFrame }: { post: NewsArtPost; mode: NewsArtMode; videoFrame: string | null }) {
  // Creme e texto escuro fixos nos dois temas, para o post ficar igual no feed.
  const showVideo = mode === "preview" && post.videoUrl;
  return (
    <Frame bg={CREAM} color={CREAM_TEXT}>
      <div style={topbar}>
        <Brand color={CREAM_TEXT} />
        <span style={{ fontSize: 28, fontWeight: 500, color: CREAM_SUBTLE }}>{formatNewsDate(post.newsDate)}</span>
      </div>
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 176 }}>
        {post.eyebrow && <div style={eyebrowStyle("#E11D3F")}>{post.eyebrow}</div>}
        <div style={{ marginTop: 22, fontSize: 72, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05 }}>{post.title}</div>
      </div>
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 520, display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 600, color: CREAM_SUBTLE }}>
        Assista ao vídeo
        <Arrow color={CREAM_SUBTLE} down />
      </div>
      <div style={{ position: "absolute", left: 0, top: 600, width: ART_W, height: 6, background: BRAND_RED }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 606,
          width: ART_W,
          height: 834,
          ...(videoFrame && !showVideo
            ? { backgroundImage: cssUrl(videoFrame), backgroundSize: "cover", backgroundPosition: "center" }
            : { background: VIDEO_PLACEHOLDER }),
        }}
      >
        {showVideo && (
          <video
            src={post.videoUrl ?? undefined}
            muted
            loop
            autoPlay
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
      </div>
      {mode === "preview" && !post.videoUrl && (
        // Marca onde fica o vídeo — não entra na arte final.
        <div
          style={{
            position: "absolute",
            left: 460,
            top: 943,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.55)",
            border: "2px solid rgba(255,255,255,0.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={72} height={72} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z" />
          </svg>
        </div>
      )}
    </Frame>
  );
}

export type NewsArtSlideKind = "single" | "cover" | "content" | "highlight" | "closing" | "video";

export function newsArtSlideKinds(post: Pick<NewsArtPost, "format" | "content">): NewsArtSlideKind[] {
  if (post.format === "SINGLE") return ["single"];
  if (post.format === "VIDEO") return ["video"];
  return ["cover", ...post.content.slides.map((s) => s.kind), "closing"];
}

/** Uma arte do post em tamanho real (1080x1440). */
export function NewsPostArt({
  post,
  index,
  mode = "preview",
  videoFrame = null,
}: {
  post: NewsArtPost;
  index: number;
  mode?: NewsArtMode;
  /** Quadro do vídeo (data URL) usado na arte exportada — vira capa do Reel. */
  videoFrame?: string | null;
}) {
  if (post.format === "SINGLE") return <SinglePost post={post} />;
  if (post.format === "VIDEO") return <VideoPost post={post} mode={mode} videoFrame={videoFrame} />;

  const total = post.content.slides.length + 2;
  if (index === 0) return <CarouselCover post={post} total={total} />;
  if (index === total - 1) return <ClosingSlide closing={post.content.closing} theme={post.theme} index={index} total={total} />;
  const slide = post.content.slides[index - 1];
  if (!slide) return null;
  return slide.kind === "highlight" ? (
    <HighlightSlide slide={slide} theme={post.theme} index={index} total={total} />
  ) : (
    <ContentSlide slide={slide} theme={post.theme} index={index} total={total} />
  );
}

/** Arte reduzida para caber no editor. */
export function NewsPostArtPreview({ post, index, width }: { post: NewsArtPost; index: number; width: number }) {
  const scale = width / ART_W;
  return (
    <div
      style={{
        position: "relative",
        width,
        height: ART_H * scale,
        overflow: "hidden",
        borderRadius: 6,
        border: "1px solid var(--divider-strong)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        flex: "none",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <NewsPostArt post={post} index={index} mode="preview" />
      </div>
    </div>
  );
}
