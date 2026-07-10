import fs from "node:fs/promises";
import path from "node:path";
import { scoreBadgeColor, scoreLabel } from "@/lib/album-score";

/**
 * Porta server-side (Playwright/Chromium) do template de "nota" já usado em
 * lib/review-story-export.ts (renderAlbumScoreStoryBlob/Square). O desenho é o
 * mesmo — cover com badge quadrado sobrepondo o canto — só variando o tamanho
 * do canvas e o fundo por rede. Mantido em sincronia manual com aquele arquivo:
 * mudanças de layout lá devem ser espelhadas aqui.
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

/**
 * Código que roda dentro do Chromium (não do processo Node). Injetado como
 * texto puro via page.addScriptTag — NÃO passar por page.evaluate(fn, args)
 * com uma função TS compilada: o esbuild/tsx injeta um wrapper __name(fn,
 * "nome") em toda função nomeada (keepNames), e como page.evaluate serializa
 * só o texto da função passada, a chamada a esse helper externo quebra em
 * runtime (ReferenceError: __name is not defined). Como string crua, o
 * Chromium executa exatamente o texto abaixo, sem esse wrapper.
 */
const DRAW_SCRIPT = `
window.__chartfmDrawReviewCard = async function (args) {
  var W = args.width, H = args.height, bgDataUrl = args.bgDataUrl;
  var albumTitle = args.albumTitle, albumArtist = args.albumArtist, albumCoverUrl = args.albumCoverUrl;
  var rating = args.rating, reviewCount = args.reviewCount, sc = args.scoreColor, scoreLabelText = args.scoreLabelText;
  var FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
  var u = W / 1080;

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function coverHue(title) {
    return Math.abs(title.split("").reduce(function (h, c) { return (h * 31 + c.charCodeAt(0)) | 0; }, 0)) % 360;
  }

  function drawCoverPlaceholder(x, y, size, radius) {
    var hue = coverHue(albumTitle);
    var grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, "hsl(" + hue + ", 52%, 58%)");
    grad.addColorStop(1, "hsl(" + ((hue + 40) % 360) + ", 48%, 46%)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, radius);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "800 " + Math.round(size * 0.26) + "px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((albumTitle || "?")[0] ? (albumTitle || "?")[0].toUpperCase() : "?", x + size / 2, y + size / 2);
  }

  function wrapText(text, maxWidth, maxLines) {
    var words = text.split(/\\s+/);
    var lines = [];
    var current = "";
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      var test = current ? current + " " + word : word;
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
      var consumed = lines.join(" ").split(/\\s+/).length;
      if (words.length > consumed) {
        var last = lines[lines.length - 1];
        lines[lines.length - 1] = last.length > 3 ? last.slice(0, -3) + "…" : last + "…";
      }
    }
    return lines;
  }

  function drawEyebrow(text, x, y) {
    ctx.font = "700 " + Math.round(28 * u) + "px " + FONT;
    var tw = ctx.measureText(text).width;
    var padX = 22 * u;
    var padY = 12 * u;
    var h = 28 * u + padY * 2;
    var w = tw + padX * 2;
    ctx.fillStyle = "rgba(250,36,60,0.10)";
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 9999);
    ctx.fill();
    ctx.fillStyle = "#FA243C";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  }

  function drawScorePill(text, color, x, y) {
    ctx.font = "700 " + Math.round(28 * u) + "px " + FONT;
    var tw = ctx.measureText(text).width;
    var padX = 22 * u;
    var padY = 10 * u;
    var h = 28 * u + padY * 2;
    var w = tw + padX * 2;
    ctx.fillStyle = color + "22";
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 9999);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  }

  function drawReviewCountPill(count, x, y) {
    var text = count + " " + (count === 1 ? "review" : "reviews");
    var fontSize = Math.round(24 * u);
    ctx.font = "700 " + fontSize + "px " + FONT;
    var tw = ctx.measureText(text).width;
    var padX = 18 * u;
    var padY = 10 * u;
    var h = fontSize + padY * 2;
    var w = tw + padX * 2;
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 9999);
    ctx.fill();
    ctx.fillStyle = "#3A3A3C";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  }

  function drawSquareScoreBadge(x, y, size, radius, fontSize) {
    ctx.save();
    ctx.shadowColor = sc + "55";
    ctx.shadowBlur = Math.round(size * 0.25);
    ctx.shadowOffsetY = Math.round(size * 0.1);
    ctx.fillStyle = sc;
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
    ctx.font = "800 " + fontSize + "px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(rating), x + size / 2, y + size / 2);
  }

  var bg = await loadImage(bgDataUrl);
  if (bg) {
    ctx.drawImage(bg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#FCFCFD";
    ctx.fillRect(0, 0, W, H);
  }

  ctx.font = "700 " + Math.round(22 * u) + "px " + FONT;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#86868B";
  ctx.fillText("NOTA DA COMUNIDADE", W - 80 * u, 120 * u);

  drawEyebrow("⭐  AVALIAÇÃO DA COMUNIDADE", W / 2, 248 * u);

  var coverSize = Math.round(460 * u);
  var coverX = (W - coverSize) / 2;
  var coverY = Math.round(340 * u);

  var cover = albumCoverUrl ? await loadImage(albumCoverUrl) : null;
  if (cover) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(coverX, coverY, coverSize, coverSize, Math.round(26 * u));
    ctx.clip();
    ctx.drawImage(cover, coverX, coverY, coverSize, coverSize);
    ctx.restore();
  } else {
    drawCoverPlaceholder(coverX, coverY, coverSize, Math.round(26 * u));
  }

  var badgeSize = Math.round(158 * u);
  drawSquareScoreBadge(
    coverX + coverSize - badgeSize + Math.round(28 * u),
    coverY + coverSize - badgeSize + Math.round(28 * u),
    badgeSize,
    Math.round(26 * u),
    Math.round(70 * u)
  );

  ctx.fillStyle = "#1D1D1F";
  ctx.font = "800 " + Math.round(60 * u) + "px " + FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  var titleLines = wrapText(albumTitle, W - Math.round(160 * u), 2);
  // O badge da nota desce 28*u abaixo da capa — título precisa começar bem
  // depois disso para não ficar colado nele.
  var y = coverY + coverSize + Math.round(110 * u);
  for (var i2 = 0; i2 < titleLines.length; i2++) {
    ctx.fillText(titleLines[i2], W / 2, y);
    y += Math.round(68 * u);
  }

  ctx.fillStyle = "#86868B";
  ctx.font = "500 " + Math.round(34 * u) + "px " + FONT;
  ctx.fillText(albumArtist, W / 2, y + Math.round(8 * u));
  y += Math.round(72 * u);

  drawScorePill(scoreLabelText.toUpperCase(), sc, W / 2 - Math.round(120 * u), y + Math.round(24 * u));
  drawReviewCountPill(reviewCount, W / 2 + Math.round(120 * u), y + Math.round(24 * u));

  ctx.fillStyle = "#86868B";
  ctx.font = "700 " + Math.round(26 * u) + "px " + FONT;
  ctx.textAlign = "center";
  ctx.fillText("CriticsFM · chartfm.com.br/criticsfm", W / 2, H - Math.round(120 * u));
};
`;

