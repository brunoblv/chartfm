/** Proporção e tamanho ideal do banner do header (15:4). */
export const COMMUNITY_COVER_WIDTH = 1500;
export const COMMUNITY_COVER_HEIGHT = 400;
export const COMMUNITY_COVER_ASPECT = COMMUNITY_COVER_WIDTH / COMMUNITY_COVER_HEIGHT;

export const COMMUNITY_COVER_SIZE_LABEL = `${COMMUNITY_COVER_WIDTH}×${COMMUNITY_COVER_HEIGHT} px`;

export const COMMUNITY_COVER_MAX_BYTES = 2 * 1024 * 1024;

export type CommunityCoverValidation =
  | { error: "not_image" | "too_large"; warning?: undefined; width?: undefined; height?: undefined }
  | { error?: undefined; warning: "aspect"; width: number; height: number }
  | { error?: undefined; warning?: undefined; width?: undefined; height?: undefined };

export async function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

export async function validateCommunityCoverFile(file: File): Promise<CommunityCoverValidation> {
  if (!file.type.startsWith("image/")) {
    return { error: "not_image" };
  }
  if (file.size > COMMUNITY_COVER_MAX_BYTES) {
    return { error: "too_large" };
  }

  const dataUrl = await readImageFileAsDataUrl(file);
  const dims = await loadImageDimensions(dataUrl);
  if (!dims) return {};

  const ratio = dims.width / dims.height;
  const target = COMMUNITY_COVER_ASPECT;
  const tolerance = 0.35;
  if (Math.abs(ratio - target) > tolerance) {
    return { warning: "aspect", width: dims.width, height: dims.height };
  }
  return {};
}

function loadImageDimensions(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
