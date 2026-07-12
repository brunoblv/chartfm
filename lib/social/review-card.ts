import fs from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { scoreBadgeColor, scoreLabel } from "@/lib/album-score";
import { absoluteSocialUrl } from "@/lib/social/config";

/**
 * Renderer nativo (Skia via @napi-rs/canvas, sem browser) do template de
 * "nota" já usado em lib/review-story-export.ts
 * (renderAlbumScoreStoryBlob/Square). O desenho é o mesmo — cover com badge
 * quadrado sobrepondo o canto — só variando o tamanho do canvas e o fundo por
 * rede. Mantido em sincronia manual com aquele arquivo: mudanças de layout lá
 * devem ser espelhadas aqui.
 *
 * Antes rodava num Chromium headless via Playwright: um processo por render,
 * 3 renders simultâneos por post — pesado demais pra VPS pequena, chegou a
 * derrubar o build. @napi-rs/canvas roda no mesmo processo Node, sem
 * subprocesso externo.
 */

export type ReviewCardInput = {
  albumTitle: string;
  albumArtist: string;
  albumCoverUrl: string | null;
  rating: number;
  reviewCount: number;
};

export type ReviewCardVariant = "feed45" | "story916" | "telegram11";

const VARIANTS: Record<ReviewCardVariant, { width: number; height: number; bg: string }> = {
  feed45: { width: 1080, height: 1350, bg: "public/Modelos/feed_45.png" },
  story916: { width: 1080, height: 1920, bg: "public/Modelos/story_916.png" },
  telegram11: { width: 1080, height: 1080, bg: "public/Modelos/telegram_11.png" },
};

// Sem Apple/Segoe (não existem em fontconfig na VPS Linux) — fontconfig resolve
// para a sans-serif padrão do sistema (ex.: DejaVu Sans/Liberation Sans).
const FONT = "sans-serif";

