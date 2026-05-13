import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, extname } from "path";

export const runtime = "nodejs";

const UPLOAD_DIR = join(process.cwd(), "uploads", "parada-logos");

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (filename.includes("..") || filename.includes("/")) {
    return new NextResponse(null, { status: 400 });
  }

  const filePath = join(UPLOAD_DIR, filename);
  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  const ext = extname(filename).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
