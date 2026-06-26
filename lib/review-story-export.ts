import { scoreBadgeColor, scoreLabel } from "@/lib/album-score";

const W = 1080;
const H = 1920;
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function coverHue(title: string): number {
  return Math.abs(title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360;
}

function drawCoverPlaceholder(ctx: CanvasRenderingContext2D, title: string, x: number, y: number, size: number, radius = 26) {
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
  ctx.fillText((title || "?")[0]?.toUpperCase() ?? "?", x + size / 2, y + size / 2);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
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

function drawEyebrow(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.font = `700 28px ${FONT}`;
  const tw = ctx.measureText(text).width;
  const padX = 22;
  const padY = 12;
  const h = 28 + padY * 2;
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

function drawScorePill(ctx: CanvasRenderingContext2D, text: string, sc: string, x: number, y: number) {
  ctx.font = `700 28px ${FONT}`;
  const tw = ctx.measureText(text).width;
  const padX = 22;
  const padY = 10;
  const h = 28 + padY * 2;
  const w = tw + padX * 2;
  ctx.fillStyle = `${sc}22`;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 9999);
  ctx.fill();
  ctx.fillStyle = sc;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

export type ReviewExportInput = {
  albumTitle: string;
  albumArtist: string;
  albumCoverUrl: string | null;
  rating: number;
  body: string | null;
  userName: string;
  userHandle: string;
};

/** @deprecated use ReviewExportInput */
export type ReviewStoryInput = ReviewExportInput;

function drawSquareScoreBadge(
  ctx: CanvasRenderingContext2D,
  rating: number,
  sc: string,
  x: number,
  y: number,
  size: number,
  radius: number,
  fontSize: number,
) {
  ctx.save();
  ctx.shadowColor = `${sc}55`;
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
  ctx.font = `800 ${fontSize}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(rating), x + size / 2, y + size / 2);
}

async function drawAlbumCover(
  ctx: CanvasRenderingContext2D,
  input: ReviewExportInput,
  x: number,
  y: number,
  size: number,
  radius: number,
) {
  const cover = input.albumCoverUrl ? await loadImage(input.albumCoverUrl) : null;
  if (cover) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, radius);
    ctx.clip();
    ctx.drawImage(cover, x, y, size, size);
    ctx.restore();
  } else {
    drawCoverPlaceholder(ctx, input.albumTitle, x, y, size, radius);
  }
}

function drawEyebrowLeft(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fontSize = 28) {
  ctx.font = `700 ${fontSize}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(text).width;
  const padX = 18;
  const padY = 10;
  const h = fontSize + padY * 2;
  ctx.fillStyle = "rgba(250,36,60,0.10)";
  ctx.beginPath();
  ctx.roundRect(x, y - h / 2, tw + padX * 2, h, 9999);
  ctx.fill();
  ctx.fillStyle = "#FA243C";
  ctx.fillText(text, x + padX, y);
}

function downloadReviewBlob(blob: Blob | null, input: ReviewExportInput, suffix: string) {
  if (!blob) return;
  const slug = input.albumTitle.replace(/[^\w\s-]/g, "").trim().slice(0, 40) || "review";
  const handle = input.userHandle.replace(/^@/, "");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chartfm-${handle}-review-${suffix}-${slug}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function renderReviewStoryBlob(input: ReviewExportInput): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bg = await loadImage("/story.png");
  if (bg) {
    ctx.drawImage(bg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#FCFCFD";
    ctx.fillRect(0, 0, W, H);
  }

  const handle = input.userHandle.replace(/^@/, "");
  const sc = scoreBadgeColor(input.rating);

  drawEyebrow(ctx, "✍️  MINHA AVALIAÇÃO", W / 2, 248);

  ctx.fillStyle = "#FA243C";
  ctx.font = `800 44px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`@${handle}`, W / 2, 340);

  const coverSize = 460;
  const coverX = (W - coverSize) / 2;
  const coverY = 388;

  await drawAlbumCover(ctx, input, coverX, coverY, coverSize, 26);

  const badgeSize = 158;
  drawSquareScoreBadge(
    ctx,
    input.rating,
    sc,
    coverX + coverSize - badgeSize + 28,
    coverY + coverSize - badgeSize + 28,
    badgeSize,
    26,
    70,
  );

  ctx.fillStyle = "#1D1D1F";
  ctx.font = `800 60px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const titleLines = wrapText(ctx, input.albumTitle, W - 160, 2);
  let y = coverY + coverSize + 64;
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, y);
    y += 68;
  }

  ctx.fillStyle = "#86868B";
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText(input.albumArtist, W / 2, y + 8);
  y += 56;

  drawScorePill(ctx, scoreLabel(input.rating).toUpperCase(), sc, W / 2, y + 24);
  y += 72;

  if (input.body?.trim()) {
    ctx.fillStyle = "#3A3A3C";
    ctx.font = `500 32px ${FONT}`;
    const bodyLines = wrapText(ctx, `"${input.body.trim()}"`, W - 144, 7);
    for (const line of bodyLines) {
      ctx.fillText(line, W / 2, y);
      y += 46;
    }
  }

  ctx.fillStyle = "#86868B";
  ctx.font = `700 26px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("CriticsFM · chartfm.com.br/criticsfm", W / 2, H - 120);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

const TW_W = 1672;
const TW_H = 941;

export async function renderReviewTwitterBlob(input: ReviewExportInput): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = TW_W;
  canvas.height = TW_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bg = await loadImage("/retangular.png");
  if (bg) {
    ctx.drawImage(bg, 0, 0, TW_W, TW_H);
  } else {
    ctx.fillStyle = "#FCFCFD";
    ctx.fillRect(0, 0, TW_W, TW_H);
  }

  const handle = input.userHandle.replace(/^@/, "");
  const sc = scoreBadgeColor(input.rating);

  const coverSize = 340;
  const coverX = 180;
  const coverY = Math.round((TW_H - coverSize) / 2);
  const contentX = coverX + coverSize + 56;
  const contentW = TW_W - contentX - 72;

  await drawAlbumCover(ctx, input, coverX, coverY, coverSize, 22);

  drawSquareScoreBadge(
    ctx,
    input.rating,
    sc,
    coverX + coverSize - 108 + 20,
    coverY + coverSize - 108 + 20,
    108,
    20,
    48,
  );

  drawEyebrowLeft(ctx, "✍️  MINHA AVALIAÇÃO", contentX, coverY + 8, 22);

  ctx.fillStyle = "#FA243C";
  ctx.font = `800 38px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`@${handle}`, contentX, coverY + 72);

  ctx.fillStyle = "#1D1D1F";
  ctx.font = `800 46px ${FONT}`;
  const titleLines = wrapText(ctx, input.albumTitle, contentW, 2);
  let y = coverY + 130;
  for (const line of titleLines) {
    ctx.fillText(line, contentX, y);
    y += 52;
  }

  ctx.fillStyle = "#86868B";
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText(input.albumArtist, contentX, y + 6);
  y += 48;

  ctx.textAlign = "left";
  ctx.font = `700 24px ${FONT}`;
  const pillText = scoreLabel(input.rating).toUpperCase();
  const pillTw = ctx.measureText(pillText).width;
  const pillPadX = 18;
  const pillH = 44;
  ctx.fillStyle = `${sc}22`;
  ctx.beginPath();
  ctx.roundRect(contentX, y - pillH / 2, pillTw + pillPadX * 2, pillH, 9999);
  ctx.fill();
  ctx.fillStyle = sc;
  ctx.textBaseline = "middle";
  ctx.fillText(pillText, contentX + pillPadX, y);
  y += 44;

  if (input.body?.trim()) {
    ctx.fillStyle = "#3A3A3C";
    ctx.font = `500 26px ${FONT}`;
    ctx.textBaseline = "alphabetic";
    const bodyLines = wrapText(ctx, `"${input.body.trim()}"`, contentW, 4);
    for (const line of bodyLines) {
      y += 38;
      ctx.fillText(line, contentX, y);
    }
  }

  ctx.fillStyle = "#86868B";
  ctx.font = `700 22px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("CriticsFM · chartfm.com.br/criticsfm", contentX, TW_H - 56);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

export async function downloadReviewStory(input: ReviewExportInput): Promise<void> {
  const blob = await renderReviewStoryBlob(input);
  downloadReviewBlob(blob, input, "story");
}

export async function downloadReviewTwitter(input: ReviewExportInput): Promise<void> {
  const blob = await renderReviewTwitterBlob(input);
  downloadReviewBlob(blob, input, "twitter");
}
