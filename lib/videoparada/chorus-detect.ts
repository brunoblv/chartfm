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
 * Janela centrada no pico, duração exata de `clipSeconds` (ex.: 11s landscape).
 * Fallback: ~35% da duração.
 */
export async function detectChorusWindow(
  inputPath: string,
  opts: {
    clipSeconds?: number;
    ffmpegPath?: string;
    /** Resolução da análise em segundos (padrão 0.25s). */
    hopSec?: number;
  } = {},
): Promise<ChorusWindow> {
  const clipLen = Math.max(1, opts.clipSeconds ?? VIDEOPARADA_SHORTS_SECONDS);
  const hopSec = opts.hopSec ?? 0.25;
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
    return heuristicWindow(0, clipLen);
  }

  const sampleCount = Math.floor(pcm.length / 4);
  if (sampleCount < sampleRate) {
    return heuristicWindow(sampleCount / sampleRate, clipLen);
  }

  const durationSec = sampleCount / sampleRate;
  if (durationSec <= clipLen + 0.5) {
    return {
      startSec: 0,
      endSec: Math.min(durationSec, clipLen),
      energy: 0,
      strategy: "heuristic-35",
    };
  }

  const hopSamples = Math.max(1, Math.floor(hopSec * sampleRate));

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

  // Suaviza com média móvel (~1s) para achar o "corpo" do refrão, não um spike
  const smoothHops = Math.max(1, Math.round(1 / hopSec));
  const smoothed: number[] = hopEnergies.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let k = -Math.floor(smoothHops / 2); k <= Math.floor(smoothHops / 2); k++) {
      const j = i + k;
      if (j >= 0 && j < hopEnergies.length) {
        sum += hopEnergies[j];
        n++;
      }
    }
    return n ? sum / n : 0;
  });

  // Busca pico no miolo da música (12%–85%) — evita intro/outro
  const minHop = Math.floor((durationSec * 0.12) / hopSec);
  const maxHop = Math.floor((durationSec * 0.85) / hopSec);
  let bestHop = Math.min(Math.max(0, minHop), smoothed.length - 1);
  let bestEnergy = -1;
  for (let h = minHop; h <= Math.min(maxHop, smoothed.length - 1); h++) {
    if (smoothed[h] > bestEnergy) {
      bestEnergy = smoothed[h];
      bestHop = h;
    }
  }

  const peakSec = bestHop * hopSec;
  // Centraliza a janela no pico; garante duração exata clipLen
  const maxStart = Math.max(0, durationSec - clipLen);
  let startSec = peakSec - clipLen * 0.35; // pico um pouco depois do início da janela
  startSec = Math.min(Math.max(0, startSec), maxStart);
  const endSec = startSec + clipLen;

  const median =
    [...smoothed].sort((a, b) => a - b)[Math.floor(smoothed.length / 2)] ?? 0;
  // Só cai na heurística se o pico for quase flat (sem dinâmica)
  if (bestEnergy < median * 1.05) {
    return { ...heuristicWindow(durationSec, clipLen), strategy: "heuristic-35" };
  }

  return {
    startSec,
    endSec: Math.min(durationSec, endSec),
    energy: bestEnergy,
    strategy: "chorus-energy",
  };
}

function heuristicWindow(durationSec: number, clipLen: number): ChorusWindow {
  const maxStart = Math.max(0, durationSec - clipLen);
  const startSec = Math.min(Math.max(0, durationSec * 0.35), maxStart);
  return {
    startSec,
    endSec: Math.min(durationSec || clipLen, startSec + clipLen),
    energy: 0,
    strategy: "heuristic-35",
  };
}
