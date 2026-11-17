"use client";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { ART_H, ART_W, NewsPostArt, type NewsArtPost } from "./NewsPostArt";

function preloadImage(url: string | null): Promise<void> {
  if (!url) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

/**
 * Tira um quadro do vídeo (por padrão em 1s) para usar como fundo da área de
 * vídeo na arte exportada — essa arte vira a capa do Reel. Mesma origem, então
 * o canvas não fica "tainted".
 */
export async function captureVideoFrame(url: string, atSeconds = 1): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    const done = (v: string | null) => {
      video.removeAttribute("src");
      video.load();
      resolve(v);
    };
    const timer = setTimeout(() => done(null), 15000);
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(atSeconds, Math.max(0, (video.duration || 0) - 0.1));
    };
    video.onseeked = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        done(canvas.toDataURL("image/jpeg", 0.9));
      } catch {
        done(null);
      }
    };
    video.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    video.src = url;
  });
}

/** Gera os PNGs 1080x1440 de todas as artes do post, na ordem dos slides. */
export async function exportNewsArt(post: NewsArtPost, count: number, videoFrame: string | null): Promise<Blob[]> {
  const html2canvas = (await import("html2canvas")).default;
  await Promise.all([preloadImage(post.photoUrl), preloadImage(videoFrame)]);
  if (document.fonts?.ready) await document.fonts.ready;

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, { position: "fixed", left: "-20000px", top: "0", width: `${ART_W}px`, height: `${ART_H}px`, pointerEvents: "none" });
  document.body.appendChild(host);
  const root = createRoot(host);

  const blobs: Blob[] = [];
  try {
    for (let i = 0; i < count; i++) {
      flushSync(() => root.render(<NewsPostArt post={post} index={i} mode="export" videoFrame={videoFrame} />));
      await nextFrame();
      await nextFrame();
      const node = host.firstElementChild as HTMLElement | null;
      if (!node) throw new Error("render vazio");
      const canvas = await html2canvas(node, {
        scale: 1,
        width: ART_W,
        height: ART_H,
        windowWidth: ART_W,
        windowHeight: ART_H,
        backgroundColor: null,
        logging: false,
        useCORS: true,
      });
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("falha ao gerar PNG");
      blobs.push(blob);
    }
  } finally {
    root.unmount();
    host.remove();
  }
  return blobs;
}
