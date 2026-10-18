import { randomBytes } from "node:crypto";
import type { Express, RequestHandler } from "express";
import { pool } from "./db";

// Images live in Postgres rather than Railway's ephemeral filesystem. The mobile
// feed receives only small image URLs and never downloads base64 in the JSON.
const MEDIA_PREFIX = "b2b_home_media_";
const LAYOUT_KEY = "b2b_home_layout";
const imageDataPattern = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/s;
const validId = /^[a-f0-9]{32}$/;

function safeString(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

type Banner = { id: string; title: string; subtitle: string; buttonText: string; imageId: string };
type CategoryCard = { category: string; label: string; imageId: string; tags: string[] };

export type MobileHomeLayout = {
  banners: Banner[];
  categoryCards: CategoryCard[];
  ledgerTileImageId: string;
  sliderAutoPlay: boolean;
  sliderIntervalMs: number;
};

export function normalizeHomeLayout(raw: any): MobileHomeLayout {
  const input = raw && typeof raw === "object" ? raw : {};
  const banners = (Array.isArray(input.banners) ? input.banners : []).slice(0, 12).map((item: any) => ({
    id: validId.test(String(item?.id || "")) ? String(item.id) : randomBytes(16).toString("hex"),
    title: safeString(item?.title, 120),
    subtitle: safeString(item?.subtitle, 240),
    buttonText: safeString(item?.buttonText, 45),
    imageId: validId.test(String(item?.imageId || "")) ? String(item.imageId) : "",
  }));
  const categoryCards = (Array.isArray(input.categoryCards) ? input.categoryCards : []).slice(0, 30).map((item: any) => ({
    category: safeString(item?.category, 80),
    label: safeString(item?.label, 80),
    imageId: validId.test(String(item?.imageId || "")) ? String(item.imageId) : "",
    tags: [...new Set((Array.isArray(item?.tags) ? item.tags : []).filter((tag: unknown): tag is string => typeof tag === "string").map((tag: string) => safeString(tag, 60)).filter(Boolean))].slice(0, 30),
  })).filter((item: CategoryCard) => item.category);
  const n = Number(input.sliderIntervalMs);
  return {
    banners,
    categoryCards,
    ledgerTileImageId: validId.test(String(input.ledgerTileImageId || '')) ? String(input.ledgerTileImageId) : '',
    sliderAutoPlay: input.sliderAutoPlay !== false,
    sliderIntervalMs: Number.isFinite(n) ? Math.min(15000, Math.max(2500, Math.round(n))) : 5000,
  };
}

export function homepageImageUrl(id: string) {
  return validId.test(id) ? `/api/public/homepage/media/${id}` : null;
}

export async function getMobileHomeLayout(): Promise<MobileHomeLayout> {
  if (!pool) return normalizeHomeLayout({});
  const result = await pool.query("SELECT value FROM platform_settings WHERE key = $1", [LAYOUT_KEY]);
  if (!result.rows[0]?.value) return normalizeHomeLayout({});
  try {
    return normalizeHomeLayout(JSON.parse(String(result.rows[0].value)));
  } catch {
    return normalizeHomeLayout({});
  }
}

export async function saveMobileHomeLayout(raw: unknown): Promise<MobileHomeLayout> {
  if (!pool) throw new Error("Veritabanı bağlantısı bulunamadı");
  const result = normalizeHomeLayout(raw);
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_at) VALUES ($1,$2,NOW())
     ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
    [LAYOUT_KEY, JSON.stringify(result)],
  );
  return result;
}

// Read intrinsic dimensions without relying on MIME headers supplied by clients.
function imageDimensions(bytes: Buffer, mime: string): { width: number; height: number } | null {
  if (mime === "image/png" && bytes.length >= 24) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (mime === "image/gif" && bytes.length >= 10) {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  if (mime === "image/webp" && bytes.length >= 30) {
    const type = bytes.toString("ascii", 12, 16);
    if (type === "VP8X") return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (type === "VP8 " && bytes.length >= 30) return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    if (type === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      return { width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]), height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6)) };
    }
  }
  if (mime === "image/jpeg") {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0xff) { i++; continue; }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { i += 2; continue; }
      const len = bytes.readUInt16BE(i + 2);
      if (len < 2 || i + 2 + len > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        return { width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

export function registerHomepageMediaRoutes(app: Express, requireAdmin: RequestHandler) {
  app.post("/api/admin/homepage/media", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    const raw = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
    const match = imageDataPattern.exec(raw);
    if (!match) return res.status(400).json({ error: "PNG, JPEG, WebP veya GIF görsel yükleyin." });
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length < 20 || bytes.length > 3 * 1024 * 1024) {
      return res.status(413).json({ error: "Görsel boyutu en fazla 3 MB olabilir." });
    }
    // Reject invalid image contents before persisting.
    const mime = match[1];
    const isPng = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const isGif = bytes.subarray(0,3).toString("ascii") === "GIF";
    const isWebp = bytes.subarray(0,4).toString("ascii") === "RIFF" && bytes.subarray(8,12).toString("ascii") === "WEBP";
    if (!(mime === "image/png" && isPng || mime === "image/jpeg" && isJpeg || mime === "image/gif" && isGif || mime === "image/webp" && isWebp)) {
      return res.status(400).json({ error: "Görsel dosyası hatalı." });
    }
    if (req.body?.purpose === "mobile_banner") {
      const dimensions = imageDimensions(bytes, mime);
      if (!dimensions || dimensions.width !== 1200 || dimensions.height !== 360) {
        return res.status(400).json({ error: "Mobil banner görseli tam olarak 1200 × 360 piksel olmalıdır." });
      }
    }
    const id = randomBytes(16).toString("hex");
    try {
      await pool.query(
        `INSERT INTO platform_settings (key,value,updated_at) VALUES ($1,$2,NOW())`,
        [MEDIA_PREFIX + id, raw],
      );
      return res.status(201).json({ id, url: homepageImageUrl(id) });
    } catch (err) {
      console.error("Homepage media upload failed:", err);
      return res.status(500).json({ error: "Görsel kaydedilemedi." });
    }
  });

  app.get("/api/public/homepage/media/:id", async (req, res) => {
    const id = String(req.params.id || "");
    if (!validId.test(id) || !pool) return res.status(404).end();
    try {
      const record = await pool.query("SELECT value FROM platform_settings WHERE key=$1", [MEDIA_PREFIX + id]);
      const match = imageDataPattern.exec(String(record.rows[0]?.value || ""));
      if (!match) return res.status(404).end();
      res.setHeader("Content-Type", match[1]);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.send(Buffer.from(match[2], "base64"));
    } catch (err) {
      console.error("Homepage media load failed:", err);
      return res.status(500).end();
    }
  });
}
