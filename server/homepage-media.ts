import { randomBytes } from "node:crypto";
import type { Express, RequestHandler } from "express";
import { pool } from "./db";
import {normalizeRoundBottomBanner, type RoundBottomBanner} from "./round-bottom-banner";

// Images live in Postgres rather than Railway's ephemeral filesystem. The mobile
// feed receives only small image URLs and never downloads base64 in the JSON.
const MEDIA_PREFIX = "b2b_home_media_";
const LAYOUT_KEY = "b2b_home_layout";
const imageDataPattern = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/s;
const validId = /^[a-f0-9]{32}$/;

// Image IDs are immutable (a new upload gets a new ID). Cache decoded bytes
// in a bounded process-local LRU to avoid querying Postgres for every image
// request, and coalesce identical concurrent requests.
type MediaAsset = { mime: string; bytes: Buffer };
const MAX_MEDIA_CACHE_BYTES = 32 * 1024 * 1024;
const cachedMedia = new Map<string, MediaAsset>();
const inFlightMedia = new Map<string, Promise<MediaAsset | null>>();
let cachedMediaBytes = 0;

function storeCachedMedia(id: string, value: MediaAsset) {
  if (value.bytes.length > MAX_MEDIA_CACHE_BYTES) return;
  const previous = cachedMedia.get(id);
  if (previous) cachedMediaBytes -= previous.bytes.length;
  cachedMedia.delete(id);
  while (cachedMediaBytes + value.bytes.length > MAX_MEDIA_CACHE_BYTES) {
    const oldest = cachedMedia.keys().next().value;
    if (!oldest) break;
    const entry = cachedMedia.get(oldest);
    if (entry) cachedMediaBytes -= entry.bytes.length;
    cachedMedia.delete(oldest);
  }
  cachedMedia.set(id, value);
  cachedMediaBytes += value.bytes.length;
}

async function getCachedHomepageMedia(id: string): Promise<MediaAsset | null> {
  const hit = cachedMedia.get(id);
  if (hit) {
    cachedMedia.delete(id);
    cachedMedia.set(id, hit);
    return hit;
  }
  const pending = inFlightMedia.get(id);
  if (pending) return pending;
  if (!pool) return null;
  const read = (async () => {
    const record = await pool.query("SELECT value FROM platform_settings WHERE key=$1", [MEDIA_PREFIX + id]);
    const match = imageDataPattern.exec(String(record.rows[0]?.value || ""));
    if (!match) return null;
    const asset = { mime: match[1], bytes: Buffer.from(match[2], "base64") };
    storeCachedMedia(id, asset);
    return asset;
  })();
  inFlightMedia.set(id, read);
  try {
    return await read;
  } finally {
    inFlightMedia.delete(id);
  }
}


