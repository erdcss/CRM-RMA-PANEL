import type { Express, Request } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { pool } from "./db";
import { ensureMarketplaceSchema } from "./marketplace";

// The B2B storefront deliberately hides wholesale prices from anonymous users.
// Do NOT expose this feed without the independent META_CATALOG_FEED_PASSWORD.
const FEED_USER = "caliskan-meta";
const SITE = "https://b2b.ecalisgan.com";
const HEADERS = [
  "id", "title", "description", "availability", "condition", "price",
  "link", "image_link", "brand", "mpn", "gtin", "inventory", "product_type",
] as const;
type CatalogRow = Record<string, unknown>;

function hasFeedAccess(req: Request, password: string): boolean {
  const header = req.header("authorization") || "";
  if (!header.startsWith("Basic ")) return false;
  let credentials = "";
  try { credentials = Buffer.from(header.slice(6).trim(), "base64").toString("utf8"); }
  catch { return false; }
  const separator = credentials.indexOf(":");
  if (separator < 0 || credentials.slice(0, separator) !== FEED_USER) return false;
  const provided = createHash("sha256").update(credentials.slice(separator + 1)).digest();
  const expected = createHash("sha256").update(password).digest();
  return timingSafeEqual(provided, expected);
}

function csvCell(input: unknown): string {
  const raw = String(input ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return '"' + raw.replace(/"/g, '""') + '"';
}
function cleanText(input: unknown, limit: number): string {
  return String(input ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}
function positiveInt(input: unknown, fallback = 1): number {
  const value = Number(input);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
function imageUrl(input: unknown): string | null {
  const raw = String(input || "").trim();
  if (raw.startsWith("/api/b2b/product-image/") || /^\/api\/marketplace\/media\/[a-f0-9]{32}$/.test(raw)) {
    return SITE + raw;
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u.toString();
  } catch { return null; }
}
function validGtin(input: unknown): string {
  const digits = String(input || "").replace(/\D/g, "");
  if (![8,12,13,14].includes(digits.length)) return "";
  let total = 0;
  for (let i = digits.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3)
    total += Number(digits[i]) * weight;
  return (10 - (total % 10)) % 10 === Number(digits[digits.length - 1]) ? digits : "";
}
function productLine(row: CatalogRow): string[] | null {
  const id = cleanText(row.id, 100);
  const title = cleanText(row.name, 200);
  const amount = Number(row.price);
  const photo = imageUrl(row.image_url);
  // Never create a Meta product with missing imagery, invalid price, or blank name.
  if (!id || !title || !photo || !Number.isFinite(amount) || amount <= 0) return null;
  const boxSize = positiveInt(row.units_per_box);
  const minimumBoxes = positiveInt(row.min_order_qty);
  const stock = Math.max(0, Math.trunc(Number(row.stock) || 0));
  const available = stock >= boxSize * minimumBoxes ? "in stock" : "out of stock";
  const packText = "Koli içi: " + boxSize + " adet. Minimum sipariş: " + minimumBoxes + " koli.";
  const details = cleanText(row.description, 4200);
  const description = cleanText((details ? details + " " : "") + packText, 5000);
  const brand = cleanText(row.brand, 100) || cleanText(row.seller_name, 100) || "Çalışkan B2B";
  const sku = cleanText(row.sku, 100) || id;
  return [
    id, title, description, available, "new", amount.toFixed(2) + " TRY",
    SITE + "/urun/" + encodeURIComponent(id), photo, brand, sku,
    validGtin(row.barcode), String(stock), cleanText(row.category, 200),
  ];
}

const OWN_PRODUCTS = [
  "SELECT id::text AS id, sku, name, brand, category, description, price, stock,",
  "min_order_qty, units_per_box, barcode,",
  "CASE",
  "WHEN image_data ~ '^data:image/(png|jpeg|webp|gif);base64,'",
  "THEN '/api/b2b/product-image/' || id::text || '?v=' || EXTRACT(EPOCH FROM updated_at)::bigint::text",
  "WHEN image_data ~* '^https://' THEN image_data",
  "WHEN jsonb_typeof(images)='array' AND jsonb_array_length(images)>0",
  "AND (images->>0) ~ '^data:image/(png|jpeg|webp|gif);base64,'",
  "THEN '/api/b2b/product-image/' || id::text || '?index=0&v=' || EXTRACT(EPOCH FROM updated_at)::bigint::text",
  "WHEN jsonb_typeof(images)='array' AND jsonb_array_length(images)>0",
  "AND (images->>0) ~* '^https://' THEN images->>0",
  "ELSE NULL END AS image_url",
  "FROM b2b_products WHERE is_active IS DISTINCT FROM FALSE ORDER BY id",
].join(" ");

const SUPPLIER_PRODUCTS = [
  "SELECT 'mp-' || p.id::text AS id, p.sku, p.stock,",
  "v.content->>'name' AS name, v.content->>'brand' AS brand,",
  "v.content->>'category' AS category, v.content->>'description' AS description,",
  "COALESCE(p.current_price::text,v.content->>'price') AS price,",
  "v.content->>'unitsPerBox' AS units_per_box,",
  "v.content->>'minBoxes' AS min_order_qty,",
  "v.content->>'barcode' AS barcode,",
  "v.content->>'imageUrl' AS image_url, s.company_name AS seller_name",
  "FROM mp_products p",
  "JOIN mp_suppliers s ON s.id=p.supplier_id",
  "AND s.status='approved' AND s.is_holiday=FALSE AND s.is_admin_paused=FALSE",
  "JOIN mp_product_versions v ON v.product_id=p.id AND v.is_live=TRUE AND v.status='approved'",
  "WHERE p.is_enabled=TRUE ORDER BY p.id",
].join(" ");

/** A complete, credential-protected replacement feed; Meta fetches it on its own schedule. */
export function registerMetaCatalogFeed(app: Express): void {
  app.get("/api/meta/catalog.csv", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Vary", "Authorization");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    const password = process.env.META_CATALOG_FEED_PASSWORD || "";
    if (password.length < 24) return res.status(503).send("Meta katalog aktarımı yapılandırılmadı.");
    if (!hasFeedAccess(req, password)) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Caliskan B2B Meta Catalog"');
      return res.status(401).send("Yetkisiz katalog erişimi.");
    }
    if (!pool) return res.status(503).send("Veritabanı bağlantısı yok.");
    try {
      // An invalid/missing supplier schema must not result in an empty successful feed.
      await ensureMarketplaceSchema();
      const [own, suppliers] = await Promise.all([
        pool.query(OWN_PRODUCTS), pool.query(SUPPLIER_PRODUCTS),
      ]);
      const lines: string[] = [HEADERS.join(",")];
      for (const record of [...own.rows, ...suppliers.rows]) {
        const fields = productLine(record);
        if (fields) lines.push(fields.map(csvCell).join(","));
      }
      if (lines.length === 1) {
        console.warn("Meta catalog feed: no eligible products; refusing to replace existing catalog.");
        return res.status(503).send("Aktarılabilecek uygun ürün bulunamadı.");
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'inline; filename="caliskan-b2b-meta-catalog.csv"');
      return res.status(200).send(lines.join("\r\n") + "\r\n");
    } catch (error) {
      console.error("Meta catalog feed query failed:", error);
      return res.status(503).send("Meta katalog akışı şu anda kullanılamıyor.");
    }
  });
}
