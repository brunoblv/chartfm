import sharp from "sharp";

export type FaceBoostRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  weight: number;
};

/**
 * Estima região de “rosto/assunto” por blob de pele (YCbCr) sem modelo ML.
 * Usado como `boost` no smartcrop — prioriza pessoas no crop vertical.
 */
export async function detectSkinBoostRegions(
  imagePath: string,
): Promise<FaceBoostRegion[]> {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const grid = 32;
  const cellW = Math.max(1, Math.floor(w / grid));
  const cellH = Math.max(1, Math.floor(h / grid));
  const scores = new Float32Array(grid * grid);

  for (let cy = 0; cy < grid; cy++) {
    for (let cx = 0; cx < grid; cx++) {
      let skin = 0;
      let total = 0;
      const x0 = cx * cellW;
      const y0 = cy * cellH;
      const x1 = Math.min(w, x0 + cellW);
      const y1 = Math.min(h, y0 + cellH);
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = (y * w + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          total++;
          if (isSkinTone(r, g, b)) skin++;
        }
      }
      scores[cy * grid + cx] = total > 0 ? skin / total : 0;
    }
  }

  // Encontra a melhor janela ~30%×40% da grade (proporção de rosto/torso)
  const winW = Math.max(3, Math.round(grid * 0.28));
  const winH = Math.max(4, Math.round(grid * 0.4));
  let best = { cx: 0, cy: 0, score: -1 };

  for (let cy = 0; cy <= grid - winH; cy++) {
    for (let cx = 0; cx <= grid - winW; cx++) {
      let sum = 0;
      for (let y = 0; y < winH; y++) {
        for (let x = 0; x < winW; x++) {
          sum += scores[(cy + y) * grid + (cx + x)];
        }
      }
      const avg = sum / (winW * winH);
      if (avg > best.score) best = { cx, cy, score: avg };
    }
  }

  // Sem pele relevante → sem boost
  if (best.score < 0.08) return [];

  return [
    {
      x: best.cx * cellW,
      y: best.cy * cellH,
      width: winW * cellW,
      height: winH * cellH,
      weight: Math.min(1, 0.4 + best.score),
    },
  ];
}

/** Heurística clássica de pele em RGB aproximando YCbCr. */
function isSkinTone(r: number, g: number, b: number): boolean {
  if (r < 60 || g < 30 || b < 15) return false;
  if (r < g || r < b) return false;
  if (Math.max(r, g, b) - Math.min(r, g, b) < 15) return false;
  if (Math.abs(r - g) < 15) return false;
  // CbCr-ish
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return y > 40 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
}