function safeString(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export const HOME_BANNER_PAGES = [
  '/(tabs)', '/(tabs)/products', '/(tabs)/discover', '/(tabs)/menu',
  '/ledger', '/notifications',
] as const;
export type BannerLinkType = 'none' | 'product' | 'page' | 'url';
type Banner = {
  id:string;title:string;subtitle:string;buttonText:string;imageId:string;
  imageWidth?:number;imageHeight?:number;
  linkType:BannerLinkType;productId:number|null;pagePath:string;externalUrl:string;
};
function safeBannerLink(item:any):Pick<Banner,'linkType'|'productId'|'pagePath'|'externalUrl'> {
  const type:BannerLinkType = ['product','page','url'].includes(item?.linkType)
    ? item.linkType : 'none';
  const n=Number(item?.productId);
  const productId=Number.isSafeInteger(n)&&n>0?n:null;
  const pagePath=typeof item?.pagePath==='string'&&
    (HOME_BANNER_PAGES as readonly string[]).includes(item.pagePath)
    ? item.pagePath : '';
  const url=typeof item?.externalUrl==='string'?item.externalUrl.trim():'';
  let externalUrl='';
  try{
    const parsed=new URL(url);
    if(parsed.protocol==='https:'&&parsed.hostname&&
       !parsed.username&&!parsed.password&&!/^localhost$/i.test(parsed.hostname)&&
       !/^(?:127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(parsed.hostname)&&
       url.length<=1500)externalUrl=parsed.toString();
  }catch{/* Malformed or missing URL. */}
  if(type==='product'&&productId)return {linkType:type,productId,pagePath:'',externalUrl:''};
  if(type==='page'&&pagePath)return {linkType:type,productId:null,pagePath,externalUrl:''};
  if(type==='url'&&externalUrl)return {linkType:type,productId:null,pagePath:'',externalUrl};
  return {linkType:'none',productId:null,pagePath:'',externalUrl:''};
}
type Subcategory = { id: string; name: string; imageId: string; tags: string[]; titleKeywords: string[] };
type CategoryCard = { category: string; label: string; imageId: string; tags: string[]; subcategories: Subcategory[] };

function normalizeSubcategories(raw: unknown): Subcategory[] {
  if (!Array.isArray(raw)) return [];
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  const result: Subcategory[] = [];
  for (const item of raw.slice(0, 24)) {
    const name = safeString(item?.name, 80).replace(/\s+/g, " ");
    if (!name || seenNames.has(name.toLocaleLowerCase("tr-TR"))) continue;
    seenNames.add(name.toLocaleLowerCase("tr-TR"));
    let id = /^[a-f0-9]{24}$/i.test(String(item?.id || "")) ? String(item.id).toLowerCase() : randomBytes(12).toString("hex");
    if (seenIds.has(id)) id = randomBytes(12).toString("hex");
    seenIds.add(id);
    result.push({
      id, name,
      imageId: validId.test(String(item?.imageId || "")) ? String(item.imageId) : "",
      titleKeywords: [...new Set<string>((Array.isArray(item?.titleKeywords) ? item.titleKeywords : [])
        .filter((term: unknown): term is string => typeof term === "string")
        .map((term: string) => safeString(term, 80).replace(/\s+/g, " "))
        .filter(Boolean))].slice(0, 15),
      tags: [...new Set<string>(((Array.isArray(item?.tags) ? item.tags : [])
        .filter((tag: unknown): tag is string => typeof tag === "string")
        .map((tag: string) => safeString(tag, 60).replace(/\s+/g, " "))
        .filter(Boolean)) as string[])].slice(0, 30),
    });
  }
  return result;
}

export const HOME_SECTION_DEFAULTS = [
  { id: "actions", title: "Hızlı İşlemler", enabled: true },
  { id: "flash", title: "Flash Ürünler", enabled: true },
  { id: "special", title: "Sana Özel Fırsatlar", enabled: true },
  { id: "reorder", title: "Hızlı Tekrar Sipariş", enabled: true },
  { id: "videos", title: "Video ile Keşfet", enabled: true },
  { id: "bestsellers", title: "Çok Satanlar", enabled: true },
  { id: "brands", title: "Markalar", enabled: true },
] as const;
export type HomeSectionId = (typeof HOME_SECTION_DEFAULTS)[number]["id"];
export type HomeSection = {
  id: HomeSectionId;
  title: string;
  enabled: boolean;
  productIds: string[];
  brands: string[];
  brandImageIds: Record<string,string>;
  actionImageIds: Partial<Record<'scan'|'orders'|'ledger'|'campaigns',string>>;
  reorderBannerImageId?: string;
  flashBannerImageId?: string;
};
/** Store only valid public/catalog IDs and display labels. Unknown modules are discarded. */
export function normalizeHomeSections(raw: unknown): HomeSection[] {
  const items = Array.isArray(raw) ? raw : [];
  const known = new Map<string, (typeof HOME_SECTION_DEFAULTS)[number]>(
    HOME_SECTION_DEFAULTS.map(item => [item.id, item])
  );
  const result: HomeSection[] = [];
  for (const entry of items) {
    const id = typeof entry?.id === "string" ? entry.id : "";
    const base = known.get(id);
    if (!base || result.some(item => item.id === id)) continue;
    const productIds = [...new Set<string>(
      (Array.isArray(entry.productIds) ? entry.productIds : [])
        .map((value: unknown) => String(value))
        .filter((value: string) => /^[1-9][0-9]{0,14}$/.test(value))
    )].slice(0, 24);
    const brands = [...new Set<string>(
      (Array.isArray(entry.brands) ? entry.brands : [])
        .map((value: unknown) => safeString(value, 64))
        .filter(Boolean)
    )].slice(0, 24);
    const brandImageIds: Record<string,string> = {};
    const images = entry?.brandImageIds && typeof entry.brandImageIds === 'object' && !Array.isArray(entry.brandImageIds)
      ? entry.brandImageIds : {};
    for (const brand of brands) {
      const imageId = images[brand];
      if (typeof imageId === 'string' && validId.test(imageId)) brandImageIds[brand] = imageId;
    }
    const actionImageIds: HomeSection['actionImageIds'] = {};
    if(base.id==='actions'&&entry.actionImageIds&&typeof entry.actionImageIds==='object'&&!Array.isArray(entry.actionImageIds)){
      for(const key of ['scan','orders','ledger','campaigns'] as const){
        const imageId=entry.actionImageIds[key];
        if(typeof imageId==='string'&&validId.test(imageId))actionImageIds[key]=imageId;
      }
    }
    result.push({
      id: base.id,
      title: safeString(entry.title, 70) || base.title,
      enabled: entry.enabled !== false,
      productIds,
      brands,
      brandImageIds,
      actionImageIds,
      ...(base.id === 'flash' && typeof entry.flashBannerImageId === 'string' && validId.test(entry.flashBannerImageId) ? {flashBannerImageId: entry.flashBannerImageId} : {}),
      ...(base.id === 'reorder' && typeof entry.reorderBannerImageId === 'string' && validId.test(entry.reorderBannerImageId) ? {reorderBannerImageId: entry.reorderBannerImageId} : {}),
    });
  }
  for (const base of HOME_SECTION_DEFAULTS) if (!result.some(item => item.id === base.id))
    result.push({ id: base.id, title: base.title, enabled: base.enabled, productIds: [], brands: [], brandImageIds: {}, actionImageIds: {} });
  // Keep these three adjacent while preserving the order of the other modules.
  const actions=result.find(item=>item.id==='actions')!;
  const flash=result.find(item=>item.id==='flash')!;
  const special=result.find(item=>item.id==='special')!;
  const ordered=result.filter(item=>item.id!=='flash'&&item.id!=='special');
  ordered.splice(ordered.indexOf(actions)+1,0,flash,special);
  return ordered;
}

export type MobileHomeLayout = {
  homeSections: HomeSection[];
  homeHeader: { enabled: boolean; tagline: string };
  roundBottomBanner:RoundBottomBanner;
  banners: Banner[];
  categoryCards: CategoryCard[];
  ledgerTileImageId: string;
  refreshAnimationImageId: string;
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
    imageWidth: Number.isSafeInteger(item?.imageWidth) && item.imageWidth > 0 && item.imageWidth <= 16384 ? item.imageWidth : undefined,
    imageHeight: Number.isSafeInteger(item?.imageHeight) && item.imageHeight > 0 && item.imageHeight <= 16384 ? item.imageHeight : undefined,
    ...safeBannerLink(item),
  }));
  const categoryCards = (Array.isArray(input.categoryCards) ? input.categoryCards : []).slice(0, 30).map((item: any) => ({
    category: safeString(item?.category, 80),
    label: safeString(item?.label, 80),
    imageId: validId.test(String(item?.imageId || "")) ? String(item.imageId) : "",
    tags: [...new Set((Array.isArray(item?.tags) ? item.tags : []).filter((tag: unknown): tag is string => typeof tag === "string").map((tag: string) => safeString(tag, 60)).filter(Boolean))].slice(0, 30),
    subcategories: normalizeSubcategories(item?.subcategories),
  })).filter((item: CategoryCard) => item.category);
  const n = Number(input.sliderIntervalMs);
  return {
    homeSections: normalizeHomeSections(input.homeSections),
    homeHeader: {
      enabled: input.homeHeader?.enabled !== false,
      tagline: safeString(input.homeHeader?.tagline, 110) || "Toptan alışverişin akıllı yolu",
    },
    roundBottomBanner:normalizeRoundBottomBanner(input.roundBottomBanner),
    banners,
    categoryCards,
    ledgerTileImageId: validId.test(String(input.ledgerTileImageId || '')) ? String(input.ledgerTileImageId) : '',
    refreshAnimationImageId: validId.test(String(input.refreshAnimationImageId || '')) ? String(input.refreshAnimationImageId) : '',
    sliderAutoPlay: input.sliderAutoPlay !== false,
    sliderIntervalMs: Number.isFinite(n) ? Math.min(15000, Math.max(2500, Math.round(n))) : 5000,
  };
}

