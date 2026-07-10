import fs from "node:fs/promises";
import path from "node:path";

/**
 * Renderer server-side (Playwright/Chromium) do card de "Top" de uma edição
 * de chart (Global 100 / Air Play / Álbuns). Mesmo padrão de review-card.ts —
 * mesmos fundos por rede, script injetado como string crua (ver nota lá sobre
 * o wrapper __name do esbuild quebrando page.evaluate com função TS).
 *
 * O selo de subida/descida/estreia/retorno replica exatamente as cores e
 * formas de components/ui/MovementBadge.tsx (usado nas tabelas do site).
 */

export type ChartEntryStatus = "new" | "return" | "up" | "down" | "same";

export type ChartTop3CardInput = {
  chartName: string;
  weekLabel: string;
  /** Até 5 posições — cada variante usa a quantidade que precisa (ver VARIANTS.topN). */
  top3: { position: number; title: string; artist: string; coverUrl: string | null; status: ChartEntryStatus; delta: number | null }[];
};

export type ChartTop3CardVariant = "feed45" | "story916" | "telegram11";

const VARIANTS: Record<
  ChartTop3CardVariant,
  { width: number; height: number; bg: string; topN: number; startY: number; rowH: number; coverSize: number; footerY: number }
> = {
  // Feed: Top 3.
  feed45: { width: 1080, height: 1350, bg: "public/Modelos/feed_45.png", topN: 3, startY: 360, rowH: 220, coverSize: 168, footerY: 1230 },
  // Story: Top 5.
  story916: { width: 1080, height: 1920, bg: "public/Modelos/story_916.png", topN: 5, startY: 400, rowH: 224, coverSize: 168, footerY: 1780 },
  // Telegram: conteúdo sobe (startY menor) para sobrar mais distância até a URL no rodapé.
  telegram11: { width: 1080, height: 1080, bg: "public/Modelos/telegram_11.png", topN: 3, startY: 300, rowH: 190, coverSize: 140, footerY: 990 },
};

