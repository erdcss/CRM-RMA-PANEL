import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { nanoid } from "nanoid";

const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads");
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


export async function saveVideoDataUrl(dataUrl: string): Promise<string> {
  const match = dataUrl.match(/^data:video\/([\w+.-]+);base64,(.+)$/i);
  if (!match) {
    throw new Error("Geçersiz video formatı");
  }

  const mime = match[1].toLowerCase();
  const ext =
    mime.includes("webm") ? "webm" :
    mime.includes("quicktime") ? "mov" :
    mime.includes("m4v") ? "m4v" :
    "mp4";

  const base64 = match[2].replace(/\s/g, "");
  const buffer = Buffer.from(base64, "base64");

  if (buffer.length === 0) {
    throw new Error("Video verisi boş");
  }
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("Video 10MB sınırını aşıyor");
  }

  const filename = `${nanoid()}.${ext}`;
  await fs.promises.writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}


async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Video dönüştürme zaman aşımına uğradı"));
    }, 90_000);

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr || `ffmpeg çıkış kodu: ${code}`));
    });
  });
}

const reelCompatibilityJobs = new Map<string, Promise<string>>();

export async function ensureReelVideoCompatibility(videoUrl: string): Promise<string> {
  const clean = typeof videoUrl === "string" ? videoUrl.trim() : "";
  if (!clean.startsWith("/uploads/")) return clean;

  const filename = path.basename(clean);
  const sourcePath = path.join(uploadsDir, filename);

  try {
    const stat = await fs.promises.stat(sourcePath);
    if (!stat.isFile() || stat.size === 0) return clean;
  } catch {
    return clean;
  }

  const stem = filename.replace(/\.[^.]+$/, "");
  const compatFilename = `${stem}-ios.mp4`;
  const compatPath = path.join(uploadsDir, compatFilename);
  const compatUrl = `/uploads/${compatFilename}`;

  try {
    const stat = await fs.promises.stat(compatPath);
    if (stat.isFile() && stat.size > 0) return compatUrl;
  } catch {
    // İlk istekte oluşturulur.
  }

  const existing = reelCompatibilityJobs.get(sourcePath);
  if (existing) return existing;

  const job = (async () => {
    const tempPath = `${compatPath}.tmp.mp4`;

    try {
      await fs.promises.rm(tempPath, { force: true }).catch(() => undefined);

      await runFfmpeg([
        "-y",
        "-i",
        sourcePath,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v",
        "libx264",
        "-tag:v",
        "avc1",
        "-profile:v",
        "main",
        "-level",
        "4.0",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "veryfast",
        "-crf",
        "22",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        tempPath,
      ]);

      await fs.promises.rename(tempPath, compatPath);
      return compatUrl;
    } catch (error) {
      console.error("Reels iOS compatibility conversion failed:", error);
      await fs.promises.rm(tempPath, { force: true }).catch(() => undefined);
      return clean;
    } finally {
      reelCompatibilityJobs.delete(sourcePath);
    }
  })();

  reelCompatibilityJobs.set(sourcePath, job);
  return job;
}