export function homepageImageUrl(id: string) {
  return validId.test(id) ? `/api/public/homepage/media/${id}` : null;
}

const ELECTRONICS_TITLE_SEED_KEY = "b2b_electronics_title_subcategories_v1";
const DEFAULT_TITLE_SUBCATEGORIES = [
  { name: "ÇELİK CEZVE", title: "çelik cezve" },
  { name: "ÇAY MAKİNESİ", title: "çay makinesi" },
] as const;

/**
 * One-time, transactionally locked addition to the actual saved homepage layout.
 * Preserves existing categories, images, tags, banners and all other settings.
 * An admin can subsequently edit or remove these categories without a later
 * process restart automatically recreating them.
 */
export function addElectronicsTitleSubcategories(layout: MobileHomeLayout): { layout: MobileHomeLayout; changed: boolean } {
  let changed = false;
  let card = layout.categoryCards.find(item => item.category.toLocaleLowerCase("tr-TR") === "elektronik");
  if (!card) {
    card = { category: "elektronik", label: "Elektronik", imageId: "", tags: [], subcategories: [] };
    layout.categoryCards.push(card);
    changed = true;
  }
  for (const spec of DEFAULT_TITLE_SUBCATEGORIES) {
    let sub = card.subcategories.find(item => item.name.trim().toLocaleLowerCase("tr-TR") === spec.name.toLocaleLowerCase("tr-TR"));
    if (!sub) {
      if (card.subcategories.length >= 24) break;
      sub = {
        id: randomBytes(12).toString("hex"),
        name: spec.name,
        imageId: "",
        tags: [],
        titleKeywords: [spec.title],
      };
      card.subcategories.push(sub);
      changed = true;
    } else if (!sub.titleKeywords.some(keyword => keyword.toLocaleLowerCase("tr-TR") === spec.title)) {
      sub.titleKeywords = [...sub.titleKeywords, spec.title];
      changed = true;
    }
  }
  return { layout, changed };
}

