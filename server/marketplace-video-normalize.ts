import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const MAX_MP4_BYTES = 60 * 1024 * 1024;

/**
 * An MP4 container may contain HEVC or unsupported audio, which iOS/Android
 * and browser Reel players cannot consistently decode. Normalize before
 * saving the video so every client receives a streamable H.264/AAC MP4.
 */
export async function normalizeMarketplaceVideo(input: Buffer): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(tmpdir(), "b2b-reels-"));
  const source = path.join(dir, "source.mp4");
  const output = path.join(dir, "compatible.mp4");
  try {
    await fs.writeFile(source, input);

    await new Promise<void>((resolve, reject) => {
      const child = spawn("ffmpeg", [
        "-nostdin", "-y", "-v", "error",
        "-i", source, "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", "scale=w='min(1080,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
        "-c:v", "libx264", "-profile:v", "main", "-level:v", "4.0",
        "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "24",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
        "-movflags", "+faststart", output,
      ], { stdio: ["ignore", "ignore", "pipe"] });

      let diagnostic = "";
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, 180_000);
      child.stderr.on("data", chunk => {
        diagnostic = (diagnostic + String(chunk)).slice(-4000);
      });
      child.once("error", error => {
        clearTimeout(timeout);
        console.error("Marketplace video conversion process error:", error);
        reject(new Error("Video dönüştürücü başlatılamadı. Lütfen daha sonra tekrar deneyin."));
      });
      child.once("close", code => {
        clearTimeout(timeout);
        if (code === 0) return resolve();
        console.error("Marketplace MP4 conversion failed:", diagnostic);
        reject(new Error(timedOut
          ? "Video dönüştürme süresi aşıldı. Daha kısa bir MP4 yükleyin."
          : "Video H.264/AAC MP4 formatına dönüştürülemedi. Geçerli bir MP4 yükleyin."));
      });
    });

    const result = await fs.readFile(output);
    if (result.length < 24 || result.length > MAX_MP4_BYTES) {
      throw new Error("Dönüştürülen video 60 MB sınırını aşıyor.");
    }
    return result;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
