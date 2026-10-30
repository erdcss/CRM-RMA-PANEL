import type { Request } from "express";
import { pool } from "./db";
import { getMobileHomeLayout } from "./homepage-media";

const BASE = "https://b2b.ecalisgan.com";
const LOGO = BASE + "/api/public/branding-asset/b2b_logo";

export type LinkPreview = { title: string; description: string; image: string; url: string };

const clean = (value: unknown, max = 200): string =>
  typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
const key = (value: unknown): string => clean(value, 100).toLocaleLowerCase("tr-TR");
const decode = (value: string): string => {
  try { return decodeURIComponent(value); } catch { return value; }
};
const escapeHtml = (value: string): string => value.replace(/&/g, "&amp;")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function safeImage(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) return "";
  const raw = value.trim();
  if (raw.startsWith("/") && !raw.startsWith("//")) return BASE + raw;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

export function isB2BPreviewRequest(req: Pick<Request, "hostname">): boolean {
  const host = req.hostname.toLowerCase();
  return host === "b2b.ecalisgan.com" ||
    (host.startsWith("caliskan-b2b-web-") && host.endsWith(".up.railway.app")) ||
    process.env.VITE_APP_MODE === "b2b" || process.env.APP_SERVICE_MODE === "b2b";
}

export async function resolveB2BPreview(pathname: string): Promise<LinkPreview> {
  const path = pathname.startsWith("/") && !pathname.startsWith("//") && pathname.length <= 1000 ? pathname : "/";
  const base: LinkPreview = {
    title: "Çalışkan B2B",
    description: "Çalışkan B2B toptan ürün kataloğu",
    image: LOGO,
    url: BASE + path,
  };

  const category = /^\/kategori\/([^/]+)(?:\/alt\/([^/]+))?\/?$/.exec(path);
  if (category) {
    const rawName = clean(decode(category[1]), 80);
    if (!rawName) return base;
    const layout = await getMobileHomeLayout();
    const card = layout.categoryCards.find(item => key(item.category) === key(rawName));
    const sub = category[2] ? card?.subcategories.find(item => item.id === decode(category[2])) : undefined;
    const name = clean(sub?.name || card?.label || rawName, 120);
    const imageId = sub?.imageId || card?.imageId || "";
    return {
      title: name,
      description: name + " kategorisindeki ürünleri Çalışkan B2B'de inceleyin.",
      image: /^[a-f0-9]{32}$/i.test(imageId)
        ? "https://admin.ecalisgan.com/api/public/homepage/media/" + imageId : LOGO,
      url: BASE + path,
    };
  }

  const match = /^\/urun\/([^/]+)\/?$/.exec(path);
  if (!match || !pool) return base;
  const id = decode(match[1]);
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return base;

  let row: Record<string, unknown> | undefined;
  if (/^mp-[1-9]\d*$/.test(id)) {
    const result = await pool.query([
      "SELECT v.content->>'name' AS name, v.content->>'description' AS description,",
      "v.content->>'imageUrl' AS image_url",
      "FROM mp_products p",
      "JOIN mp_suppliers s ON s.id=p.supplier_id",
      "AND s.status='approved' AND s.is_holiday=FALSE AND s.is_admin_paused=FALSE",
      "JOIN mp_product_versions v ON v.product_id=p.id",
      "AND v.is_live=TRUE AND v.status='approved'",
      "WHERE p.id=$1 AND p.is_enabled=TRUE LIMIT 1",
    ].join(" "), [id.slice(3)]);
    row = result.rows[0];
  } else {
    const result = await pool.query([
      "SELECT name, description,",
      "CASE WHEN image_data LIKE 'data:image/%' THEN '/api/b2b/product-image/' || id::text",
      "WHEN image_data LIKE 'https://%' OR image_data LIKE '/%' THEN image_data ELSE NULL END AS image_url,",
      "CASE WHEN images->>0 LIKE 'data:image/%' THEN '/api/b2b/product-image/' || id::text || '?index=0'",
      "WHEN images->>0 LIKE 'https://%' OR images->>0 LIKE '/%' THEN images->>0 ELSE NULL END AS gallery_url",
      "FROM b2b_products WHERE id::text=$1 AND is_active IS DISTINCT FROM FALSE LIMIT 1",
    ].join(" "), [id]);
    row = result.rows[0];
  }
  const title = clean(row?.name);
  if (!title) return base;
  return {
    title,
    description: clean(row?.description, 180) || title + " ürününü Çalışkan B2B'de inceleyin.",
    image: safeImage(row?.image_url) || safeImage(row?.gallery_url) || LOGO,
    url: BASE + path,
  };
}

/** WhatsApp, Telegram, Facebook and other crawlers read server-returned HTML. */
export function injectB2BPreviewHtml(html: string, preview: LinkPreview): string {
  const title = escapeHtml(preview.title);
  const desc = escapeHtml(preview.description);
  const image = escapeHtml(preview.image);
  const url = escapeHtml(preview.url);
  const tags = [
    '<meta property="og:site_name" content="Çalışkan B2B" />',
    '<meta property="og:type" content="website" />',
    '<meta property="og:title" content="' + title + '" />',
    '<meta property="og:description" content="' + desc + '" />',
    '<meta property="og:image" content="' + image + '" />',
    '<meta property="og:url" content="' + url + '" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:title" content="' + title + '" />',
    '<meta name="twitter:description" content="' + desc + '" />',
    '<meta name="twitter:image" content="' + image + '" />',
    '<link rel="canonical" href="' + url + '" />',
  ].join("\n    ");
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, "<title>" + title + "</title>")
    .replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i,
      '<meta name="description" content="' + desc + '" />')
    .replace(/<\/head>/i, "    " + tags + "\n  </head>");
}
