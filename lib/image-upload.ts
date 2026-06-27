const MIME_TO_EXT: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/x-png": "png",
  "image/webp": "webp",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function normalizeImageMime(type: string): string {
  const t = type.trim().toLowerCase();
  if (t === "image/jpg" || t === "image/pjpeg") return "image/jpeg";
  if (t === "image/x-png") return "image/png";
  return t;
}

export function mimeFromFilename(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXT_TO_MIME[ext] ?? null;
}

export function resolveUploadImage(
  file: File,
): { mime: string; ext: "jpg" | "png" | "webp" } | { error: string } {
  const normalized = normalizeImageMime(file.type);
  if (MIME_TO_EXT[normalized]) {
    return { mime: normalized, ext: MIME_TO_EXT[normalized] };
  }

  const fromName = mimeFromFilename(file.name);
  if (fromName && MIME_TO_EXT[fromName]) {
    return { mime: fromName, ext: MIME_TO_EXT[fromName] };
  }

  return { error: "Formato inválido. Use JPG, PNG ou WebP." };
}
