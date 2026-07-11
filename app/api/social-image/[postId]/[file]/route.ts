import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { socialImageDiskPath } from "@/lib/social/image-path";

/**
 * Serve as artes geradas para redes sociais (public/generated/social/...).
 * Em produção o Next não serve arquivos adicionados a public/ depois do build,
 * então esta rota lê do disco em runtime. Precisa ser pública (sem auth):
 * Facebook/Instagram/Threads baixam a imagem por esta URL na hora de publicar.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ postId: string; file: string }> }) {
  const { postId, file } = await params;
  const diskPath = socialImageDiskPath(`/api/social-image/${postId}/${file}`);
  if (!diskPath) return NextResponse.json({ error: "Arquivo inválido" }, { status: 404 });

  try {
    const buffer = await fs.readFile(diskPath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        // curto: a arte pode ser regerada com o mesmo nome de arquivo
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Arte não encontrada" }, { status: 404 });
  }
}