let seedPromise: Promise<void> | null = null;

async function ensureElectronicsTitleSubcategories(): Promise<void> {
  if (!pool) return;
  if (!seedPromise) {
    seedPromise = (async () => {
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [ELECTRONICS_TITLE_SEED_KEY]);
        const existingSeed = await db.query(
          "SELECT 1 FROM platform_settings WHERE key=$1 LIMIT 1", [ELECTRONICS_TITLE_SEED_KEY],
        );
        if (existingSeed.rowCount) {
          await db.query("COMMIT");
          return;
        }

        const saved = await db.query(
          "SELECT value FROM platform_settings WHERE key=$1 FOR UPDATE", [LAYOUT_KEY],
        );
        let stored: unknown = {};
        if (saved.rows[0]?.value) {
          try { stored = JSON.parse(String(saved.rows[0].value)); } catch { stored = {}; }
        }
        const normalized = normalizeHomeLayout(stored);
        const { layout, changed } = addElectronicsTitleSubcategories(normalized);
        if (changed) {
          await db.query(
            "INSERT INTO platform_settings (key,value,updated_at) VALUES ($1,$2,NOW()) " +
            "ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",
            [LAYOUT_KEY, JSON.stringify(layout)],
          );
        }
        await db.query(
          "INSERT INTO platform_settings (key,value,updated_at) VALUES ($1,'applied',NOW()) " +
          "ON CONFLICT(key) DO NOTHING",
          [ELECTRONICS_TITLE_SEED_KEY],
        );
        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      } finally {
        db.release();
      }
    })().catch(error => {
      seedPromise = null; // Retry if the database is temporarily unavailable.
      throw error;
    });
  }
  await seedPromise;
}

export async function getMobileHomeLayout(): Promise<MobileHomeLayout> {
  if (!pool) return normalizeHomeLayout({});
  await ensureElectronicsTitleSubcategories();
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
  await ensureElectronicsTitleSubcategories();
  const result = normalizeHomeLayout(raw);
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_at) VALUES ($1,$2,NOW())
     ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
    [LAYOUT_KEY, JSON.stringify(result)],
  );
  return result;
}

