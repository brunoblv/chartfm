const MAX_EDGE_PX = 768;
const JPEG_QUALITY = 0.92;

function fitDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number; resized: boolean } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height, resized: false };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    resized: true,
  };
}

/** Converte a foto para JPEG no browser, mantendo resolução suficiente para telas retina. */
export async function normalizeAvatarFile(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);

      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;
      const { width, height, resized } = fitDimensions(naturalW, naturalH, MAX_EDGE_PX);

      // JPEG já pequeno e na resolução certa — evita recompressão desnecessária
      if (
        !resized &&
        (file.type === "image/jpeg" || file.type === "image/jpg") &&
        file.size <= 800 * 1024
      ) {
        resolve(file);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Não foi possível processar a imagem."));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Não foi possível processar a imagem."));
            return;
          }
          resolve(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Formato não suportado. Use JPG, PNG ou WebP."));
    };
    img.src = url;
  });
}
