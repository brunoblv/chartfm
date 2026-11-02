import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseImageDataUrl } from "@/lib/community-image";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await prisma.community.findUnique({ where: { slug }, select: { coverImageUrl: true } });
  const raw = row?.coverImageUrl?.trim();
  if (!row || !raw) return new NextResponse(null, { status: 404 });
  if (/^https?:\/\//.test(raw) || raw.startsWith("/")) {
    return NextResponse.redirect(new URL(raw, request.url), 302);
  }
  const parsed = parseImageDataUrl(raw);
  if (!parsed) return new NextResponse(null, { status: 404 });
  // A URL leva ?v=<versão>; quando a imagem muda, a URL muda.
  const versioned = new URL(request.url).searchParams.has("v");
  return new NextResponse(new Uint8Array(parsed.bytes), {
    headers: {
      "Content-Type": parsed.mime,
      "Cache-Control": versioned
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
