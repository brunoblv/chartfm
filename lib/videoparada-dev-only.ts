/**
 * O módulo de geração de vídeo (Videoparada/Disk MTV — Remotion + ffmpeg + yt-dlp) fica
 * desligado em produção: o render é pesado demais para a VPS de 1.9 GB de RAM e competia
 * por memória com o build/deploy (ver incidente 2026-07-26, build travando em "Generating
 * static pages"). O código continua completo para uso local — só a exposição em produção
 * é bloqueada aqui.
 */
export function isVideoparadaModuleEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}
