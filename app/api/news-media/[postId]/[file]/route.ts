import fs from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { newsMediaContentType, newsMediaDiskPath } from "@/lib/news-posts/media";

export const runtime = "nodejs";

/**
 * Serve a mídia da central de notícias. Pública (sem auth) porque o Instagram
 * baixa as artes/vídeo por URL na hora de publicar. Suporta Range para o
 * <video> do editor conseguir avançar/voltar.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ postId: string; file: string }> }) {
  const { postId, file } = await params;
  const disk = newsMediaDiskPath(postId, file);
  if (!disk) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(disk);
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": newsMediaContentType(file),
    "Accept-Ranges": "bytes",
    // curto: o arquivo pode ser regerado com o mesmo nome
    "Cache-Control": "public, max-age=60",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = buffer.length;
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new NextResponse(new Uint8Array(buffer.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  return new NextResponse(new Uint8Array(buffer), { headers: { ...headers, "Content-Length": String(buffer.length) } });
}