function coverHue(title: string): number {
  return Math.abs(title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360;
}

function drawCoverPlaceholder(ctx: SKRSContext2D, title: string, x: number, y: number, size: number, radius: number) {
  const hue = coverHue(title);
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, `hsl(${hue}, 52%, 58%)`);
  grad.addColorStop(1, `hsl(${(hue + 40) % 360}, 48%, 46%)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${Math.round(size * 0.26)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((title || "?")[0] ? (title || "?")[0].toUpperCase() : "?", x + size / 2, y + size / 2);
}

function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = test;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines) {
    const consumed = lines.join(" ").split(/\s+/).length;
    if (words.length > consumed) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = last.length > 3 ? `${last.slice(0, -3)}…` : `${last}…`;
    }
  }
  return lines;
}

function drawEyebrow(ctx: SKRSContext2D, text: string, x: number, y: number, u: number) {
  ctx.font = `700 ${Math.round(28 * u)}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  const padX = 22 * u;
  const padY = 12 * u;
  const h = 28 * u + padY * 2;
  const w = tw + padX * 2;
  ctx.fillStyle = "rgba(250,36,60,0.10)";
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 9999);
  ctx.fill();
  ctx.fillStyle = "#FA243C";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function measureScorePill(ctx: SKRSContext2D, text: string, fontSize: number, u: number) {
  ctx.font = `700 ${fontSize}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  const padX = 22 * u;
  return { w: tw + padX * 2, h: fontSize + 20 * u };
}

function measureReviewCountPill(ctx: SKRSContext2D, count: number, fontSize: number, u: number) {
  const text = `${count} ${count === 1 ? "review" : "reviews"}`;
  ctx.font = `700 ${fontSize}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  const padX = 18 * u;
  return { w: tw + padX * 2, h: fontSize + 20 * u };
}

function drawScorePill(ctx: SKRSContext2D, text: string, color: string, x: number, y: number, fontSize: number, u: number) {
  ctx.font = `700 ${fontSize}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  const padX = 22 * u;
  const padY = 10 * u;
  const h = fontSize + padY * 2;
  const w = tw + padX * 2;
  ctx.fillStyle = `${color}22`;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 9999);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawReviewCountPill(ctx: SKRSContext2D, count: number, x: number, y: number, fontSize: number, u: number) {
  const text = `${count} ${count === 1 ? "review" : "reviews"}`;
  ctx.font = `700 ${fontSize}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  const padX = 18 * u;
  const padY = 10 * u;
  const h = fontSize + padY * 2;
  const w = tw + padX * 2;
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 9999);
  ctx.fill();
  ctx.fillStyle = "#3A3A3C";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawScoreAndReviewCountRow(
  ctx: SKRSContext2D,
  scoreText: string,
  scoreColor: string,
  reviewCount: number,
  centerX: number,
  y: number,
  scoreFontSize: number,
  countFontSize: number,
  gap: number,
  u: number,
) {
  const score = measureScorePill(ctx, scoreText, scoreFontSize, u);
  const count = measureReviewCountPill(ctx, reviewCount, countFontSize, u);
  const rowH = Math.max(score.h, count.h);
  const totalW = score.w + gap + count.w;
  const scoreCx = centerX - totalW / 2 + score.w / 2;
  const countCx = centerX + totalW / 2 - count.w / 2;
  drawScorePill(ctx, scoreText, scoreColor, scoreCx, y, scoreFontSize, u);
  drawReviewCountPill(ctx, reviewCount, countCx, y, countFontSize, u);
  return y + rowH / 2;
}

function drawSquareScoreBadge(ctx: SKRSContext2D, rating: number, color: string, x: number, y: number, size: number, radius: number, fontSize: number) {
  ctx.save();
  ctx.shadowColor = `${color}55`;
  ctx.shadowBlur = Math.round(size * 0.25);
  ctx.shadowOffsetY = Math.round(size * 0.1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#FCFCFD";
  ctx.lineWidth = Math.max(4, Math.round(size * 0.03));
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = `800 ${fontSize}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(rating), x + size / 2, y + size / 2);
}

/** Renderiza o card de "nota" (avaliação da comunidade) no tamanho/rede pedidos. */
export async function renderReviewCard(input: ReviewCardInput, variant: ReviewCardVariant): Promise<Buffer | null> {
  const { width: W, height: H, bg } = VARIANTS[variant];
  const u = W / 1080;
  const vh = H / 1920;

  try {
    const bgBuffer = await fs.readFile(path.join(process.cwd(), bg));
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const bgImg = await loadImage(bgBuffer).catch(() => null);
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, W, H);
    } else {
      ctx.fillStyle = "#FCFCFD";
      ctx.fillRect(0, 0, W, H);
    }

    const scoreColor = scoreBadgeColor(input.rating);
    const scoreLabelText = scoreLabel(input.rating);

    ctx.font = `700 ${Math.round(22 * u)}px ${FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#86868B";
    ctx.fillText("NOTA DA COMUNIDADE", W - 80 * u, 120 * u * vh);

    // Sem emoji: Skia/fontconfig na VPS não garante glyph de emoji colorido (vira tofu box).
    drawEyebrow(ctx, "AVALIAÇÃO DA COMUNIDADE", W / 2, 248 * u * vh, u);

    const coverSize = Math.round(460 * u);
    const coverX = (W - coverSize) / 2;
    const coverY = Math.round(340 * u * vh);

    const cover = input.albumCoverUrl
      ? await loadImage(absoluteSocialUrl(input.albumCoverUrl)).catch((err) => {
          console.error("[social/review-card] falha ao carregar capa", input.albumCoverUrl, err);
          return null;
        })
      : null;
    if (cover) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, Math.round(26 * u));
      ctx.clip();
      ctx.drawImage(cover, coverX, coverY, coverSize, coverSize);
      ctx.restore();
    } else {
      drawCoverPlaceholder(ctx, input.albumTitle, coverX, coverY, coverSize, Math.round(26 * u));
    }

    const badgeSize = Math.round(158 * u);
    drawSquareScoreBadge(
      ctx,
      input.rating,
      scoreColor,
      coverX + coverSize - badgeSize + Math.round(28 * u),
      coverY + coverSize - badgeSize + Math.round(28 * u),
      badgeSize,
      Math.round(26 * u),
      Math.round(70 * u),
    );

    // Bloco de texto: espaçamento NÃO comprime por vh (senão as linhas do
    // título se sobrepõem e invadem o badge nos formatos baixos); em canvas
    // curto (telegram 1:1) só reduzimos o corpo das fontes.
    const compact = vh < 0.65;
    const titleFont = Math.round((compact ? 52 : 60) * u);
    const titleLineH = Math.round(titleFont * 1.12);
    const artistFont = Math.round((compact ? 30 : 34) * u);

    ctx.fillStyle = "#1D1D1F";
    ctx.font = `800 ${titleFont}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const titleLines = wrapText(ctx, input.albumTitle, W - Math.round(160 * u), 2);
    // 44*u abaixo da capa limpa o badge, que desce 28*u além dela (+ sombra).
    let y = coverY + coverSize + Math.round(44 * u) + titleFont;
    for (const line of titleLines) {
      ctx.fillText(line, W / 2, y);
      y += titleLineH;
    }
    y -= titleLineH;

    ctx.fillStyle = "#86868B";
    ctx.font = `500 ${artistFont}px ${FONT}`;
    y += Math.round(artistFont * 1.7);
    ctx.fillText(input.albumArtist, W / 2, y);

    const pillFont = Math.round(28 * u);
    const countFont = Math.round(24 * u);
    y =
      drawScoreAndReviewCountRow(
        ctx,
        scoreLabelText.toUpperCase(),
        scoreColor,
        input.reviewCount,
        W / 2,
        y + Math.round((compact ? 56 : 72) * u),
        pillFont,
        countFont,
        Math.round(16 * u),
        u,
      ) + Math.round(64 * u);

    ctx.fillStyle = "#86868B";
    ctx.font = `700 ${Math.round(26 * u)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("CriticsFM · chartfm.com.br/criticsfm", W / 2, Math.max(y, H - Math.round(120 * u * vh)));

    return canvas.toBuffer("image/png");
  } catch (err) {
    console.error("[social/review-card] falha ao renderizar", err);
    return null;
  }
}