/** Accept all aspect ratios, with pixel-count limits for safe decoding. */
export function isSafeBannerSize(size:{width:number;height:number}):boolean {
  return Number.isInteger(size.width)&&Number.isInteger(size.height)&&
    size.width>0&&size.height>0&&size.width<=16384&&size.height<=16384&&
    size.width*size.height<=40_000_000;
}

// Read intrinsic dimensions without relying on MIME headers supplied by clients.
export function imageDimensions(bytes: Buffer, mime: string): { width: number; height: number } | null {
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
    // Any aspect ratio is accepted (portrait, landscape, square). Reject only
    // malformed/unsafe raster dimensions, not a predefined banner size.
    const dimensions = imageDimensions(bytes, mime);
    if (!dimensions || !isSafeBannerSize(dimensions)) {
      return res.status(400).json({ error: "Geçerli ve güvenli boyutlarda bir PNG, JPEG, WebP veya GIF görsel yükleyin." });
    }
    const id = randomBytes(16).toString("hex");
    try {
      await pool.query(
        `INSERT INTO platform_settings (key,value,updated_at) VALUES ($1,$2,NOW())`,
        [MEDIA_PREFIX + id, raw],
      );
      storeCachedMedia(id, { mime, bytes });
      return res.status(201).json({ id, url: homepageImageUrl(id), imageWidth: dimensions.width, imageHeight: dimensions.height });
    } catch (err) {
      console.error("Homepage media upload failed:", err);
      return res.status(500).json({ error: "Görsel kaydedilemedi." });
    }
  });

  // Persist only the chosen quick-action icon. Other homepage drafts are untouched.
  app.put("/api/admin/homepage/action-icons/:slot",requireAdmin,async(req,res)=>{
    if(!pool)return res.status(503).json({error:"Veritabanı bağlantısı yok"});
    const slots=['scan','orders','ledger','campaigns'] as const;
    const slot=slots.find(key=>key===req.params.slot);
    const imageId=req.body?.imageId;
    if(!slot||(imageId!==null&&(typeof imageId!=="string"||!validId.test(imageId))))
      return res.status(400).json({error:"Geçersiz simge veya görsel"});
    try{
      if(imageId!==null&&!(await getCachedHomepageMedia(imageId)))
        return res.status(404).json({error:"Yüklenen görsel bulunamadı"});
      await ensureElectronicsTitleSubcategories();
      const client=await pool.connect();
      try{
        await client.query("BEGIN");
        await client.query("INSERT INTO platform_settings (key,value,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (key) DO NOTHING",[LAYOUT_KEY,JSON.stringify(normalizeHomeLayout({}))]);
        const row=await client.query("SELECT value FROM platform_settings WHERE key=$1 FOR UPDATE",[LAYOUT_KEY]);
        const layout=normalizeHomeLayout(JSON.parse(String(row.rows[0].value)));
        const section=layout.homeSections.find(item=>item.id==="actions")!;
        if(imageId===null)delete section.actionImageIds[slot];
        else section.actionImageIds[slot]=imageId;
        await client.query("UPDATE platform_settings SET value=$2,updated_at=NOW() WHERE key=$1",[LAYOUT_KEY,JSON.stringify(layout)]);
        await client.query("COMMIT");
        return res.json({actionImageIds:section.actionImageIds});
      }catch(error){await client.query("ROLLBACK");throw error;}
      finally{client.release();}
    }catch(error){
      console.error("Quick action icon save failed",error);
      return res.status(500).json({error:"Simge kaydedilemedi"});
    }
  });

  app.get("/api/public/homepage/media/:id", async (req, res) => {
    const id = String(req.params.id || "");
    if (!validId.test(id) || !pool) return res.status(404).end();
    try {
      const asset = await getCachedHomepageMedia(id);
      if (!asset) return res.status(404).end();
      res.setHeader("Content-Type", asset.mime);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(asset.bytes);
    } catch (err) {
      console.error("Homepage media load failed:", err);
      return res.status(500).end();
    }
  });
}
