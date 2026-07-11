import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";

export type TelegramCardInput = {
  /** Etiqueta curta acima do texto, ex.: "Copa ChartFM", "Parada Global". */
  eyebrow: string;
  /** Texto principal do evento (a mesma mensagem enviada aos usuários). */
  text: string;
  /** Cor de destaque (hex). */
  accent: string;
};

// Sem Apple/Segoe (não existem em fontconfig na VPS Linux) — fontconfig resolve
// para a sans-serif padrão do sistema (ex.: DejaVu Sans/Liberation Sans).
const FONT = "sans-serif";
const W = 1080;
const H = 1080;

function hexWithAlpha(hex: string, alphaHex: string): string {
  return `${hex}${alphaHex}`;
}

function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Blob decorativo do canto superior direito (mesmo path do card HTML original). */
function drawTopRightBlob(ctx: SKRSContext2D, accent: string) {
  const boxX = W - 560; // width:560, positioned right:0
  const scaleY = 440 / 460; // width/height do <svg> vs viewBox
  const tx = (x: number) => boxX + x;
  const ty = (y: number) => y * scaleY;

  const grad = ctx.createLinearGradient(tx(560), ty(0), tx(0), ty(460));
  grad.addColorStop(0, hexWithAlpha(accent, "24")); // ~0.14 opacity
  grad.addColorStop(1, "#FFB8C205"); // ~0.02 opacity

  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(tx(560), ty(0));
  ctx.lineTo(tx(560), ty(270));
  ctx.quadraticCurveTo(tx(510), ty(460), tx(390), ty(420));
  ctx.quadraticCurveTo(tx(200), ty(368), tx(222), ty(175));
  ctx.quadraticCurveTo(tx(248), ty(-38), tx(560), ty(0));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Onda decorativa do rodapé (mesmo path do card HTML original). */
function drawBottomWave(ctx: SKRSContext2D) {
  const boxY = H - 220; // height:220, positioned bottom:0
  const scaleY = 220 / 230;
  const ty = (y: number) => boxY + y * scaleY;

  const grad = ctx.createLinearGradient(0, boxY, 0, H);
  grad.addColorStop(0, "#FFD0D82E"); // ~0.18 opacity
  grad.addColorStop(1, "#FFB8C873"); // ~0.45 opacity

  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, ty(150));
  ctx.quadraticCurveTo(270, ty(75), 540, ty(118));
  ctx.quadraticCurveTo(810, ty(158), 1080, ty(90));
  ctx.lineTo(1080, ty(230));
  ctx.lineTo(0, ty(230));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPill(ctx: SKRSContext2D, accent: string) {
  const x = -40, y = 150, w = 92, h = 780;
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, accent);
  grad.addColorStop(0.55, "#FF7098");
  grad.addColorStop(1, "#FFBCCA");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, w / 2);
  ctx.fill();
}

function drawLogo(ctx: SKRSContext2D, accent: string) {
  const boxX = 96, boxY = 72, boxSize = 48;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxSize, boxSize, 12);
  ctx.fill();

  // Ícone de barras (mesmo viewBox 24x24 do SVG original), escalado para 26x26 centralizado na box.
  const iconSize = 26;
  const scale = iconSize / 24;
  const iconX = boxX + (boxSize - iconSize) / 2;
  const iconY = boxY + (boxSize - iconSize) / 2;
  const bar = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(iconX + x * scale, iconY + y * scale, w * scale, h * scale, r * scale);
    ctx.fill();
  };
  ctx.fillStyle = "#fff";
  bar(3, 13, 4, 8, 1.5);
  bar(10, 8, 4, 13, 1.5);
  bar(17, 4, 4, 17, 1.5);

  ctx.fillStyle = "#1D1D1F";
  ctx.font = `800 30px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("ChartFM", boxX + boxSize + 12, boxY + boxSize / 2);
}

function drawEyebrow(ctx: SKRSContext2D, text: string, accent: string, x: number, y: number): number {
  const fontSize = 26;
  ctx.font = `700 ${fontSize}px ${FONT}`;
  const dotSize = 12;
  const gap = 10;
  const padX = 22, padY = 12;
  const textW = ctx.measureText(text).width;
  const w = dotSize + gap + textW + padX * 2;
  const h = fontSize + padY * 2;

  ctx.fillStyle = hexWithAlpha(accent, "1A");
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 9999);
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x + padX + dotSize / 2, y + h / 2, dotSize / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX + dotSize + gap, y + h / 2 + 1);

  return h;
}

function drawBars(ctx: SKRSContext2D, accent: string) {
  const bars = [
    { h: 240, from: "#FFB8C8", to: "#FFD8E2", opacity: "73" }, // ~0.45
    { h: 360, from: "#FF88A8", to: "#FFB8C8", opacity: "9E" }, // ~0.62
    { h: 520, from: accent, to: "#FF88A8", opacity: "CC" }, // ~0.80
  ];
  const barW = 60, gap = 16;
  const containerRight = W - 40;
  const containerW = bars.length * barW + (bars.length - 1) * gap;
  const containerLeft = containerRight - containerW;

  bars.forEach((bar, i) => {
    const x = containerLeft + i * (barW + gap);
    const y = H - bar.h;
    const grad = ctx.createLinearGradient(0, y, 0, H);
    grad.addColorStop(0, bar.from);
    grad.addColorStop(1, bar.to);
    ctx.save();
    ctx.globalAlpha = parseInt(bar.opacity, 16) / 255;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, bar.h, [barW / 2, barW / 2, 0, 0]);
    ctx.fill();
    ctx.restore();
  });
}

function drawDotsGrid(ctx: SKRSContext2D, accent: string) {
  const cell = 13, gap = 9, cols = 6, count = 54;
  const rows = Math.ceil(count / cols);
  const width = cols * cell + (cols - 1) * gap;
  const left = W - 72 - width;
  const top = 72;

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = accent;
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = left + col * (cell + gap);
    const y = top + row * (cell + gap);
    ctx.beginPath();
    ctx.arc(x + 2.5, y + 2.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  void rows;
}

/**
 * Renderiza o card do evento como PNG com @napi-rs/canvas (Skia nativo, sem
 * browser). Antes usava Chromium via Playwright — um processo pesado por
 * chamada, que chegou a derrubar a VPS/o build.
 */
export async function renderEventCard(input: TelegramCardInput): Promise<Buffer | null> {
  try {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#FCFCFD";
    ctx.fillRect(0, 0, W, H);

    drawTopRightBlob(ctx, input.accent);
    drawBottomWave(ctx);
    drawPill(ctx, input.accent);
    drawLogo(ctx, input.accent);

    const contentLeft = 96;
    const contentRight = W - 96;
    let y = 300;
    const eyebrowH = drawEyebrow(ctx, input.eyebrow, input.accent, contentLeft, y);
    y += eyebrowH + 28;

    ctx.fillStyle = "#1D1D1F";
    ctx.font = `800 62px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const maxWidth = Math.min(860, contentRight - contentLeft);
    const lines = wrapText(ctx, input.text, maxWidth);
    const lineH = Math.round(62 * 1.14);
    y += 62; // primeira linha usa baseline alphabetic
    for (const line of lines) {
      ctx.fillText(line, contentLeft, y);
      y += lineH;
    }

    ctx.fillStyle = "#86868B";
    ctx.font = `700 26px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("chartfm.com.br", contentLeft, H - 72);

    drawBars(ctx, input.accent);
    drawDotsGrid(ctx, input.accent);

    return canvas.toBuffer("image/png");
  } catch (err) {
    console.error("[telegram-card] falha ao renderizar card", err);
    return null;
  }
}
