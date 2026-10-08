import type { Express, RequestHandler } from "express";
import { pool } from "./db";
import {
  getAdminPaymentSettings,
  getPublicPaymentSettings,
  savePaymentSettings,
} from "./payment-config";
import { retrieveIyzicoCheckout } from "./iyzico";
import {
  ensureReelVideoCompatibility,
  saveVideoDataUrl,
} from "./image-storage";

const PLATFORM_SQL = `
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_value TEXT,
  product_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
  ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_type_idx
  ON analytics_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS b2b_orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT UNIQUE,
  customer_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  item_count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_provider TEXT,
  payment_status TEXT,
  payment_id TEXT,
  payment_token TEXT,
  transfer_code TEXT,
  shipping_method TEXT,
  shipping_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  card_last4 TEXT,
  card_association TEXT,
  billing_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  checkout_trace JSONB NOT NULL DEFAULT '{}'::jsonb,
  cancel_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS b2b_products (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  description TEXT,
  price NUMERIC(14,2),
  stock INTEGER NOT NULL DEFAULT 0,
  min_order_qty INTEGER NOT NULL DEFAULT 1,
  units_per_box INTEGER NOT NULL DEFAULT 1,
  image_data TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  barcode TEXT,
  collection_name TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS b2b_reels (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  product_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS b2b_products_stock_idx ON b2b_products (stock);
CREATE INDEX IF NOT EXISTS b2b_products_created_at_idx ON b2b_products (created_at DESC);
CREATE INDEX IF NOT EXISTS b2b_reels_active_sort_idx ON b2b_reels (is_active, sort_order, created_at DESC);
`;

const BRANDING_KEYS = [
  "admin_logo",
  "admin_favicon",
  "b2b_logo",
  "b2b_favicon",
  "b2b_mobile_logo",
  "b2b_mobile_splash",
  "business_mobile_logo",
  "business_mobile_splash",
] as const;

type BrandingKey = typeof BRANDING_KEYS[number];

let productSchemaReady: Promise<void> | null = null;

