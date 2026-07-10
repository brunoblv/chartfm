/** Proporção e tamanho ideal do banner do header (15:4). */
export const COMMUNITY_COVER_WIDTH = 1500;
export const COMMUNITY_COVER_HEIGHT = 400;
export const COMMUNITY_COVER_ASPECT = COMMUNITY_COVER_WIDTH / COMMUNITY_COVER_HEIGHT;

export const COMMUNITY_COVER_SIZE_LABEL = `${COMMUNITY_COVER_WIDTH}×${COMMUNITY_COVER_HEIGHT} px`;

export const COMMUNITY_COVER_MAX_BYTES = 2 * 1024 * 1024;

export function communityCoverSizeHint(): string {
  return `Recomendado: ${COMMUNITY_COVER_SIZE_LABEL} (proporção 15:4). JPG ou PNG, até 2 MB.`;
}

export async function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

export async function validateCommunityCoverFile(
  file: File,
): Promise<{ error?: string; warning?: string }> {
  if (!file.type.startsWith("image/")) {
    return { error: "Envie um arquivo de imagem (JPG ou PNG)." };
  }
  if (file.size > COMMUNITY_COVER_MAX_BYTES) {
    return { error: "Imagem muito grande (máx. 2 MB)." };
  }

  const dataUrl = await readImageFileAsDataUrl(file);
  const dims = await loadImageDimensions(dataUrl);
  if (!dims) return {};

  const ratio = dims.width / dims.height;
  const target = COMMUNITY_COVER_ASPECT;
  const tolerance = 0.35;
  if (Math.abs(ratio - target) > tolerance) {
    return {
      warning: `Proporção ideal 15:4 (${COMMUNITY_COVER_SIZE_LABEL}). Sua imagem é ${dims.width}×${dims.height} px, será exibida com recorte automático.`,
    };
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
