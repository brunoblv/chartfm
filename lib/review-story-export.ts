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

function drawScorePill(ctx: CanvasRenderingContext2D, text: string, sc: string, x: number, y: number, fontSize = 28) {
  ctx.font = `700 ${fontSize}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  const padX = 22;
  const padY = 10;
  const h = fontSize + padY * 2;
  const w = tw + padX * 2;
  ctx.fillStyle = `${sc}22`;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 9999);
  ctx.fill();
  ctx.fillStyle = sc;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  return h;
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
  let y = coverY + coverSize + 110;
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

const SQ_W = 1254;
const SQ_H = 1254;

export type ExportFormat = "story" | "square" | "twitter";

export async function renderReviewSquareBlob(input: ReviewExportInput): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = SQ_W;
  canvas.height = SQ_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bg = await loadImage("/quadrada.png");
  if (bg) {
    ctx.drawImage(bg, 0, 0, SQ_W, SQ_H);
  } else {
    ctx.fillStyle = "#FCFCFD";
    ctx.fillRect(0, 0, SQ_W, SQ_H);
  }

  const handle = input.userHandle.replace(/^@/, "");
  const sc = scoreBadgeColor(input.rating);
  const u = SQ_W / 1080;

  drawEyebrow(ctx, "✍️  MINHA AVALIAÇÃO", SQ_W / 2, Math.round(200 * u));

  ctx.fillStyle = "#FA243C";
  ctx.font = `800 ${Math.round(40 * u)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`@${handle}`, SQ_W / 2, Math.round(280 * u));

  const coverSize = Math.round(400 * u);
  const coverX = (SQ_W - coverSize) / 2;
  const coverY = Math.round(310 * u);

  await drawAlbumCover(ctx, input, coverX, coverY, coverSize, Math.round(24 * u));

  const badgeSize = Math.round(130 * u);
  drawSquareScoreBadge(
    ctx,
    input.rating,
    sc,
    coverX + coverSize - badgeSize + Math.round(24 * u),
    coverY + coverSize - badgeSize + Math.round(24 * u),
    badgeSize,
    Math.round(22 * u),
    Math.round(58 * u),
  );

  ctx.fillStyle = "#1D1D1F";
  ctx.font = `800 ${Math.round(52 * u)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const titleLines = wrapText(ctx, input.albumTitle, SQ_W - Math.round(140 * u), 2);
  let y = coverY + coverSize + Math.round(90 * u);
  for (const line of titleLines) {
    ctx.fillText(line, SQ_W / 2, y);
    y += Math.round(58 * u);
  }

  ctx.fillStyle = "#86868B";
  ctx.font = `500 ${Math.round(30 * u)}px ${FONT}`;
  ctx.fillText(input.albumArtist, SQ_W / 2, y + Math.round(6 * u));
  y += Math.round(48 * u);

  drawScorePill(ctx, scoreLabel(input.rating).toUpperCase(), sc, SQ_W / 2, y + Math.round(20 * u));
  y += Math.round(60 * u);

  if (input.body?.trim()) {
    ctx.fillStyle = "#3A3A3C";
    ctx.font = `500 ${Math.round(28 * u)}px ${FONT}`;
    const bodyLines = wrapText(ctx, `"${input.body.trim()}"`, SQ_W - Math.round(120 * u), 4);
    for (const line of bodyLines) {
      ctx.fillText(line, SQ_W / 2, y);
      y += Math.round(40 * u);
    }
  }

  ctx.fillStyle = "#86868B";
  ctx.font = `700 ${Math.round(24 * u)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("CriticsFM · chartfm.com.br/criticsfm", SQ_W / 2, SQ_H - Math.round(72 * u));

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

export async function downloadReviewStory(input: ReviewExportInput): Promise<void> {
  const blob = await renderReviewStoryBlob(input);
  downloadReviewBlob(blob, input, "story");
}

export async function downloadReviewSquare(input: ReviewExportInput): Promise<void> {
  const blob = await renderReviewSquareBlob(input);
  downloadReviewBlob(blob, input, "square");
}

export async function downloadReviewTwitter(input: ReviewExportInput): Promise<void> {
  const blob = await renderReviewTwitterBlob(input);
  downloadReviewBlob(blob, input, "twitter");
}

export async function downloadReview(input: ReviewExportInput, format: ExportFormat): Promise<void> {
  if (format === "story") await downloadReviewStory(input);
  else if (format === "square") await downloadReviewSquare(input);
  else await downloadReviewTwitter(input);
}

// ——— Community album score exports ———

export type AlbumScoreExportInput = {
  albumTitle: string;
  albumArtist: string;
  albumCoverUrl: string | null;
  rating: number;
  reviewCount: number;
};

function downloadAlbumScoreBlob(blob: Blob | null, input: AlbumScoreExportInput, suffix: string) {
  if (!blob) return;
  const slug = input.albumTitle.replace(/[^\w\s-]/g, "").trim().slice(0, 40) || "album";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chartfm-comunidade-${suffix}-${slug}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function drawCommunityAlbumCover(
  ctx: CanvasRenderingContext2D,
  input: AlbumScoreExportInput,
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

function drawCommunityHeaderRight(ctx: CanvasRenderingContext2D, x: number, y: number, fontSize: number) {
  ctx.font = `700 ${fontSize}px ${FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#86868B";
  ctx.fillText("NOTA DA COMUNIDADE", x, y);
}

function drawReviewCountPill(ctx: CanvasRenderingContext2D, count: number, x: number, y: number, fontSize: number) {
  const text = `${count} ${count === 1 ? "review" : "reviews"}`;
  ctx.font = `700 ${fontSize}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  const padX = 18;
  const padY = 10;
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
  return h;
}

function measureScorePill(ctx: CanvasRenderingContext2D, text: string, fontSize: number) {
  ctx.font = `700 ${fontSize}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  const padX = 22;
  const padY = 10;
  return { w: tw + padX * 2, h: fontSize + padY * 2 };
}

function measureReviewCountPill(ctx: CanvasRenderingContext2D, count: number, fontSize: number) {
  const text = `${count} ${count === 1 ? "review" : "reviews"}`;
  ctx.font = `700 ${fontSize}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  const padX = 18;
  const padY = 10;
  return { w: tw + padX * 2, h: fontSize + padY * 2 };
}

/** Desenha label da nota + contagem lado a lado, centralizados, sem sobreposição. */
function drawScoreAndReviewCountRow(
  ctx: CanvasRenderingContext2D,
  scoreText: string,
  sc: string,
  reviewCount: number,
  centerX: number,
  y: number,
  scoreFontSize = 28,
  countFontSize = 24,
  gap = 16,
): number {
  const score = measureScorePill(ctx, scoreText, scoreFontSize);
  const count = measureReviewCountPill(ctx, reviewCount, countFontSize);
  const rowH = Math.max(score.h, count.h);
  const totalW = score.w + gap + count.w;
  const scoreCx = centerX - totalW / 2 + score.w / 2;
  const countCx = centerX + totalW / 2 - count.w / 2;

  drawScorePill(ctx, scoreText, sc, scoreCx, y, scoreFontSize);
  drawReviewCountPill(ctx, reviewCount, countCx, y, countFontSize);

  return y + rowH / 2;
}

function drawCommunityFooter(ctx: CanvasRenderingContext2D, centerX: number, y: number, fontSize: number) {
  ctx.fillStyle = "#86868B";
  ctx.font = `700 ${fontSize}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("CriticsFM · chartfm.com.br/criticsfm", centerX, y);
}

export async function renderAlbumScoreStoryBlob(input: AlbumScoreExportInput): Promise<Blob | null> {
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

  const sc = scoreBadgeColor(input.rating);
  drawCommunityHeaderRight(ctx, W - 80, 120, 22);

  drawEyebrow(ctx, "⭐  AVALIAÇÃO DA COMUNIDADE", W / 2, 248);

  const coverSize = 460;
  const coverX = (W - coverSize) / 2;
  const coverY = 340;

  await drawCommunityAlbumCover(ctx, input, coverX, coverY, coverSize, 26);

  const badgeSize = 158;
  drawSquareScoreBadge(ctx, input.rating, sc, coverX + coverSize - badgeSize + 28, coverY + coverSize - badgeSize + 28, badgeSize, 26, 70);

  ctx.fillStyle = "#1D1D1F";
  ctx.font = `800 60px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const titleLines = wrapText(ctx, input.albumTitle, W - 160, 2);
  let y = coverY + coverSize + 110;
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, y);
    y += 68;
  }

  ctx.fillStyle = "#86868B";
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText(input.albumArtist, W / 2, y + 8);
  y += 72;

  y = drawScoreAndReviewCountRow(ctx, scoreLabel(input.rating).toUpperCase(), sc, input.reviewCount, W / 2, y + 24) + 48;
  drawCommunityFooter(ctx, W / 2, Math.max(y, H - 120), 26);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

export async function renderAlbumScoreSquareBlob(input: AlbumScoreExportInput): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = SQ_W;
  canvas.height = SQ_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bg = await loadImage("/quadrada.png");
  if (bg) {
    ctx.drawImage(bg, 0, 0, SQ_W, SQ_H);
  } else {
    ctx.fillStyle = "#FCFCFD";
    ctx.fillRect(0, 0, SQ_W, SQ_H);
  }

  const sc = scoreBadgeColor(input.rating);
  const u = SQ_W / 1080;
  const pad = Math.round(72 * u);

  drawCommunityHeaderRight(ctx, SQ_W - pad, pad + Math.round(10 * u), Math.round(20 * u));

  const coverSize = Math.round(460 * u);
  const coverX = (SQ_W - coverSize) / 2;
  const coverY = Math.round(200 * u);

  await drawCommunityAlbumCover(ctx, input, coverX, coverY, coverSize, Math.round(26 * u));

  const badgeSize = Math.round(158 * u);
  drawSquareScoreBadge(
    ctx,
    input.rating,
    sc,
    coverX + coverSize - badgeSize + Math.round(28 * u),
    coverY + coverSize - badgeSize + Math.round(28 * u),
    badgeSize,
    Math.round(26 * u),
    Math.round(70 * u),
  );

  ctx.fillStyle = "#1D1D1F";
  ctx.font = `800 ${Math.round(60 * u)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const titleLines = wrapText(ctx, input.albumTitle, SQ_W - Math.round(160 * u), 2);
  let y = coverY + coverSize + Math.round(110 * u);
  for (const line of titleLines) {
    ctx.fillText(line, SQ_W / 2, y);
    y += Math.round(68 * u);
  }

  ctx.fillStyle = "#86868B";
  ctx.font = `500 ${Math.round(30 * u)}px ${FONT}`;
  ctx.fillText(input.albumArtist, SQ_W / 2, y + Math.round(8 * u));
  y += Math.round(56 * u);

  const pillFont = Math.round(28 * u);
  const countFont = Math.round(24 * u);
  y = drawScoreAndReviewCountRow(
    ctx,
    scoreLabel(input.rating).toUpperCase(),
    sc,
    input.reviewCount,
    SQ_W / 2,
    y + Math.round(24 * u),
    pillFont,
    countFont,
    Math.round(16 * u),
  ) + Math.round(48 * u);
  drawCommunityFooter(ctx, SQ_W / 2, Math.max(y, SQ_H - Math.round(72 * u)), countFont);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

export async function renderAlbumScoreTwitterBlob(input: AlbumScoreExportInput): Promise<Blob | null> {
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

  const sc = scoreBadgeColor(input.rating);
  const coverSize = 340;
  const coverX = 180;
  const coverY = Math.round((TW_H - coverSize) / 2);
  const contentX = coverX + coverSize + 56;
  const contentW = TW_W - contentX - 72;

  await drawCommunityAlbumCover(ctx, input, coverX, coverY, coverSize, 22);

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

  drawEyebrowLeft(ctx, "⭐  AVALIAÇÃO DA COMUNIDADE", contentX, coverY + 8, 22);

  ctx.fillStyle = "#1D1D1F";
  ctx.font = `800 46px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const titleLines = wrapText(ctx, input.albumTitle, contentW, 2);
  let y = coverY + 72;
  for (const line of titleLines) {
    ctx.fillText(line, contentX, y);
    y += 52;
  }

  ctx.fillStyle = "#86868B";
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText(input.albumArtist, contentX, y + 6);
  y += 52;

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

  const countText = `${input.reviewCount} ${input.reviewCount === 1 ? "review" : "reviews"}`;
  ctx.font = `700 22px ${FONT}`;
  const countTw = ctx.measureText(countText).width;
  const countX = contentX + pillTw + pillPadX * 2 + 16;
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.beginPath();
  ctx.roundRect(countX, y - pillH / 2, countTw + pillPadX * 2, pillH, 9999);
  ctx.fill();
  ctx.fillStyle = "#3A3A3C";
  ctx.fillText(countText, countX + pillPadX, y);

  ctx.fillStyle = "#86868B";
  ctx.font = `700 22px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("CriticsFM · chartfm.com.br/criticsfm", contentX, TW_H - 56);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

export async function downloadAlbumScoreStory(input: AlbumScoreExportInput): Promise<void> {
  const blob = await renderAlbumScoreStoryBlob(input);
  downloadAlbumScoreBlob(blob, input, "story");
}

export async function downloadAlbumScoreSquare(input: AlbumScoreExportInput): Promise<void> {
  const blob = await renderAlbumScoreSquareBlob(input);
  downloadAlbumScoreBlob(blob, input, "square");
}

export async function downloadAlbumScoreTwitter(input: AlbumScoreExportInput): Promise<void> {
  const blob = await renderAlbumScoreTwitterBlob(input);
  downloadAlbumScoreBlob(blob, input, "twitter");
}

export async function downloadAlbumScore(input: AlbumScoreExportInput, format: ExportFormat): Promise<void> {
  if (format === "story") await downloadAlbumScoreStory(input);
  else if (format === "square") await downloadAlbumScoreSquare(input);
  else await downloadAlbumScoreTwitter(input);
}