async function ensureB2BProductSchema() {
  if (!pool) return;

  if (!productSchemaReady) {
    productSchemaReady = (async () => {
      const migrations = [
        `ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS image_data TEXT`,
        `ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb`,
        `ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS barcode TEXT`,
        `ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS collection_name TEXT`,
        `ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb`,
        `ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb`,
        `ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      ];

      // Run each migration separately. A later compatibility repair must never
      // roll back columns such as images/barcode/variants.
      for (const sql of migrations) {
        await pool.query(sql);
      }

      const idInfo = await pool.query(
        `SELECT data_type, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'b2b_products'
           AND column_name = 'id'
         LIMIT 1`,
      );

      const idType = String(idInfo.rows[0]?.data_type || "");
      const idDefault = idInfo.rows[0]?.column_default;

      if (!idDefault && ["smallint", "integer", "bigint"].includes(idType)) {
        await pool.query(`CREATE SEQUENCE IF NOT EXISTS b2b_products_id_seq`);
        await pool.query(`ALTER SEQUENCE b2b_products_id_seq OWNED BY b2b_products.id`);

        const maxResult = await pool.query(
          `SELECT COALESCE(MAX(id::bigint), 0::bigint) AS max_id FROM b2b_products`,
        );
        const nextId = Math.max(1, Number(maxResult.rows[0]?.max_id || 0) + 1);

        await pool.query(
          `SELECT setval('b2b_products_id_seq', $1::bigint, false)`,
          [nextId],
        );
        await pool.query(
          `ALTER TABLE b2b_products
           ALTER COLUMN id SET DEFAULT nextval('b2b_products_id_seq')`,
        );
      } else if (!idDefault && idType === "uuid") {
        await pool.query(
          `ALTER TABLE b2b_products
           ALTER COLUMN id SET DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid)`,
        );
      } else if (!idDefault && ["text", "character varying"].includes(idType)) {
        await pool.query(
          `ALTER TABLE b2b_products
           ALTER COLUMN id SET DEFAULT md5(random()::text || clock_timestamp()::text)`,
        );
      }
    })().catch((error) => {
      productSchemaReady = null;
      throw error;
    });
  }

  await productSchemaReady;
}

let dashboardSchemaReady: Promise<void> | null = null;

async function ensureDashboardSchema() {
  if (!pool) return;

  if (!dashboardSchemaReady) {
    dashboardSchemaReady = (async () => {
      const migrations = [
        `ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS visitor_id TEXT`,
        `ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS event_type TEXT`,
        `ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS event_value TEXT`,
        `ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS product_id TEXT`,
        `ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS order_number TEXT`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS customer_email TEXT`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS item_count INTEGER NOT NULL DEFAULT 0`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14,2) NOT NULL DEFAULT 0`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS payment_method TEXT`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS payment_provider TEXT`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS payment_status TEXT`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS payment_id TEXT`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS payment_token TEXT`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS transfer_code TEXT`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS shipping_method TEXT`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS shipping_details JSONB NOT NULL DEFAULT '{}'::jsonb`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS card_last4 TEXT`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS card_association TEXT`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS billing_details JSONB NOT NULL DEFAULT '{}'::jsonb`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS checkout_trace JSONB NOT NULL DEFAULT '{}'::jsonb`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ`,
        `ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      ];

      for (const sql of migrations) {
        await pool.query(sql);
      }

      await pool.query(
        `CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
         ON analytics_events (created_at DESC)`,
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS analytics_events_type_idx
         ON analytics_events (event_type, created_at DESC)`,
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS b2b_orders_created_at_idx
         ON b2b_orders (created_at DESC)`,
      );
      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS b2b_orders_transfer_code_unique_idx
         ON b2b_orders (transfer_code)
         WHERE transfer_code IS NOT NULL AND transfer_code <> ''`,
      );

      // Existing order rows may predate order_number. Give them a stable
      // human-readable number without overwriting real numbers.
      await pool.query(
        `UPDATE b2b_orders
         SET order_number = COALESCE(
           NULLIF(order_number, ''),
           'B2B-' || LPAD(id::text, 6, '0')
         )
         WHERE order_number IS NULL OR order_number = ''`,
      );
    })().catch((error) => {
      dashboardSchemaReady = null;
      throw error;
    });
  }

  await dashboardSchemaReady;
}

async function ensurePlatformTables() {
  if (!pool) return;

  await pool.query(PLATFORM_SQL);
  await Promise.all([
    ensureB2BProductSchema(),
    ensureDashboardSchema(),
  ]);
}

function normalizeProductImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) =>
      item.startsWith("data:image/") ||
      item.startsWith("/uploads/") ||
      item.startsWith("https://") ||
      item.startsWith("http://"),
    )
    .slice(0, 6);
}

function normalizeProductVariants(value: unknown): Array<Record<string, string | number | null>> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .slice(0, 50)
    .map((item: any) => ({
      name: typeof item.name === "string" ? item.name.trim().slice(0, 120) : "",
      value: typeof item.value === "string" ? item.value.trim().slice(0, 160) : "",
      sku: typeof item.sku === "string" ? item.sku.trim().slice(0, 120) : "",
      barcode: typeof item.barcode === "string" ? item.barcode.trim().slice(0, 120) : "",
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
      stock: Number.isFinite(Number(item.stock)) ? Math.max(0, Math.trunc(Number(item.stock))) : null,
    }))
    .filter((item) => item.name || item.value || item.sku || item.barcode);
}

function parseAdminProductPayload(body: any) {
  const sku = typeof body?.sku === "string" ? body.sku.trim().slice(0, 140) : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 300) : "";
  const brand = typeof body?.brand === "string" ? body.brand.trim().slice(0, 180) : "";
  const category = typeof body?.category === "string" ? body.category.trim().slice(0, 180) : "";
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 5000) : "";
  const collectionName = typeof body?.collectionName === "string" ? body.collectionName.trim().slice(0, 180) : "";
  const barcode = typeof body?.barcode === "string" ? body.barcode.trim().slice(0, 120) : "";
  const price = Number(body?.price ?? 0);
  const stock = Math.max(0, Number.parseInt(String(body?.stock ?? 0), 10) || 0);
  const minOrderQty = Math.max(1, Number.parseInt(String(body?.minOrderQty ?? 1), 10) || 1);
  const unitsPerBox = Math.max(1, Number.parseInt(String(body?.unitsPerBox ?? 1), 10) || 1);
  const images = normalizeProductImages(body?.images);
  const variants = normalizeProductVariants(body?.variants);

  return {
    sku,
    name,
    brand,
    category,
    description,
    collectionName,
    barcode,
    price,
    stock,
    minOrderQty,
    unitsPerBox,
    images,
    variants,
  };
}

function validVisitorId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().slice(0, 120);
  return clean.length >= 8 ? clean : null;
}

async function brandingMap() {
  const defaults: Record<BrandingKey, string | null> = {
    admin_logo: null,
    admin_favicon: null,
    b2b_logo: null,
    b2b_favicon: null,
    b2b_mobile_logo: null,
    b2b_mobile_splash: null,
    business_mobile_logo: null,
    business_mobile_splash: null,
  };
  if (!pool) return defaults;

  const result = await pool.query(
    `SELECT key, value FROM platform_settings WHERE key = ANY($1::text[])`,
    [BRANDING_KEYS],
  );
  for (const row of result.rows) {
    if ((BRANDING_KEYS as readonly string[]).includes(row.key)) {
      defaults[row.key as BrandingKey] = row.value;
    }
  }
  return defaults;
}

function normalizeHomepageCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const categories: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") continue;
    const name = item.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!name) continue;

    const key = name.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    categories.push(name);

    if (categories.length >= 30) break;
  }

  return categories;
}

async function detectedProductCategories(): Promise<string[]> {
  if (!pool) return [];

  try {
    const result = await pool.query(
      `SELECT DISTINCT TRIM(category) AS category
       FROM b2b_products
       WHERE is_active = TRUE
         AND COALESCE(TRIM(category), '') <> ''
       ORDER BY TRIM(category) ASC
       LIMIT 50`,
    );

    return normalizeHomepageCategories(result.rows.map((row) => row.category));
  } catch {
    return [];
  }
}

async function homepageConfig() {
  const detectedCategories = await detectedProductCategories();
  if (!pool) {
    return { categories: detectedCategories, detectedCategories };
  }

  const result = await pool.query(
    `SELECT value
     FROM platform_settings
     WHERE key = 'b2b_home_categories'
     LIMIT 1`,
  );

  if (!result.rows[0]) {
    return {
      categories: detectedCategories,
      detectedCategories,
    };
  }

  try {
    const parsed = JSON.parse(String(result.rows[0].value || "[]"));
    return {
      categories: normalizeHomepageCategories(parsed),
      detectedCategories,
    };
  } catch {
    return {
      categories: detectedCategories,
      detectedCategories,
    };
  }
}

async function hydrateAdminOrderDetail(row: any) {
  if (!pool) return row;

  let cardLast4 = String(row.card_last4 || "").trim();
  let cardAssociation = String(row.card_association || "").trim();

  if (
    !cardLast4 &&
    row.payment_token &&
    String(row.payment_status || "").toUpperCase() === "SUCCESS"
  ) {
    try {
      const payment = await retrieveIyzicoCheckout(String(row.payment_token));
      cardLast4 = String(payment.lastFourDigits || "").trim();
      cardAssociation = String(payment.cardAssociation || "").trim();
      if (cardLast4 || cardAssociation) {
        await pool.query(
          `UPDATE b2b_orders
           SET card_last4 = COALESCE(NULLIF($2, ''), card_last4),
               card_association = COALESCE(NULLIF($3, ''), card_association)
           WHERE id::text = $1`,
          [String(row.id), cardLast4, cardAssociation],
        );
      }
    } catch (error) {
      console.warn(
        "Admin order card summary refresh failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  const items = Array.isArray(row.items) ? row.items.map((item: any) => ({ ...item })) : [];
  const ids = Array.from(
    new Set(items.map((item: any) => String(item?.productId || "").trim()).filter(Boolean)),
  );
  const productRows = ids.length
    ? await pool.query(
        `SELECT id::text AS id, image_data, images
         FROM b2b_products
         WHERE id::text = ANY($1::text[])`,
        [ids],
      )
    : { rows: [] as any[] };
  const imageById = new Map<string, string | null>();
  for (const product of productRows.rows) {
    const image =
      typeof product.image_data === "string" && product.image_data.trim()
        ? product.image_data
        : Array.isArray(product.images) && typeof product.images[0] === "string"
          ? product.images[0]
          : null;
    imageById.set(String(product.id), image);
  }

  const hydratedItems = items.map((item: any) => ({
    ...item,
    image:
      typeof item?.image === "string" && item.image.trim()
        ? item.image
        : imageById.get(String(item?.productId || "")) || null,
  }));

  let billing = row.billing_details && Object.keys(row.billing_details || {}).length
    ? row.billing_details
    : {};
  let shipping = row.shipping_address && Object.keys(row.shipping_address || {}).length
    ? row.shipping_address
    : {};

  if ((!Object.keys(billing).length || !Object.keys(shipping).length) && row.user_id) {
    const fallback = await pool.query(
      `SELECT
         u.company_name,
         u.tax_number,
         u.tax_office,
         a.recipient,
         a.phone,
         a.city,
         a.district,
         a.address_line,
         a.postal_code
       FROM users u
       LEFT JOIN LATERAL (
         SELECT recipient, phone, city, district, address_line, postal_code
         FROM b2b_addresses
         WHERE user_id = u.id
         ORDER BY is_default DESC, created_at DESC
         LIMIT 1
       ) a ON TRUE
       WHERE u.id = $1
       LIMIT 1`,
      [row.user_id],
    );
    const info = fallback.rows[0] || {};
    if (!Object.keys(billing).length) {
      billing = {
        companyName: info.company_name || "",
        taxNumber: info.tax_number || "",
        taxOffice: info.tax_office || "",
        recipient: info.recipient || "",
        phone: info.phone || "",
        addressLine: info.address_line || "",
        district: info.district || "",
        city: info.city || "",
        postalCode: info.postal_code || "",
      };
    }
    if (!Object.keys(shipping).length) {
      shipping = {
        method: row.shipping_method || "cargo",
        recipient: info.recipient || "",
        phone: info.phone || "",
        addressLine: info.address_line || "",
        district: info.district || "",
        city: info.city || "",
        postalCode: info.postal_code || "",
        ...(row.shipping_details && typeof row.shipping_details === "object"
          ? row.shipping_details
          : {}),
      };
    }
  }

  return {
    ...row,
    items: hydratedItems,
    billing_details: billing,
    shipping_address: shipping,
    card_last4: cardLast4 || null,
    card_association: cardAssociation || null,
  };
}

export async function registerAdminPlatformRoutes(app: Express, requireAdmin: RequestHandler) {
  await ensurePlatformTables().catch((error) => {
    console.error("Platform tables could not be prepared:", error);
  });

  app.get("/api/public/branding", async (_req, res) => {
    try {
      res.json(await brandingMap());
    } catch (error) {
      console.error("Public branding load failed:", error);
      res.json({});
    }
  });

  app.get("/api/public/payment-settings", async (_req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      return res.json(await getPublicPaymentSettings());
    } catch (error) {
      console.error("Public payment settings load failed:", error);
      return res.json({
        iyzicoConfigured: false,
        bankTransfer: { enabled: false, bankName: "", accountHolder: "", iban: "" },
      });
    }
  });

  app.get("/api/public/homepage", async (_req, res) => {
    try {
      const config = await homepageConfig();
      res.setHeader("Cache-Control", "no-store, max-age=0");
      return res.json({ categories: config.categories });
    } catch (error) {
      console.error("Public homepage config load failed:", error);
      return res.json({ categories: [] });
    }
  });

  app.get("/api/public/mobile-branding/:app", async (req, res) => {
    try {
      const branding = await brandingMap();
      const target = String(req.params.app || "").toLowerCase();

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      if (target === "business") {
        return res.json({
          logo: branding.business_mobile_logo,
          splash: branding.business_mobile_splash,
          updatedAt: Date.now(),
        });
      }

      if (target === "b2b") {
        return res.json({
          logo: branding.b2b_mobile_logo || branding.b2b_logo,
          splash:
            branding.b2b_mobile_splash ||
            branding.b2b_mobile_logo ||
            branding.b2b_logo,
          updatedAt: Date.now(),
        });
      }

      return res.status(404).json({ error: "Mobil marka profili bulunamadı" });
    } catch (error) {
      console.error("Public mobile branding load failed:", error);
      return res.status(500).json({ error: "Mobil marka bilgileri alınamadı" });
    }
  });

  app.get("/api/public/branding-icon/:target", async (req, res) => {
    try {
      const branding = await brandingMap();
      const host = String(req.hostname || req.headers.host || "").toLowerCase();
      const hostIsB2B =
        host === "b2b.ecalisgan.com" ||
        host.includes("caliskan-b2b-web");
      const target =
        req.params.target === "current"
          ? (hostIsB2B ? "b2b" : "admin")
          : req.params.target === "b2b"
            ? "b2b"
            : "admin";
      const value = target === "b2b" ? branding.b2b_favicon : branding.admin_favicon;

      if (!value || !value.startsWith("data:image/")) {
        return res.status(404).end();
      }

      const match = /^data:(image\/[^;,]+)(;base64)?,(.*)$/s.exec(value);
      if (!match) return res.status(404).end();

      const mime = match[1];
      const body = match[2]
        ? Buffer.from(match[3], "base64")
        : Buffer.from(decodeURIComponent(match[3]), "utf8");

      res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "no-store, max-age=0");
      return res.send(body);
    } catch (error) {
      console.error("Branding icon load failed:", error);
      return res.status(500).end();
    }
  });

  app.get("/manifest.webmanifest", async (req, res) => {
    try {
      const branding = await brandingMap();
      const host = String(req.hostname || req.headers.host || "").toLowerCase();
      const isB2B =
        host === "b2b.ecalisgan.com" ||
        host.includes("caliskan-b2b-web");

      const favicon = isB2B ? branding.b2b_favicon : branding.admin_favicon;
      const name = isB2B ? "Çalışkan B2B" : "Çalışkan Core";
      const description = isB2B
        ? "Çalışkan B2B toptan satış platformu"
        : "Çalışkan Core yönetim merkezi";

      const icons = favicon
        ? [
            {
              src: `/api/public/branding-icon/${isB2B ? "b2b" : "admin"}?v=6`,
              sizes: "192x192",
              purpose: "any",
            },
            {
              src: `/api/public/branding-icon/${isB2B ? "b2b" : "admin"}?v=6`,
              sizes: "512x512",
              purpose: "any",
            },
            {
              src: `/api/public/branding-icon/${isB2B ? "b2b" : "admin"}?v=6`,
              sizes: "512x512",
              purpose: "maskable",
            },
          ]
        : [];

      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, max-age=0");
      return res.json({
        id: isB2B ? "/?app=b2b" : "/?app=admin",
        name,
        short_name: name,
        description,
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: isB2B ? "#ffffff" : "#f6f7f9",
        theme_color: "#0B0B0B",
        orientation: "any",
        icons,
      });
    } catch (error) {
      console.error("Dynamic web manifest failed:", error);
      return res.status(500).json({ error: "Manifest oluşturulamadı" });
    }
  });

  app.get("/api/admin/branding", requireAdmin, async (_req, res) => {
    try {
      res.json(await brandingMap());
    } catch (error) {
      console.error("Admin branding load failed:", error);
      res.status(500).json({ error: "Marka ayarları alınamadı" });
    }
  });

  app.get("/api/admin/payment-settings", requireAdmin, async (_req, res) => {
    try {
      return res.json(await getAdminPaymentSettings());
    } catch (error) {
      console.error("Admin payment settings load failed:", error);
      return res.status(500).json({ error: "Ödeme ayarları alınamadı" });
    }
  });

  app.put("/api/admin/payment-settings", requireAdmin, async (req, res) => {
    try {
      return res.json(await savePaymentSettings(req.body || {}));
    } catch (error) {
      console.error("Admin payment settings update failed:", error);
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Ödeme ayarları kaydedilemedi",
      });
    }
  });

  app.get("/api/admin/homepage", requireAdmin, async (_req, res) => {
    try {
      return res.json(await homepageConfig());
    } catch (error) {
      console.error("Admin homepage config load failed:", error);
      return res.status(500).json({ error: "Ana sayfa ayarları alınamadı" });
    }
  });

  app.put("/api/admin/homepage", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });

    const categories = normalizeHomepageCategories(req.body?.categories);

    try {
      await pool.query(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ('b2b_home_categories', $1, NOW())
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(categories)],
      );

      return res.json({
        categories,
        detectedCategories: await detectedProductCategories(),
      });
    } catch (error) {
      console.error("Admin homepage config update failed:", error);
      return res.status(500).json({ error: "Ana sayfa ayarları kaydedilemedi" });
    }
  });

  app.get("/api/public/reels", async (_req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query(
        `SELECT id, title, video_url, thumbnail_url, product_id, sort_order, created_at
         FROM b2b_reels
         WHERE is_active = TRUE
         ORDER BY sort_order ASC, created_at DESC`,
      );

      const rows = await Promise.all(
        result.rows.map(async (row) => ({
          ...row,
          video_url: await ensureReelVideoCompatibility(String(row.video_url || "")),
        })),
      );

      return res.json(rows);
    } catch (error) {
      console.error("Public reels load failed:", error);
      return res.status(500).json({ error: "Reels alınamadı" });
    }
  });

  app.get("/api/admin/reels", requireAdmin, async (_req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query(
        `SELECT id, title, video_url, thumbnail_url, product_id, sort_order, is_active, created_at, updated_at
         FROM b2b_reels
         ORDER BY sort_order ASC, created_at DESC`,
      );
      return res.json(result.rows);
    } catch (error) {
      console.error("Admin reels load failed:", error);
      return res.status(500).json({ error: "Reels alınamadı" });
    }
  });

  app.post("/api/admin/reels/upload", requireAdmin, async (req, res) => {
    try {
      const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
      if (!dataUrl) return res.status(400).json({ error: "Video dosyası bulunamadı" });
      const url = await saveVideoDataUrl(dataUrl);
      return res.status(201).json({ url });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Video yüklenemedi",
      });
    }
  });

  app.post("/api/admin/reels", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 180) : "";
    const videoUrl = typeof req.body?.videoUrl === "string" ? req.body.videoUrl.trim().slice(0, 4000) : "";
    const thumbnailUrl = typeof req.body?.thumbnailUrl === "string" ? req.body.thumbnailUrl.trim().slice(0, 4000) : "";
    const productId = req.body?.productId == null ? "" : String(req.body.productId).trim().slice(0, 120);
    const sortOrder = Number.isFinite(Number(req.body?.sortOrder)) ? Math.trunc(Number(req.body.sortOrder)) : 0;
    const isActive = req.body?.isActive !== false;

    if (!title || !videoUrl) {
      return res.status(400).json({ error: "Reels başlığı ve video zorunludur" });
    }

    try {
      const result = await pool.query(
        `INSERT INTO b2b_reels (title, video_url, thumbnail_url, product_id, sort_order, is_active)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [title, videoUrl, thumbnailUrl || null, productId || null, sortOrder, isActive],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Admin reel create failed:", error);
      return res.status(500).json({ error: "Reels kaydedilemedi" });
    }
  });

  app.patch("/api/admin/reels/:id", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    const id = String(req.params.id || "").trim();
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 180) : "";
    const videoUrl = typeof req.body?.videoUrl === "string" ? req.body.videoUrl.trim().slice(0, 4000) : "";
    const thumbnailUrl = typeof req.body?.thumbnailUrl === "string" ? req.body.thumbnailUrl.trim().slice(0, 4000) : "";
    const productId = req.body?.productId == null ? "" : String(req.body.productId).trim().slice(0, 120);
    const sortOrder = Number.isFinite(Number(req.body?.sortOrder)) ? Math.trunc(Number(req.body.sortOrder)) : 0;
    const isActive = req.body?.isActive !== false;

    if (!title || !videoUrl) {
      return res.status(400).json({ error: "Reels başlığı ve video zorunludur" });
    }

    try {
      const result = await pool.query(
        `UPDATE b2b_reels
         SET title=$2, video_url=$3, thumbnail_url=$4, product_id=$5,
             sort_order=$6, is_active=$7, updated_at=NOW()
         WHERE id::text=$1
         RETURNING *`,
        [id, title, videoUrl, thumbnailUrl || null, productId || null, sortOrder, isActive],
      );
      if (!result.rows[0]) return res.status(404).json({ error: "Reels bulunamadı" });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Admin reel update failed:", error);
      return res.status(500).json({ error: "Reels güncellenemedi" });
    }
  });

  app.delete("/api/admin/reels/:id", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    try {
      const result = await pool.query(
        "DELETE FROM b2b_reels WHERE id::text = $1 RETURNING id",
        [String(req.params.id || "")],
      );
      if (!result.rows[0]) return res.status(404).json({ error: "Reels bulunamadı" });
      return res.json({ ok: true });
    } catch (error) {
      console.error("Admin reel delete failed:", error);
      return res.status(500).json({ error: "Reels silinemedi" });
    }
  });

  app.put("/api/admin/branding", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });

    const entries = Object.entries(req.body || {}).filter(([key]) =>
      (BRANDING_KEYS as readonly string[]).includes(key),
    );

    try {
      for (const [key, rawValue] of entries) {
        if (rawValue === null || rawValue === "") {
          await pool.query(`DELETE FROM platform_settings WHERE key = $1`, [key]);
          continue;
        }

        if (typeof rawValue !== "string") continue;
        if (!rawValue.startsWith("data:image/")) {
          return res.status(400).json({ error: `${key} için yalnızca görsel yüklenebilir` });
        }
        if (rawValue.length > 10_000_000) {
          return res.status(413).json({ error: `${key} görseli çok büyük` });
        }

        await pool.query(
          `INSERT INTO platform_settings (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key)
           DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [key, rawValue],
        );
      }

      res.json(await brandingMap());
    } catch (error) {
      console.error("Branding update failed:", error);
      res.status(500).json({ error: "Marka ayarları kaydedilemedi" });
    }
  });

  app.post("/api/analytics/session", async (req, res) => {
    if (!pool) return res.status(204).send();
    const visitorId = validVisitorId(req.body?.visitorId);
    if (!visitorId) return res.status(400).json({ error: "Geçersiz ziyaretçi" });

    try {
      const recent = await pool.query(
        `SELECT 1 FROM analytics_events
         WHERE visitor_id = $1 AND event_type = 'session'
           AND created_at > NOW() - INTERVAL '20 minutes'
         LIMIT 1`,
        [visitorId],
      );
      if (recent.rowCount === 0) {
        await pool.query(
          `INSERT INTO analytics_events (visitor_id, event_type) VALUES ($1, 'session')`,
          [visitorId],
        );
      } else {
        await pool.query(
          `INSERT INTO analytics_events (visitor_id, event_type) VALUES ($1, 'heartbeat')`,
          [visitorId],
        );
      }
      res.status(204).send();
    } catch (error) {
      console.error("Session analytics failed:", error);
      res.status(204).send();
    }
  });

  app.post("/api/analytics/search", async (req, res) => {
    if (!pool) return res.status(204).send();
    const visitorId = validVisitorId(req.body?.visitorId);
    const query = typeof req.body?.query === "string" ? req.body.query.trim().slice(0, 180) : "";
    if (!visitorId || query.length < 2) return res.status(204).send();

    try {
      await pool.query(
        `INSERT INTO analytics_events (visitor_id, event_type, event_value)
         VALUES ($1, 'search', $2)`,
        [visitorId, query],
      );
      res.status(204).send();
    } catch (error) {
      console.error("Search analytics failed:", error);
      res.status(204).send();
    }
  });

  app.post("/api/analytics/product-view", async (req, res) => {
    if (!pool) return res.status(204).send();
    const visitorId = validVisitorId(req.body?.visitorId);
    const productId = typeof req.body?.productId === "string" || typeof req.body?.productId === "number"
      ? String(req.body.productId).slice(0, 120)
      : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 220) : "";
    if (!visitorId || !productId) return res.status(204).send();

    try {
      await pool.query(
        `INSERT INTO analytics_events (visitor_id, event_type, event_value, product_id)
         VALUES ($1, 'product_view', $2, $3)`,
        [visitorId, name, productId],
      );
      res.status(204).send();
    } catch (error) {
      console.error("Product view analytics failed:", error);
      res.status(204).send();
    }
  });

  app.get("/api/admin/b2b-products", requireAdmin, async (_req, res) => {
    if (!pool) return res.json([]);
    try { await ensureB2BProductSchema(); } catch (error) {
      console.error("B2B product schema repair failed:", error);
      return res.status(500).json({ error: "Ürün veritabanı hazırlanamadı" });
    }

    try {
      const result = await pool.query(`
        SELECT
          id,
          sku,
          name,
          brand,
          category,
          description,
          price,
          stock,
          min_order_qty,
          units_per_box,
          image_data,
          images,
          barcode,
          collection_name,
          variants,
          is_active,
          created_at,
          updated_at
        FROM b2b_products
        ORDER BY created_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Admin B2B products load failed:", error);
      res.status(500).json({ error: "Ürünler alınamadı" });
    }
  });

  app.get("/api/admin/b2b-products/:id", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    try { await ensureB2BProductSchema(); } catch (error) {
      console.error("B2B product schema repair failed:", error);
      return res.status(500).json({ error: "Ürün veritabanı hazırlanamadı" });
    }

    try {
      const result = await pool.query(
        `SELECT
           id, sku, name, brand, category, description, price, stock,
           min_order_qty, units_per_box, image_data, images, barcode,
           collection_name, features, variants, is_active, created_at, updated_at
         FROM b2b_products
         WHERE id::text = $1
         LIMIT 1`,
        [String(req.params.id)],
      );

      if (!result.rows[0]) return res.status(404).json({ error: "Ürün bulunamadı" });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Admin B2B product detail failed:", error);
      return res.status(500).json({ error: "Ürün bilgileri alınamadı" });
    }
  });

  app.post("/api/admin/b2b-products", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    try { await ensureB2BProductSchema(); } catch (error) {
      console.error("B2B product schema repair failed:", error);
      return res.status(500).json({ error: "Ürün veritabanı hazırlanamadı" });
    }
    const product = parseAdminProductPayload(req.body);

    if (!product.sku || !product.name) {
      return res.status(400).json({ error: "Stok kodu ve ürün adı zorunludur" });
    }
    if (!Number.isFinite(product.price) || product.price < 0) {
      return res.status(400).json({ error: "Geçerli bir fiyat girin" });
    }
    if (product.images.length === 0) {
      return res.status(400).json({ error: "Ürün görseli zorunludur" });
    }

    try {
      const result = await pool.query(
        `INSERT INTO b2b_products (
          sku, name, brand, category, description, price, stock,
          min_order_qty, units_per_box, image_data, images, barcode,
          collection_name, variants, is_active, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14::jsonb,TRUE,NOW())
        RETURNING *`,
        [
          product.sku,
          product.name,
          product.brand || null,
          product.category || null,
          product.description || null,
          product.price,
          product.stock,
          product.minOrderQty,
          product.unitsPerBox,
          product.images[0],
          JSON.stringify(product.images),
          product.barcode || null,
          product.collectionName || null,
          JSON.stringify(product.variants),
        ],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "Bu stok koduyla kayıtlı bir ürün var" });
      }
      console.error("Admin B2B product create failed:", error);
      return res.status(500).json({ error: "Ürün eklenemedi" });
    }
  });

  app.post("/api/admin/b2b-products/bulk", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    try { await ensureB2BProductSchema(); } catch (error) {
      console.error("B2B product schema repair failed:", error);
      return res.status(500).json({ error: "Ürün veritabanı hazırlanamadı" });
    }

    const rawProducts = Array.isArray(req.body?.products)
      ? req.body.products.slice(0, 500)
      : [];
    const allowMissingImages = req.body?.allowMissingImages === true;

    if (rawProducts.length === 0) {
      return res.status(400).json({ error: "Aktarılacak ürün bulunamadı" });
    }

    const parsedProducts = rawProducts.map(parseAdminProductPayload);
    const invalid = parsedProducts.findIndex(
      (item) =>
        !item.sku ||
        !item.name ||
        !Number.isFinite(item.price) ||
        item.price < 0 ||
        (!allowMissingImages && item.images.length === 0),
    );

    if (invalid >= 0) {
      return res.status(400).json({
        error: allowMissingImages
          ? `${invalid + 1}. üründe stok kodu, ürün adı ve geçerli fiyat zorunludur`
          : `${invalid + 1}. üründe stok kodu, ürün adı, geçerli fiyat ve en az bir görsel zorunludur`,
      });
    }

    // Aynı stok kodu listede birden fazla kez varsa aktarımı durdurmak yerine
    // son satırı esas al. Böylece listedeki diğer ürünler de kesintisiz aktarılır.
    const uniqueBySku = new Map<string, ReturnType<typeof parseAdminProductPayload>>();
    for (const product of parsedProducts) {
      uniqueBySku.set(product.sku.toLocaleLowerCase("tr-TR"), product);
    }
    const products = Array.from(uniqueBySku.values());

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const created = [];

      for (const product of products) {
        const incomingImages = product.images;
        const incomingMainImage = incomingImages[0] || null;

        const result = await client.query(
          `INSERT INTO b2b_products (
            sku, name, brand, category, description, price, stock,
            min_order_qty, units_per_box, image_data, images, barcode,
            collection_name, variants, is_active, updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14::jsonb,TRUE,NOW())
          ON CONFLICT (sku) DO UPDATE SET
            name = EXCLUDED.name,
            brand = EXCLUDED.brand,
            category = EXCLUDED.category,
            description = EXCLUDED.description,
            price = EXCLUDED.price,
            stock = EXCLUDED.stock,
            min_order_qty = EXCLUDED.min_order_qty,
            units_per_box = EXCLUDED.units_per_box,
            image_data = COALESCE(EXCLUDED.image_data, b2b_products.image_data),
            images = CASE
              WHEN jsonb_array_length(EXCLUDED.images) > 0 THEN EXCLUDED.images
              ELSE b2b_products.images
            END,
            barcode = EXCLUDED.barcode,
            collection_name = EXCLUDED.collection_name,
            variants = EXCLUDED.variants,
            is_active = TRUE,
            updated_at = NOW()
          RETURNING id, sku, name`,
          [
            product.sku,
            product.name,
            product.brand || null,
            product.category || null,
            product.description || null,
            product.price,
            product.stock,
            product.minOrderQty,
            product.unitsPerBox,
            incomingMainImage,
            JSON.stringify(incomingImages),
            product.barcode || null,
            product.collectionName || null,
            JSON.stringify(product.variants),
          ],
        );
        created.push(result.rows[0]);
      }

      await client.query("COMMIT");
      return res.status(201).json({
        count: created.length,
        inputCount: rawProducts.length,
        products: created,
        message: `${created.length} ürün başarıyla içe aktarıldı veya güncellendi`,
      });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Admin B2B bulk product create failed:", error);
      return res.status(500).json({ error: "Ürünler toplu olarak aktarılamadı" });
    } finally {
      client.release();
    }
  });

  app.delete("/api/admin/b2b-products/bulk", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    try { await ensureB2BProductSchema(); } catch (error) {
      console.error("B2B product schema repair failed:", error);
      return res.status(500).json({ error: "Ürün veritabanı hazırlanamadı" });
    }

    const ids = Array.isArray(req.body?.ids)
      ? Array.from(
          new Set(
            req.body.ids
              .map((value: unknown) => String(value ?? "").trim())
              .filter((value: string) => value.length > 0),
          ),
        ).slice(0, 250)
      : [];

    if (ids.length === 0) {
      return res.status(400).json({ error: "Silinecek ürün seçilmedi" });
    }

    try {
      const result = await pool.query(
        `DELETE FROM b2b_products
         WHERE id::text = ANY($1::text[])
         RETURNING id`,
        [ids],
      );

      return res.json({
        count: result.rowCount || 0,
        deletedIds: result.rows.map((row) => String(row.id)),
      });
    } catch (error) {
      console.error("Admin B2B bulk product delete failed:", error);
      return res.status(500).json({ error: "Seçili ürünler silinemedi" });
    }
  });

  app.delete("/api/admin/b2b-products/:id", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    try { await ensureB2BProductSchema(); } catch (error) {
      console.error("B2B product schema repair failed:", error);
      return res.status(500).json({ error: "Ürün veritabanı hazırlanamadı" });
    }

    try {
      const result = await pool.query(
        `DELETE FROM b2b_products
         WHERE id::text = $1
         RETURNING id, sku, name`,
        [String(req.params.id)],
      );

      if (!result.rows[0]) {
        return res.status(404).json({ error: "Ürün bulunamadı" });
      }

      return res.json({
        deleted: true,
        product: result.rows[0],
      });
    } catch (error) {
      console.error("Admin B2B product delete failed:", error);
      return res.status(500).json({ error: "Ürün silinemedi" });
    }
  });

  app.patch("/api/admin/b2b-products/:id", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    try { await ensureB2BProductSchema(); } catch (error) {
      console.error("B2B product schema repair failed:", error);
      return res.status(500).json({ error: "Ürün veritabanı hazırlanamadı" });
    }
    const product = parseAdminProductPayload(req.body);

    if (!product.sku || !product.name) {
      return res.status(400).json({ error: "Stok kodu ve ürün adı zorunludur" });
    }
    if (!Number.isFinite(product.price) || product.price < 0) {
      return res.status(400).json({ error: "Geçerli bir fiyat girin" });
    }
    if (product.images.length === 0) {
      return res.status(400).json({ error: "Ürün görseli zorunludur" });
    }

    try {
      const result = await pool.query(
        `UPDATE b2b_products
         SET sku = $2,
             name = $3,
             brand = $4,
             category = $5,
             description = $6,
             price = $7,
             stock = $8,
             min_order_qty = $9,
             units_per_box = $10,
             image_data = $11,
             images = $12::jsonb,
             barcode = $13,
             collection_name = $14,
             variants = $15::jsonb,
             updated_at = NOW()
         WHERE id::text = $1
         RETURNING *`,
        [
          String(req.params.id),
          product.sku,
          product.name,
          product.brand || null,
          product.category || null,
          product.description || null,
          product.price,
          product.stock,
          product.minOrderQty,
          product.unitsPerBox,
          product.images[0],
          JSON.stringify(product.images),
          product.barcode || null,
          product.collectionName || null,
          JSON.stringify(product.variants),
        ],
      );

      if (!result.rows[0]) return res.status(404).json({ error: "Ürün bulunamadı" });
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "Bu stok kodu başka bir üründe kullanılıyor" });
      }
      console.error("Admin B2B product update failed:", error);
      return res.status(500).json({ error: "Ürün güncellenemedi" });
    }
  });


  app.get("/api/admin/orders", requireAdmin, async (_req, res) => {
    if (!pool) return res.json([]);

    try {
      const result = await pool.query(`
        SELECT id, order_number, customer_email, status, item_count, total_amount,
               payment_method, payment_provider, payment_status, card_last4,
               card_association, shipping_method, shipping_details, billing_details,
               shipping_address, items, cancel_requested_at, created_at
        FROM b2b_orders
        WHERE COALESCE(status, '') <> 'payment_failed'
          AND COALESCE(payment_status, '') NOT IN ('FAILURE','initialize_failed')
          AND COALESCE(payment_status, '') NOT LIKE '3ds_failed%'
        ORDER BY created_at DESC
        LIMIT 250
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Admin orders load failed:", error);
      res.status(500).json({ error: "Siparişler alınamadı" });
    }
  });

  app.get("/api/admin/orders/:id", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });

    try {
      const result = await pool.query(
        `SELECT *
         FROM b2b_orders
         WHERE id::text = $1
           AND COALESCE(status, '') <> 'payment_failed'
           AND COALESCE(payment_status, '') NOT IN ('FAILURE','initialize_failed')
           AND COALESCE(payment_status, '') NOT LIKE '3ds_failed%'
         LIMIT 1`,
        [String(req.params.id || "")],
      );

      if (!result.rows[0]) {
        return res.status(404).json({ error: "Sipariş bulunamadı" });
      }

      return res.json(await hydrateAdminOrderDetail(result.rows[0]));
    } catch (error) {
      console.error("Admin order detail load failed:", error);
      return res.status(500).json({ error: "Sipariş detayı alınamadı" });
    }
  });

  app.get("/api/admin/b2b-customers", requireAdmin, async (_req, res) => {
    if (!pool) return res.json([]);

    try {
      const result = await pool.query(`
        SELECT
          u.id,
          u.company_name,
          u.first_name,
          u.last_name,
          u.email,
          u.tax_number,
          u.tax_office,
          u.is_active,
          u.application_status,
          u.created_at,
          a.recipient,
          a.phone,
          a.city,
          a.district,
          a.address_line,
          a.postal_code,
          COALESCE(o.total_orders, 0)::int AS total_orders,
          COALESCE(o.total_revenue, 0)::numeric AS total_revenue,
          o.last_order_at
        FROM users u
        LEFT JOIN LATERAL (
          SELECT recipient, phone, city, district, address_line, postal_code
          FROM b2b_addresses
          WHERE user_id = u.id
          ORDER BY is_default DESC, created_at DESC
          LIMIT 1
        ) a ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::int AS total_orders,
            COALESCE(SUM(total_amount), 0)::numeric AS total_revenue,
            MAX(created_at) AS last_order_at
          FROM b2b_orders
          WHERE user_id = u.id
            AND COALESCE(status, '') <> 'payment_failed'
            AND COALESCE(payment_status, '') NOT IN ('FAILURE','initialize_failed')
            AND COALESCE(payment_status, '') NOT LIKE '3ds_failed%'
        ) o ON TRUE
        WHERE u.role = 'b2b_customer'
        ORDER BY COALESCE(o.total_revenue, 0) DESC, u.created_at DESC
        LIMIT 500
      `);

      const customers = result.rows.map((row: any) => {
        const revenue = Number(row.total_revenue || 0);
        const orders = Number(row.total_orders || 0);
        const active = Number(row.is_active || 0) === 1;
        const segment = !active
          ? 'riskli'
          : revenue >= 100000 || orders >= 25
            ? 'vip'
            : orders <= 1
              ? 'yeni'
              : 'aktif';

        return {
          ...row,
          contact_name:
            [row.first_name, row.last_name].filter(Boolean).join(' ') ||
            row.recipient ||
            row.email,
          segment,
          current_balance: 0,
          credit_limit: 0,
        };
      });

      return res.json(customers);
    } catch (error) {
      console.error("Admin B2B customers load failed:", error);
      return res.status(500).json({ error: "Müşteriler alınamadı" });
    }
  });

  app.get("/api/admin/b2b-customers/:id", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });

    try {
      const customer = await pool.query(
        `SELECT
           u.id,
           u.company_name,
           u.first_name,
           u.last_name,
           u.email,
           u.tax_number,
           u.tax_office,
           u.is_active,
           u.application_status,
           u.created_at
         FROM users u
         WHERE u.id::text = $1 AND u.role = 'b2b_customer'
         LIMIT 1`,
        [String(req.params.id || "")],
      );

      if (!customer.rows[0]) {
        return res.status(404).json({ error: "Müşteri bulunamadı" });
      }

      const [addresses, orders] = await Promise.all([
        pool.query(
          `SELECT id, title, recipient, phone, city, district, address_line, postal_code,
                  is_default, created_at
           FROM b2b_addresses
           WHERE user_id = $1
           ORDER BY is_default DESC, created_at DESC`,
          [customer.rows[0].id],
        ),
        pool.query(
          `SELECT id, order_number, customer_email, status, item_count, total_amount,
                  payment_method, payment_status, created_at
           FROM b2b_orders
           WHERE user_id = $1
             AND COALESCE(status, '') <> 'payment_failed'
             AND COALESCE(payment_status, '') NOT IN ('FAILURE','initialize_failed')
             AND COALESCE(payment_status, '') NOT LIKE '3ds_failed%'
           ORDER BY created_at DESC
           LIMIT 100`,
          [customer.rows[0].id],
        ),
      ]);

      const totalRevenue = orders.rows.reduce(
        (sum: number, order: any) => sum + Number(order.total_amount || 0),
        0,
      );
      const active = Number(customer.rows[0].is_active || 0) === 1;
      const segment = !active
        ? 'riskli'
        : totalRevenue >= 100000 || orders.rows.length >= 25
          ? 'vip'
          : orders.rows.length <= 1
            ? 'yeni'
            : 'aktif';

      return res.json({
        ...customer.rows[0],
        contact_name:
          [customer.rows[0].first_name, customer.rows[0].last_name]
            .filter(Boolean)
            .join(' ') ||
          addresses.rows[0]?.recipient ||
          customer.rows[0].email,
        segment,
        total_orders: orders.rows.length,
        total_revenue: totalRevenue,
        current_balance: 0,
        credit_limit: 0,
        addresses: addresses.rows,
        orders: orders.rows,
      });
    } catch (error) {
      console.error("Admin B2B customer detail failed:", error);
      return res.status(500).json({ error: "Müşteri detayı alınamadı" });
    }
  });

  app.get("/api/admin/returns", requireAdmin, async (_req, res) => {
    if (!pool) return res.json([]);

    try {
      const result = await pool.query(`
        SELECT
          p.id,
          p.name,
          p.brand,
          p.status,
          p.created_at,
          c.name AS customer_name,
          c.phone AS customer_phone,
          t.receipt_number
        FROM products p
        LEFT JOIN tickets t ON t.id = p.ticket_id
        LEFT JOIN customers c ON c.id = t.customer_id
        WHERE p.category = 'iade'
        ORDER BY p.created_at DESC
        LIMIT 250
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Admin returns load failed:", error);
      res.status(500).json({ error: "İade kayıtları alınamadı" });
    }
  });

  app.get("/api/admin/dashboard-overview", requireAdmin, async (_req, res) => {
    if (!pool) {
      return res.json({
        sessionUsers: 0,
        liveUsers: 0,
        conversionRate: 0,
        orderCount: 0,
        activeReturns: 0,
        recentOrders: [],
        recentReturns: [],
        topSearches: [],
        topViewedProducts: [],
      });
    }

    try {
      await ensureDashboardSchema();

      const [
        sessionUsers,
        liveUsers,
        orders,
        recentOrders,
        returns,
        recentReturns,
        support,
        lowStock,
        todayRevenue,
        topSearches,
        topViewedProducts,
      ] = await Promise.all([
        pool.query(`
          SELECT COUNT(DISTINCT visitor_id)::int AS count
          FROM analytics_events
          WHERE event_type IN ('session','heartbeat')
            AND (created_at AT TIME ZONE 'Europe/Istanbul')::date =
                (NOW() AT TIME ZONE 'Europe/Istanbul')::date
        `),
        pool.query(`
          SELECT COUNT(DISTINCT visitor_id)::int AS count
          FROM analytics_events
          WHERE event_type IN ('session','heartbeat')
            AND created_at > NOW() - INTERVAL '5 minutes'
        `),
        pool.query(`
          SELECT COUNT(*)::int AS count
          FROM b2b_orders
          WHERE (created_at AT TIME ZONE 'Europe/Istanbul')::date =
                (NOW() AT TIME ZONE 'Europe/Istanbul')::date
            AND COALESCE(status, '') <> 'payment_failed'
            AND COALESCE(payment_status, '') NOT IN ('FAILURE','initialize_failed')
            AND COALESCE(payment_status, '') NOT LIKE '3ds_failed%'
        `),
        pool.query(`
          SELECT id, order_number, customer_email, status, item_count, total_amount,
                 payment_method, payment_provider, payment_status, created_at
          FROM b2b_orders
          WHERE COALESCE(status, '') <> 'payment_failed'
            AND COALESCE(payment_status, '') NOT IN ('FAILURE','initialize_failed')
            AND COALESCE(payment_status, '') NOT LIKE '3ds_failed%'
          ORDER BY created_at DESC
          LIMIT 6
        `),
        pool.query(`
          SELECT COUNT(*)::int AS count
          FROM products
          WHERE category = 'iade' AND status <> 'teslim_edildi'
        `),
        pool.query(`
          SELECT p.id, p.name, p.brand, p.status, p.created_at,
                 c.name AS customer_name
          FROM products p
          LEFT JOIN tickets t ON t.id = p.ticket_id
          LEFT JOIN customers c ON c.id = t.customer_id
          WHERE p.category = 'iade'
          ORDER BY p.created_at DESC
          LIMIT 6
        `),
        pool.query(`
          SELECT COUNT(*)::int AS count
          FROM b2b_support_tickets
          WHERE COALESCE(status, 'open') NOT IN ('closed','resolved','done')
        `),
        pool.query(`
          SELECT COUNT(*)::int AS count
          FROM b2b_products
          WHERE is_active = TRUE
            AND stock <= GREATEST(5, units_per_box)
        `),
        pool.query(`
          SELECT COALESCE(SUM(total_amount), 0)::numeric AS amount
          FROM b2b_orders
          WHERE (created_at AT TIME ZONE 'Europe/Istanbul')::date =
                (NOW() AT TIME ZONE 'Europe/Istanbul')::date
            AND COALESCE(status, '') <> 'payment_failed'
            AND COALESCE(payment_status, '') NOT IN ('FAILURE','initialize_failed')
            AND COALESCE(payment_status, '') NOT LIKE '3ds_failed%'
        `),
        pool.query(`
          SELECT event_value AS query, COUNT(*)::int AS count
          FROM analytics_events
          WHERE event_type = 'search'
            AND created_at > NOW() - INTERVAL '30 days'
            AND COALESCE(event_value, '') <> ''
          GROUP BY event_value
          ORDER BY COUNT(*) DESC
          LIMIT 8
        `),
        pool.query(`
          SELECT product_id, MAX(event_value) AS name, COUNT(*)::int AS count
          FROM analytics_events
          WHERE event_type = 'product_view'
            AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY product_id
          ORDER BY COUNT(*) DESC
          LIMIT 8
        `),
      ]);

      const sessions = Number(sessionUsers.rows[0]?.count || 0);
      const todayOrders = Number(orders.rows[0]?.count || 0);
      const conversionRate = sessions > 0 ? Number(((todayOrders / sessions) * 100).toFixed(1)) : 0;

      res.json({
        sessionUsers: sessions,
        liveUsers: Number(liveUsers.rows[0]?.count || 0),
        conversionRate,
        orderCount: todayOrders,
        activeReturns: Number(returns.rows[0]?.count || 0),
        openSupport: Number(support.rows[0]?.count || 0),
        lowStock: Number(lowStock.rows[0]?.count || 0),
        todayRevenue: Number(todayRevenue.rows[0]?.amount || 0),
        recentOrders: recentOrders.rows,
        recentReturns: recentReturns.rows,
        topSearches: topSearches.rows,
        topViewedProducts: topViewedProducts.rows,
      });
    } catch (error) {
      console.error("Admin dashboard overview failed:", error);
      res.status(500).json({ error: "Dashboard verileri alınamadı" });
    }
  });
}