/** Renderiza o card de "nota" (avaliação da comunidade) no tamanho/rede pedidos. */
export async function renderReviewCard(input: ReviewCardInput, variant: ReviewCardVariant): Promise<Buffer | null> {
  const { width, height, bg } = VARIANTS[variant];
  const bgBuffer = await fs.readFile(path.join(process.cwd(), bg));
  const bgUrl = `data:image/png;base64,${bgBuffer.toString("base64")}`;

  let browser: import("playwright").Browser | null = null;
  try {
    const { chromium } = await import(/* webpackIgnore: true, turbopackIgnore: true */ "playwright");
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;"><canvas id="c" width="${width}" height="${height}"></canvas></body></html>`);
    await page.addScriptTag({ content: DRAW_SCRIPT });
    await page.evaluate(
      (args) => (window as unknown as { __chartfmDrawReviewCard: (a: typeof args) => Promise<void> }).__chartfmDrawReviewCard(args),
      {
        width,
        height,
        bgDataUrl: bgUrl,
        albumTitle: input.albumTitle,
        albumArtist: input.albumArtist,
        albumCoverUrl: input.albumCoverUrl,
        rating: input.rating,
        reviewCount: input.reviewCount,
        scoreColor: scoreBadgeColor(input.rating),
        scoreLabelText: scoreLabel(input.rating),
      },
    );
    const png = await page.locator("#c").screenshot();
    return Buffer.from(png);
  } catch (err) {
    console.error("[social/review-card] falha ao renderizar", err);
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}
