/** Converte a foto para JPEG no browser (reduz tamanho e normaliza MIME). */
export async function normalizeAvatarFile(
  file: File,
  maxBytes = 900 * 1024,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (file.size > maxBytes) {
        const scale = Math.min(1, Math.sqrt(maxBytes / file.size));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Não foi possível processar a imagem."));
            return;
          }
          resolve(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Formato não suportado. Use JPG, PNG ou WebP."));
    };
    img.src = url;
  });
}
