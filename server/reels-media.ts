import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Express, RequestHandler } from "express";
import { pool } from "./db";
import { getUploadsDir, saveVideoDataUrl, ensureReelVideoCompatibility } from "./image-storage";

const VIDEO_PREFIX = "b2b_reels_video_";
const VIDEO_ID = /^[a-f0-9]{32}$/;

// Mobile video assets must survive independent Railway service deployments.
// Videos are capped at 10 MB; use shared object storage when the catalog grows.
export async function saveCompatibleReelVideo(raw: string): Promise<string> {
  if (!pool) throw new Error("Veritabanı bağlantısı bulunamadı");
  const original = await saveVideoDataUrl(raw);
  const compatible = await ensureReelVideoCompatibility(original);
  if (!compatible.endsWith("-ios.mp4")) {
    throw new Error("Video H.264/AAC MP4 formatına dönüştürülemedi. Lütfen MP4 (H.264) dosyası yükleyin.");
  }
  const filename = path.basename(compatible);
  const fullPath = path.join(getUploadsDir(), filename);
  const bytes = await fs.promises.readFile(fullPath);
  if (bytes.length < 100 || bytes.length > 10 * 1024 * 1024) {
    throw new Error("Dönüştürülmüş MP4 dosyası 10 MB sınırının dışında.");
  }
  const id = randomBytes(16).toString("hex");
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ($1,$2,NOW())`,
    [VIDEO_PREFIX + id, "data:video/mp4;base64," + bytes.toString("base64")],
  );
  // Local uploads are temporary inputs, not permanent video storage.
  await Promise.all([original, compatible].map(async (url) => {
    if (url.startsWith("/uploads/")) {
      await fs.promises.rm(path.join(getUploadsDir(), path.basename(url)), { force: true }).catch(() => undefined);
    }
  }));
  return `/api/public/reels/media/${id}`;
}

export async function migrateLegacyReelVideo(url: string): Promise<string> {
  if (!/^\/uploads\/[A-Za-z0-9_-]+\.(?:mp4|mov|m4v|webm)$/i.test(url)) {
    throw new Error("Yalnızca önceden yüklenmiş video dosyaları dönüştürülebilir.");
  }
  const file = path.basename(url);
  const full = path.join(getUploadsDir(), file);
  let bytes: Buffer;
  try {
    bytes = await fs.promises.readFile(full);
  } catch {
    const response = await fetch(`https://b2b.ecalisgan.com${url}`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Eski video dosyasına erişilemedi (" + response.status + ").");
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > 10 * 1024 * 1024) throw new Error("Eski video 10 MB sınırını aşıyor.");
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (bytes.length > 10 * 1024 * 1024) throw new Error("Eski video 10 MB sınırını aşıyor.");
  const ext = file.split(".").pop()?.toLowerCase();
  const mime = ext === "webm" ? "video/webm" : ext === "mov" ? "video/quicktime" : "video/mp4";
  return saveCompatibleReelVideo(`data:${mime};base64,${bytes.toString("base64")}`);
}

export function registerReelMediaRoutes(app: Express, _requireAdmin: RequestHandler) {
  app.get("/api/public/reels/media/:id", async (req, res) => {
    const id = String(req.params.id || "");
    if (!VIDEO_ID.test(id) || !pool) return res.status(404).end();
    try {
      const row = await pool.query("SELECT value FROM platform_settings WHERE key=$1 LIMIT 1", [VIDEO_PREFIX + id]);
      const raw = String(row.rows[0]?.value || "");
      const prefix = "data:video/mp4;base64,";
      if (!raw.startsWith(prefix)) return res.status(404).end();
      const bytes = Buffer.from(raw.slice(prefix.length), "base64");
      const length = bytes.length;
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("X-Content-Type-Options", "nosniff");
      const range = String(req.headers.range || "");
      if (range.startsWith("bytes=")) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2])) {
          res.setHeader("Content-Range", `bytes */${length}`);
          return res.status(416).end();
        }
        let start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
        let end = match[1] ? (match[2] ? Number(match[2]) : length - 1) : length - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= length || end < start) {
          res.setHeader("Content-Range", `bytes */${length}`);
          return res.status(416).end();
        }
        end = Math.min(end, length - 1);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${length}`);
        res.setHeader("Content-Length", String(end - start + 1));
        return res.status(206).end(bytes.subarray(start, end + 1));
      }
      res.setHeader("Content-Length", String(length));
      return res.status(200).end(bytes);
    } catch (error) {
      console.error("Reels video delivery failed:", error);
      return res.status(500).end();
    }
  });
}
