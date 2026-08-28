import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

export function getUploadsDir() {
  return uploadsDir;
}

export async function saveImageDataUrl(dataUrl: string): Promise<string> {
  const match = dataUrl.match(/^data:image\/([\w+.-]+);base64,(.+)$/i);
  if (!match) {
    throw new Error("Geçersiz görsel formatı");
  }

  const mime = match[1].toLowerCase();
  const ext =
    mime.includes("png") ? "png" :
    mime.includes("webp") ? "webp" :
    "jpg";

  const base64 = match[2].replace(/\s/g, "");
  const buffer = Buffer.from(base64, "base64");

  if (buffer.length === 0) {
    throw new Error("Görsel verisi boş");
  }
  if (buffer.length > 6 * 1024 * 1024) {
    throw new Error("Görsel 6MB sınırını aşıyor");
  }

  const filename = `${nanoid()}.${ext}`;
  await fs.promises.writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}

export async function persistProductImageUrl(imageUrl?: string): Promise<string | undefined> {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith("/uploads/")) return imageUrl;
  if (imageUrl.startsWith("data:image/")) {
    return saveImageDataUrl(imageUrl);
  }
  return imageUrl;
}