const DRAW_SCRIPT = `
window.__chartfmDrawChartTop3 = async function (args) {
  var W = args.width, H = args.height, bgDataUrl = args.bgDataUrl;
  var chartName = args.chartName, weekLabel = args.weekLabel, top3 = args.top3;
  var startY = args.startY, rowH = args.rowH, coverSize = args.coverSize, footerY = args.footerY;
  var FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
  var u = W / 1080;
  var rowX = Math.round(170 * u); // deslocado para a direita, longe do pilar decorativo do template

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

  function drawCoverPlaceholder(title, x, y, size, radius) {
    var hue = coverHue(title);
    var grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, "hsl(" + hue + ", 52%, 58%)");
    grad.addColorStop(1, "hsl(" + ((hue + 40) % 360) + ", 48%, 46%)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, radius);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "800 " + Math.round(size * 0.32) + "px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((title || "?")[0] ? (title || "?")[0].toUpperCase() : "?", x + size / 2, y + size / 2);
  }

  function truncate(text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    var t = text;
    while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
    return t + "…";
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

  function drawRankBadge(pos, x, y, size) {
    ctx.save();
    ctx.shadowColor = "rgba(250,36,60,0.35)";
    ctx.shadowBlur = Math.round(size * 0.25);
    ctx.shadowOffsetY = Math.round(size * 0.08);
    ctx.fillStyle = "#FA243C";
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.font = "800 " + Math.round(size * 0.5) + "px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(pos), x + size / 2, y + size / 2 + size * 0.02);
  }

  // Mesmas cores/formas de components/ui/MovementBadge.tsx (tabelas do site).
  function drawMovementBadge(status, delta, rightX, centerY) {
    var bg, fg, label, arrow;
    if (status === "up") { bg = "#E8F8EE"; fg = "#1B873F"; label = String(delta); arrow = "up"; }
    else if (status === "down") { bg = "#FDECEC"; fg = "#C5291C"; label = String(Math.abs(delta)); arrow = "down"; }
    else if (status === "new") { bg = "#000000"; fg = "#ffffff"; label = "NOVA"; arrow = null; }
    else if (status === "return") { bg = "#111827"; fg = "#ffffff"; label = "RETORNO"; arrow = null; }
    else { bg = "#F2F2F7"; fg = "#6B6B70"; label = "―"; arrow = null; }

    var fontSize = Math.round(24 * u);
    ctx.font = "700 " + fontSize + "px " + FONT;
    var textW = ctx.measureText(label).width;
    var arrowW = arrow ? Math.round(18 * u) : 0;
    var padX = Math.round(16 * u), padY = Math.round(8 * u);
    var h = fontSize + padY * 2;
    var w = textW + arrowW + padX * 2 + (arrow ? Math.round(6 * u) : 0);
    var x = rightX - w;
    var y = centerY - h / 2;

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.round(8 * u));
    ctx.fill();

    ctx.fillStyle = fg;
    var cursorX = x + padX;
    var triH = Math.round(7 * u), triW = Math.round(8 * u);
    if (arrow === "up") {
      ctx.beginPath();
      ctx.moveTo(cursorX + triW, centerY - triH);
      ctx.lineTo(cursorX + triW * 2, centerY + triH - 1);
      ctx.lineTo(cursorX, centerY + triH - 1);
      ctx.closePath();
      ctx.fill();
      cursorX += arrowW + Math.round(6 * u);
    } else if (arrow === "down") {
      ctx.beginPath();
      ctx.moveTo(cursorX + triW, centerY + triH);
      ctx.lineTo(cursorX, centerY - triH + 1);
      ctx.lineTo(cursorX + triW * 2, centerY - triH + 1);
      ctx.closePath();
      ctx.fill();
      cursorX += arrowW + Math.round(6 * u);
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cursorX, centerY + Math.round(1 * u));
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
  ctx.fillText(weekLabel.toUpperCase(), W - 80 * u, 120 * u);

  drawEyebrow("🏆  TOP " + top3.length + " · " + chartName.toUpperCase(), W / 2, 248 * u);

  var rowW = W - rowX - Math.round(90 * u);
  var badgeReserve = Math.round(130 * u);

  for (var i = 0; i < top3.length; i++) {
    var entry = top3[i];
    var rowY = startY + i * rowH;
    var rowCenterY = rowY + coverSize / 2;

    var cover = entry.coverUrl ? await loadImage(entry.coverUrl) : null;
    if (cover) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(rowX, rowY, coverSize, coverSize, Math.round(20 * u));
      ctx.clip();
      ctx.drawImage(cover, rowX, rowY, coverSize, coverSize);
      ctx.restore();
    } else {
      drawCoverPlaceholder(entry.title, rowX, rowY, coverSize, Math.round(20 * u));
    }

    var badgeSize = Math.round(64 * u);
    drawRankBadge(entry.position, rowX - Math.round(20 * u), rowY + coverSize - badgeSize + Math.round(20 * u), badgeSize);

    var textX = rowX + coverSize + Math.round(32 * u);
    var textMaxWidth = rowX + rowW - textX - badgeReserve;

    ctx.fillStyle = "#1D1D1F";
    ctx.font = "800 " + Math.round(42 * u) + "px " + FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(truncate(entry.title, textMaxWidth), textX, rowY + coverSize / 2 - Math.round(6 * u));

    ctx.fillStyle = "#86868B";
    ctx.font = "500 " + Math.round(32 * u) + "px " + FONT;
    ctx.fillText(truncate(entry.artist, textMaxWidth), textX, rowY + coverSize / 2 + Math.round(42 * u));

    drawMovementBadge(entry.status, entry.delta, rowX + rowW, rowCenterY);
  }

  ctx.fillStyle = "#86868B";
  ctx.font = "700 " + Math.round(26 * u) + "px " + FONT;
  ctx.textAlign = "center";
  ctx.fillText("chartfm.com.br", W / 2, footerY);
};
`;

/** Renderiza o card "Top" no tamanho/rede pedidos (feed/telegram: Top 3; story: Top 5). */
export async function renderChartTop3Card(input: ChartTop3CardInput, variant: ChartTop3CardVariant): Promise<Buffer | null> {
  const cfg = VARIANTS[variant];
  const bgBuffer = await fs.readFile(path.join(process.cwd(), cfg.bg));
  const bgUrl = `data:image/png;base64,${bgBuffer.toString("base64")}`;
  const top3 = input.top3.slice(0, cfg.topN);

  let browser: import("playwright").Browser | null = null;
  try {
    const { chromium } = await import(/* webpackIgnore: true, turbopackIgnore: true */ "playwright");
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: cfg.width, height: cfg.height }, deviceScaleFactor: 1 });
    await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;"><canvas id="c" width="${cfg.width}" height="${cfg.height}"></canvas></body></html>`);
    await page.addScriptTag({ content: DRAW_SCRIPT });
    await page.evaluate(
      (args) => (window as unknown as { __chartfmDrawChartTop3: (a: typeof args) => Promise<void> }).__chartfmDrawChartTop3(args),
      {
        width: cfg.width,
        height: cfg.height,
        bgDataUrl: bgUrl,
        chartName: input.chartName,
        weekLabel: input.weekLabel,
        top3,
        startY: cfg.startY,
        rowH: cfg.rowH,
        coverSize: cfg.coverSize,
        footerY: cfg.footerY,
      },
    );
    const png = await page.locator("#c").screenshot();
    return Buffer.from(png);
  } catch (err) {
    console.error("[social/chart-card] falha ao renderizar", err);
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}
