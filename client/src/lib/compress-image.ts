export async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/") && file.type !== "") {
    throw new Error("Lütfen bir görsel dosyası seçin");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("Görsel çok büyük (en fazla 12MB)");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Bu görsel formatı desteklenmiyor. JPEG veya PNG deneyin.");
  }

  const maxSize = 1280;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Görsel işlenemedi");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.72);
}
