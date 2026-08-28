async function loadImageSource(file: File): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, width, height) => {
          ctx.drawImage(bitmap, 0, 0, width, height);
          bitmap.close();
        },
        cleanup: () => {
          try {
            bitmap.close();
          } catch {
            // already closed
          }
        },
      };
    } catch {
      // iOS HEIC and some Android formats fall back to Image().
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        draw: (ctx, width, height) => {
          ctx.drawImage(img, 0, 0, width, height);
        },
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Bu görsel formatı desteklenmiyor. JPEG veya PNG deneyin."));
    };

    img.src = objectUrl;
  });
}

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/") && file.type !== "") {
    throw new Error("Lütfen bir görsel dosyası seçin");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("Görsel çok büyük (en fazla 15MB)");
  }

  const source = await loadImageSource(file);
  const maxSize = 1280;
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    source.cleanup();
    throw new Error("Görsel işlenemedi");
  }

  try {
    source.draw(ctx, width, height);
    return canvas.toDataURL("image/jpeg", 0.75);
  } finally {
    source.cleanup();
  }
}
