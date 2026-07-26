import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { VIDEOPARADA_SHORTS_SECONDS } from "@/lib/videoparada-shared";

const execFileAsync = promisify(execFile);

export type ChorusWindow = {
  startSec: number;
  endSec: number;
  /** Energia média (RMS) da janela vencedora. */
  energy: number;
  strategy: "chorus-energy" | "heuristic-35" | "manual";
};

/**
 * Detecta trecho de maior energia sonora (proxy de refrão) via PCM mono.
 * Fallback: ~35% da duração.
 */
export async function detectChorusWindow(
  inputPath: string,
  opts: {
    clipSeconds?: number;
    ffmpegPath?: string;
    /** Resolução da análise em segundos (padrão 0.5s). */
    hopSec?: number;
  } = {},
): Promise<ChorusWindow> {
  const clipLen = Math.max(1, opts.clipSeconds ?? VIDEOPARADA_SHORTS_SECONDS);
  const hopSec = opts.hopSec ?? 0.5;
  const sampleRate = 22050;
  const ffmpeg = opts.ffmpegPath ?? "ffmpeg";

  let pcm: Buffer;
  try {
    const { stdout } = await execFileAsync(
      ffmpeg,
      [
        "-v",
        "error",
        "-i",
        inputPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        String(sampleRate),
        "-f",
        "f32le",
        "pipe:1",
      ],
      {
        encoding: "buffer",
        maxBuffer: 200 * 1024 * 1024,
        windowsHide: true,
      },
    );
    pcm = stdout as unknown as Buffer;
  } catch {
    return heuristicWindow(0, clipLen); // duration unknown — caller should clamp
  }

  const sampleCount = Math.floor(pcm.length / 4);
  if (sampleCount < sampleRate) {
    return heuristicWindow(sampleCount / sampleRate, clipLen);
  }

  const durationSec = sampleCount / sampleRate;
  const hopSamples = Math.max(1, Math.floor(hopSec * sampleRate));
  const windowSamples = Math.max(hopSamples, Math.floor(clipLen * sampleRate));

  // Energia por hop (RMS)
  const hopEnergies: number[] = [];
  for (let i = 0; i + hopSamples <= sampleCount; i += hopSamples) {
    let sum = 0;
    for (let j = 0; j < hopSamples; j++) {
      const v = pcm.readFloatLE((i + j) * 4);
      sum += v * v;
    }
    hopEnergies.push(Math.sqrt(sum / hopSamples));
  }

  if (!hopEnergies.length) {
    return heuristicWindow(durationSec, clipLen);
  }

  const hopsPerWindow = Math.max(1, Math.round(clipLen / hopSec));
  let bestStartHop = 0;
  let bestEnergy = -1;

  for (let h = 0; h + hopsPerWindow <= hopEnergies.length; h++) {
    let sum = 0;
    for (let k = 0; k < hopsPerWindow; k++) sum += hopEnergies[h + k];
    const avg = sum / hopsPerWindow;
    if (avg > bestEnergy) {
      bestEnergy = avg;
      bestStartHop = h;
    }
  }

  // Evita intro/outro extremos (primeiros/últimos ~8%)
  const minStart = durationSec * 0.08;
  const maxStart = Math.max(0, durationSec - clipLen - durationSec * 0.05);
  let startSec = bestStartHop * hopSec;
  startSec = Math.min(Math.max(startSec, minStart), maxStart);
  const endSec = Math.min(durationSec, startSec + clipLen);

  // Se o pico for fraco demais vs mediana, cai na heurística 35%
  const median =
    [...hopEnergies].sort((a, b) => a - b)[Math.floor(hopEnergies.length / 2)] ?? 0;
  if (bestEnergy < median * 1.15) {
    return { ...heuristicWindow(durationSec, clipLen), strategy: "heuristic-35" };
  }

  return {
    startSec,
    endSec,
    energy: bestEnergy,
    strategy: "chorus-energy",
  };
}

function heuristicWindow(durationSec: number, clipLen: number): ChorusWindow {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return { startSec: 0, endSec: clipLen, energy: 0, strategy: "heuristic-35" };
  }
  const maxStart = Math.max(0, durationSec - clipLen);
  const startSec = Math.min(durationSec * 0.35, maxStart);
  return {
    startSec,
    endSec: Math.min(durationSec, startSec + clipLen),
    energy: 0,
    strategy: "heuristic-35",
  };
}
