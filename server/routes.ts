import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCustomerSchema, insertWarehouseSchema, insertSupplierSchema, insertInvoiceSchema, insertUserSchema } from "@shared/schema";
import { saveImageDataUrl, persistProductImageUrl } from "./image-storage";
import { z } from "zod";
import OpenAI from "openai";
import { registerProductAIRoutes } from "./product-ai";
import { pool } from "./db";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { registerAdminPlatformRoutes } from "./admin-platform";
import {
  completeIyzico3DS,
  initializeIyzico3DS,
  initializeIyzicoCheckout,
  isIyzicoConfigured,
  retrieveIyzicoInstallments,
  retrieveIyzicoCheckout,
} from "./iyzico";
import { getPaymentConfig } from "./payment-config";

let dbReady = false;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt${salt}${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  let salt = "";
  let expectedHex = "";

  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    salt = parts[1] || "";
    expectedHex = parts[2] || "";
  } else if (stored.startsWith("scrypt") && stored.length === 166) {
    // Backward compatibility for temporary passwords created before
    // the separator fix: "scrypt" + 32-char salt + 128-char hash.
    salt = stored.slice(6, 38);
    expectedHex = stored.slice(38);
  } else {
    return stored === password;
  }

  if (!/^[0-9a-f]{32}$/i.test(salt) || !/^[0-9a-f]{128}$/i.test(expectedHex)) {
    return false;
  }

  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

type MobileAuthPayload = {
  uid: number;
  exp: number;
};

function mobileAuthSecret() {
  return (
    process.env.MOBILE_AUTH_SECRET ||
    process.env.SESSION_SECRET ||
    "local-rma-panel-session-secret"
  );
}

function issueMobileAuthToken(userId: number) {
  const payload: MobileAuthPayload = {
    uid: userId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", mobileAuthSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function mobileTokenUserId(req: Request): number | undefined {
  const authorization = String(req.headers.authorization || "").trim();
  if (!authorization.toLowerCase().startsWith("bearer ")) return undefined;

  const token = authorization.slice(7).trim();
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return undefined;

  const expected = createHmac("sha256", mobileAuthSecret())
    .update(encoded)
    .digest("base64url");

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as MobileAuthPayload;

    if (
      !Number.isFinite(payload.uid) ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= Date.now()
    ) {
      return undefined;
    }

    return Number(payload.uid);
  } catch {
    return undefined;
  }
}

function sessionUserId(req: Request): number | undefined {
  return (
    (req.session as { userId?: number }).userId ||
    mobileTokenUserId(req)
  );
}

function authResponseUser(user: any, usernameOverride?: string) {
  const username = String(usernameOverride || user.username || "").trim();
  return {
    id: user.id,
    username,
    email: username,
    role: user.role,
    appAccess: user.appAccess,
    isActive: user.isActive === 1 || user.isActive === true,
  };
}

function authResponse(user: any, usernameOverride?: string) {
  const profile = authResponseUser(user, usernameOverride);
  return {
    ...profile,
    user: profile,
    token: issueMobileAuthToken(Number(user.id)),
  };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (sessionUserId(req)) {
    return next();
  }
  return res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
}

const aiChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(8000),
  })).min(1).max(20),
});

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = sessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
  const user = await storage.getUser(userId);
  if (!user || user.isActive !== 1 || !["super_admin", "admin"].includes(user.role)) {
    return res.status(403).json({ error: "Bu işlem için yönetici yetkisi gerekiyor" });
  }
  return next();
}

async function requireB2B(req: Request, res: Response, next: NextFunction) {
  const userId = sessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Giriş yapmanız gerekiyor" });

  const user = await storage.getUser(userId);
  if (!user || user.isActive !== 1 || user.role !== "b2b_customer") {
    return res.status(403).json({ error: "Aktif B2B hesabı gerekiyor" });
  }

  (res.locals as any).b2bUser = user;
  return next();
}

async function canViewB2BPrices(req: Request): Promise<boolean> {
  const userId = sessionUserId(req);
  if (!userId) return false;

  const user = await storage.getUser(userId);
  return Boolean(
    user &&
    user.isActive === 1 &&
    user.role === "b2b_customer",
  );
}

type CheckoutProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minOrderQty: number;
  unitsPerBox: number;
  maxBoxQty: number;
  image: string | null;
};

function cleanOrderQuantity(value: unknown) {
  const qty = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(qty) ? qty : 0;
}

function isValidPaymentCardNumber(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 15 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function requestIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(raw || req.socket.remoteAddress || "127.0.0.1")
    .split(",")[0]
    .trim()
    .replace(/^::ffff:/, "")
    .slice(0, 64);
}

function newB2BOrderNumber() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return `CLK-${stamp}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function checkoutProduct(productId: unknown, quantity: unknown): Promise<CheckoutProduct> {
  if (!pool) throw new Error("Veritabanı bağlantısı yok");

  const qty = cleanOrderQuantity(quantity);
  if (!String(productId || "").trim() || qty <= 0) {
    throw new Error("Ürün ve adet bilgisi geçersiz");
  }

  const result = await pool.query(
    `SELECT id, sku, name, category, price, stock, min_order_qty, units_per_box,
            image_data, images
     FROM b2b_products
     WHERE id::text = $1
       AND is_active IS DISTINCT FROM FALSE
     LIMIT 1`,
    [String(productId)],
  );

  const row = result.rows[0];
  if (!row) throw new Error("Ürün bulunamadı");

  const price = Number(row.price);
  const stock = Math.max(0, Number(row.stock || 0));
  const minOrderQty = Math.max(1, Number(row.min_order_qty || 1));
  const unitsPerBox = Math.max(1, Number(row.units_per_box || 1));
  const maxBoxQty = Math.max(0, Math.floor(stock / unitsPerBox));

  if (!Number.isFinite(price) || price < 0) throw new Error("Ürün fiyatı geçersiz");
  if (qty < minOrderQty) throw new Error(`Minimum sipariş koli adedi ${minOrderQty}`);
  if (maxBoxQty < minOrderQty) throw new Error("Tam koli siparişi için yeterli stok yok");
  if (qty > maxBoxQty) {
    throw new Error(`Stok en fazla ${maxBoxQty} koli (${stock} adet) siparişe izin veriyor`);
  }

  return {
    id: String(row.id),
    sku: String(row.sku || ""),
    name: String(row.name || "Ürün"),
    category: String(row.category || "Genel"),
    price,
    stock,
    minOrderQty,
    unitsPerBox,
    maxBoxQty,
    image:
      typeof row.image_data === "string" && row.image_data.trim()
        ? row.image_data
        : Array.isArray(row.images) && typeof row.images[0] === "string"
          ? row.images[0]
          : null,
  };
}

async function checkoutItems(rawItems: unknown) {
  const source = Array.isArray(rawItems) ? rawItems.slice(0, 100) : [];
  if (source.length === 0) throw new Error("Siparişe ürün eklenmedi");

  const items: Array<{
    product: CheckoutProduct;
    quantity: number;
    totalUnits: number;
    total: number;
  }> = [];

  for (const raw of source) {
    const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const quantity = cleanOrderQuantity(value.quantity);
    const product = await checkoutProduct(value.productId, quantity);
    const totalUnits = quantity * product.unitsPerBox;
    items.push({
      product,
      quantity,
      totalUnits,
      total: Number((product.price * totalUnits).toFixed(2)),
    });
  }

  const total = Number(
    items.reduce((sum, item) => sum + item.total, 0).toFixed(2),
  );
  const boxCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.totalUnits, 0);

  return { items, total, itemCount, boxCount };
}

type ShippingSelection =
  | { method: "cargo"; details: { carrier: "PTT Kargo" } }
  | { method: "freight"; details: { companyName: string; phone: string } }
  | { method: "pickup"; details: { address: string; pickupTime: "09:00" | "15:00" | "17:00" } };

function checkoutShipping(value: unknown): ShippingSelection {
  const raw = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const method = String(raw.method || "").trim();

  if (method === "cargo") {
    return {
      method: "cargo",
      details: { carrier: "PTT Kargo" },
    };
  }

  if (method === "freight") {
    const companyName = String(raw.companyName || "").trim().slice(0, 160);
    const phone = String(raw.phone || "").trim().slice(0, 40);
    if (companyName.length < 2 || phone.replace(/\D/g, "").length < 7) {
      throw new Error("Ambar için firma adı ve geçerli telefon numarası zorunludur");
    }
    return {
      method: "freight",
      details: { companyName, phone },
    };
  }

  if (method === "pickup") {
    const pickupTime = String(raw.pickupTime || "").trim();
    if (!["09:00", "15:00", "17:00"].includes(pickupTime)) {
      throw new Error("Teslim alma saati 09:00, 15:00 veya 17:00 olmalıdır");
    }
    return {
      method: "pickup",
      details: {
        address: "İSTOÇ Toptan Ticaret Merkezi Mahmutbey Mh. 19 Ada 23 Numara Bağcılar/İstanbul",
        pickupTime: pickupTime as "09:00" | "15:00" | "17:00",
      },
    };
  }

  throw new Error("Nakliye seçeneği seçin");
}

async function checkoutAddress(userId: number, addressId: unknown) {
  if (!pool) throw new Error("Veritabanı bağlantısı yok");

  const cleanAddressId = String(addressId || "").trim();
  const result = cleanAddressId
    ? await pool.query(
        `SELECT id, recipient, phone, city, district, address_line, postal_code, is_default
         FROM b2b_addresses
         WHERE user_id = $1 AND id::text = $2
         LIMIT 1`,
        [userId, cleanAddressId],
      )
    : await pool.query(
        `SELECT id, recipient, phone, city, district, address_line, postal_code, is_default
         FROM b2b_addresses
         WHERE user_id = $1
         ORDER BY is_default DESC, created_at DESC
         LIMIT 1`,
        [userId],
      );

  if (!result.rows[0]) {
    throw new Error("Ödeme için kayıtlı teslimat adresi gerekiyor");
  }
  return result.rows[0];
}

async function bankTransferSettings() {
  const config = await getPaymentConfig();
  return config.bankTransfer;
}

function buildOrderSnapshots(
  user: any,
  address: any,
  shipping: ShippingSelection,
  rawContext: unknown,
) {
  const context =
    rawContext && typeof rawContext === "object"
      ? rawContext as Record<string, unknown>
      : {};

  const source = String(context.source || "B2B mağaza").slice(0, 120);
  const entryPath = String(context.entryPath || "").slice(0, 500);
  const previousPath = String(context.previousPath || "").slice(0, 500);

  const billingDetails = {
    companyName: String(user.companyName || ""),
    taxNumber: String(user.taxNumber || ""),
    taxOffice: String(user.taxOffice || ""),
    recipient: String(address.recipient || ""),
    phone: String(address.phone || ""),
    addressLine: String(address.address_line || ""),
    district: String(address.district || ""),
    city: String(address.city || ""),
    postalCode: String(address.postal_code || ""),
  };

  const shippingAddress =
    shipping.method === "pickup"
      ? {
          method: shipping.method,
          recipient: String(address.recipient || ""),
          phone: String(address.phone || ""),
          addressLine: shipping.details.address,
          district: "Bağcılar",
          city: "İstanbul",
          postalCode: "34218",
          pickupTime: shipping.details.pickupTime,
        }
      : {
          method: shipping.method,
          recipient: String(address.recipient || ""),
          phone: String(address.phone || ""),
          addressLine: String(address.address_line || ""),
          district: String(address.district || ""),
          city: String(address.city || ""),
          postalCode: String(address.postal_code || ""),
          ...(shipping.method === "cargo"
            ? { carrier: shipping.details.carrier }
            : {
                freightCompany: shipping.details.companyName,
                freightPhone: shipping.details.phone,
              }),
        };

  const checkoutTrace = {
    source,
    entryPath,
    previousPath,
    stages: [
      source,
      "Ödeme sayfası",
      "iyzico güvenli ödeme",
    ],
    capturedAt: new Date().toISOString(),
  };

  return { billingDetails, shippingAddress, checkoutTrace };
}

async function ensureB2BAccountTables() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS b2b_addresses (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      recipient TEXT,
      phone TEXT,
      city TEXT,
      district TEXT,
      address_line TEXT,
      postal_code TEXT,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE b2b_addresses ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE b2b_addresses ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE b2b_addresses ADD COLUMN IF NOT EXISTS recipient TEXT;
    ALTER TABLE b2b_addresses ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE b2b_addresses ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE b2b_addresses ADD COLUMN IF NOT EXISTS district TEXT;
    ALTER TABLE b2b_addresses ADD COLUMN IF NOT EXISTS address_line TEXT;
    ALTER TABLE b2b_addresses ADD COLUMN IF NOT EXISTS postal_code TEXT;
    ALTER TABLE b2b_addresses ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE b2b_addresses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS b2b_addresses_user_idx ON b2b_addresses(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS b2b_payment_methods (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT,
      brand TEXT,
      last4 TEXT,
      holder_name TEXT,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE b2b_payment_methods ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE b2b_payment_methods ADD COLUMN IF NOT EXISTS provider TEXT;
    ALTER TABLE b2b_payment_methods ADD COLUMN IF NOT EXISTS brand TEXT;
    ALTER TABLE b2b_payment_methods ADD COLUMN IF NOT EXISTS last4 TEXT;
    ALTER TABLE b2b_payment_methods ADD COLUMN IF NOT EXISTS holder_name TEXT;
    ALTER TABLE b2b_payment_methods ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE b2b_payment_methods ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS b2b_payment_methods_user_idx ON b2b_payment_methods(user_id, created_at DESC);

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
      shipping_method TEXT,
      shipping_details JSONB NOT NULL DEFAULT '{}'::jsonb,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS order_no TEXT;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS order_number TEXT;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS item_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS payment_provider TEXT;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS payment_status TEXT;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS payment_token TEXT;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS shipping_method TEXT;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS shipping_details JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS card_last4 TEXT;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS card_association TEXT;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS billing_details JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS checkout_trace JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ;
    ALTER TABLE b2b_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    CREATE INDEX IF NOT EXISTS b2b_orders_user_idx ON b2b_orders(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS b2b_orders_payment_token_idx ON b2b_orders(payment_token);

    CREATE TABLE IF NOT EXISTS b2b_returns (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      order_number TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE b2b_returns ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE b2b_returns ADD COLUMN IF NOT EXISTS order_number TEXT;
    ALTER TABLE b2b_returns ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE b2b_returns ADD COLUMN IF NOT EXISTS reason TEXT;
    ALTER TABLE b2b_returns ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS b2b_returns_user_idx ON b2b_returns(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS b2b_invoices (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      invoice_number TEXT,
      order_number TEXT,
      total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      download_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE b2b_invoices ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE b2b_invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
    ALTER TABLE b2b_invoices ADD COLUMN IF NOT EXISTS order_number TEXT;
    ALTER TABLE b2b_invoices ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
    ALTER TABLE b2b_invoices ADD COLUMN IF NOT EXISTS download_url TEXT;
    ALTER TABLE b2b_invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS b2b_invoices_user_idx ON b2b_invoices(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS b2b_support_tickets (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE b2b_support_tickets ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE b2b_support_tickets ADD COLUMN IF NOT EXISTS subject TEXT;
    ALTER TABLE b2b_support_tickets ADD COLUMN IF NOT EXISTS message TEXT;
    ALTER TABLE b2b_support_tickets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
    ALTER TABLE b2b_support_tickets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS b2b_support_user_idx ON b2b_support_tickets(user_id, created_at DESC);
  `);

  await ensureB2BOrderIdDefault();
}

async function ensureB2BOrderIdDefault() {
  if (!pool) return;

  const idInfo = await pool.query(
    `SELECT data_type, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'b2b_orders'
       AND column_name = 'id'
     LIMIT 1`,
  );

  const idType = String(idInfo.rows[0]?.data_type || "");
  const idDefault = idInfo.rows[0]?.column_default;
  if (!idType || idDefault) return;

  if (["smallint", "integer", "bigint"].includes(idType)) {
    await pool.query(`CREATE SEQUENCE IF NOT EXISTS b2b_orders_id_seq`);
    await pool.query(`ALTER SEQUENCE b2b_orders_id_seq OWNED BY b2b_orders.id`);

    const maxResult = await pool.query(
      `SELECT COALESCE(MAX(id::bigint), 0::bigint) AS max_id FROM b2b_orders`,
    );
    const nextId = Math.max(1, Number(maxResult.rows[0]?.max_id || 0) + 1);

    await pool.query(
      `SELECT setval('b2b_orders_id_seq', $1::bigint, false)`,
      [nextId],
    );
    await pool.query(
      `ALTER TABLE b2b_orders
       ALTER COLUMN id SET DEFAULT nextval('b2b_orders_id_seq')`,
    );
    return;
  }

  if (idType === "uuid") {
    await pool.query(
      `ALTER TABLE b2b_orders
       ALTER COLUMN id SET DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid)`,
    );
    return;
  }

  if (["text", "character varying"].includes(idType)) {
    await pool.query(
      `ALTER TABLE b2b_orders
       ALTER COLUMN id SET DEFAULT md5(random()::text || clock_timestamp()::text)`,
    );
    return;
  }

  throw new Error(`Desteklenmeyen b2b_orders.id tipi: ${idType}`);
}

const B2B_COMPANY_CATEGORIES = [
  "Elektrik & Elektronik",
  "Ev Gereçleri",
  "Yapı & Hırdavat",
  "Otomotiv",
  "Gıda",
  "Tekstil",
  "Kozmetik & Kişisel Bakım",
  "Petshop",
  "Market & Perakende",
  "Toptan Ticaret",
  "Diğer",
] as const;

function isValidVknChecksum(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;

  const digits = value.split("").map(Number);
  const control = digits[9];
  const weighted = digits.slice(0, 9).map((digit, index) => {
    const shifted = (digit + 9 - index) % 10;
    if (shifted === 9) return 9;
    return (shifted * 2 ** (9 - index)) % 9;
  });

  const total = weighted.reduce((sum, item) => sum + item, 0);
  const expected = (10 - (total % 10)) % 10;
  return expected === control;
}

type TaxLookupResult = {
  structurallyValid: boolean;
  verified: boolean;
  taxOffice: string | null;
  companyName: string | null;
  serviceConfigured: boolean;
};

function normalizeTaxLookupPayload(payload: Record<string, any>): {
  taxOffice: string | null;
  companyName: string | null;
  valid: boolean;
} {
  const root =
    payload && typeof payload.data === "object" && payload.data
      ? payload.data as Record<string, any>
      : payload;

  const taxOfficeRaw =
    root.taxOffice ??
    root.tax_office ??
    root.taxOfficeName ??
    root.vergiDairesi ??
    root.vergi_dairesi ??
    root.vergi_dairesi_adi;

  const companyNameRaw =
    root.companyName ??
    root.company_name ??
    root.title ??
    root.unvan ??
    root.companyTitle ??
    root.firma_unvani;

  const explicitInvalid =
    root.valid === false ||
    root.verified === false ||
    root.isError === true ||
    root.success === false;

  return {
    taxOffice:
      typeof taxOfficeRaw === "string" && taxOfficeRaw.trim()
        ? taxOfficeRaw.trim().slice(0, 180)
        : null,
    companyName:
      typeof companyNameRaw === "string" && companyNameRaw.trim()
        ? companyNameRaw.trim().slice(0, 240)
        : null,
    valid: !explicitInvalid,
  };
}

async function lookupTaxpayer(vkn: string): Promise<TaxLookupResult> {
  const configured =
    Boolean(process.env.MUKELLEF_INFO_API_KEY?.trim()) ||
    Boolean(process.env.RAPIDAPI_KEY?.trim()) ||
    Boolean(process.env.TAX_VERIFICATION_API_URL?.trim());

  if (!isValidVknChecksum(vkn)) {
    return {
      structurallyValid: false,
      verified: false,
      taxOffice: null,
      companyName: null,
      serviceConfigured: configured,
    };
  }

  const errors: string[] = [];

  const mukellefInfoKey = process.env.MUKELLEF_INFO_API_KEY?.trim();
  if (mukellefInfoKey) {
    try {
      const response = await fetch(
        `https://api.mukellef.info/v2/query.php?TaxNumber=${encodeURIComponent(vkn)}`,
        {
          headers: { ApiKey: mukellefInfoKey },
          signal: AbortSignal.timeout(8000),
        },
      );

      if (!response.ok) {
        throw new Error(`Mükellef.info HTTP ${response.status}`);
      }

      const payload = await response.json() as Record<string, any>;
      const normalized = normalizeTaxLookupPayload(payload);

      if (normalized.valid && normalized.taxOffice) {
        return {
          structurallyValid: true,
          verified: true,
          taxOffice: normalized.taxOffice,
          companyName: normalized.companyName,
          serviceConfigured: true,
        };
      }

      errors.push("Mükellef.info eşleşme döndürmedi");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Mükellef.info sorgusu başarısız");
    }
  }

  const rapidApiKey = process.env.RAPIDAPI_KEY?.trim();
  if (rapidApiKey) {
    try {
      const host =
        process.env.RAPIDAPI_TAX_HOST?.trim() ||
        "turkey-company-lookup-api.p.rapidapi.com";

      const response = await fetch(
        `https://${host}/v1/company/vkn-lookup?vkn=${encodeURIComponent(vkn)}&lang=tr`,
        {
          headers: {
            "X-RapidAPI-Key": rapidApiKey,
            "X-RapidAPI-Host": host,
          },
          signal: AbortSignal.timeout(8000),
        },
      );

      if (!response.ok) {
        throw new Error(`TRApi HTTP ${response.status}`);
      }

      const payload = await response.json() as Record<string, any>;
      const normalized = normalizeTaxLookupPayload(payload);

      if (normalized.valid && normalized.taxOffice) {
        return {
          structurallyValid: true,
          verified: true,
          taxOffice: normalized.taxOffice,
          companyName: normalized.companyName,
          serviceConfigured: true,
        };
      }

      errors.push("TRApi vergi dairesi eşleşmesi döndürmedi");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "TRApi sorgusu başarısız");
    }
  }

  const endpoint = process.env.TAX_VERIFICATION_API_URL?.trim();
  if (endpoint) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const apiKey = process.env.TAX_VERIFICATION_API_KEY?.trim();

      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
        headers["X-API-Key"] = apiKey;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ taxNumber: vkn, vkn }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error(`Özel vergi servisi HTTP ${response.status}`);
      }

      const payload = await response.json() as Record<string, any>;
      const normalized = normalizeTaxLookupPayload(payload);

      if (normalized.valid && normalized.taxOffice) {
        return {
          structurallyValid: true,
          verified: true,
          taxOffice: normalized.taxOffice,
          companyName: normalized.companyName,
          serviceConfigured: true,
        };
      }

      errors.push("Özel vergi servisi eşleşme döndürmedi");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Özel vergi servisi sorgusu başarısız");
    }
  }

  if (configured && errors.length > 0) {
    console.error("All configured tax lookup providers failed:", errors.join(" | "));
  }

  return {
    structurallyValid: true,
    verified: false,
    taxOffice: null,
    companyName: null,
    serviceConfigured: configured,
  };
}

function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let password = "";
  for (let index = 0; index < 10; index += 1) {
    password += alphabet[bytes[index] % alphabet.length];
  }
  return password;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function encodeMimeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizeMailError(error: unknown): string {
  const anyError = error as any;
  const codes = [
    anyError?.code,
    ...(Array.isArray(anyError?.errors) ? anyError.errors.map((item: any) => item?.code) : []),
  ].filter(Boolean);

  if (codes.includes("ETIMEDOUT")) {
    return "Google Mail SMTP bağlantısı zaman aşımına uğradı. Railway SMTP çıkışını engelliyor; Gmail API OAuth bağlantısı kullanılmalı.";
  }

  if (codes.includes("ECONNREFUSED") || codes.includes("ENETUNREACH")) {
    return "Google Mail SMTP bağlantısına ulaşılamadı. Gmail API OAuth bağlantısı kullanılmalı.";
  }

  if (error instanceof Error && error.message?.trim()) {
    return error.message.trim();
  }

  return "Google Mail gönderimi tamamlanamadı";
}

async function sendViaGoogleSmtp(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const senderEmail = process.env.GOOGLE_GMAIL_SENDER?.trim();
  const appPassword = process.env.GOOGLE_GMAIL_APP_PASSWORD
    ?.replace(/\s+/g, "")
    .trim();
  const senderName =
    process.env.GOOGLE_GMAIL_SENDER_NAME?.trim() ||
    "Çalışkan B2B";

  if (!senderEmail || !appPassword) {
    throw new Error("Google Mail SMTP bilgileri eksik");
  }

  const { connect } = await import("tls");
  const { createInterface } = await import("readline");

  const socket = connect({
    host: "smtp.gmail.com",
    port: 465,
    servername: "smtp.gmail.com",
    rejectUnauthorized: true,
  });

  socket.setTimeout(12000);

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", () => resolve());
      socket.once("error", reject);
      socket.once("timeout", () => reject(new Error("Google Mail SMTP bağlantısı zaman aşımına uğradı")));
    });
  } catch (error) {
    socket.destroy();
    throw new Error(normalizeMailError(error));
  }

  const reader = createInterface({
    input: socket,
    crlfDelay: Infinity,
  });
  const iterator = reader[Symbol.asyncIterator]();

  async function readResponse(expectedCode: number): Promise<void> {
    const lines: string[] = [];

    while (true) {
      const next = await iterator.next();
      if (next.done || typeof next.value !== "string") {
        throw new Error("Google Mail SMTP bağlantısı beklenmedik şekilde kapandı");
      }

      const line = next.value;
      lines.push(line);

      const match = /^(\d{3})([ -])/.exec(line);
      if (!match) continue;
      if (match[2] === "-") continue;

      const code = Number(match[1]);
      if (code !== expectedCode) {
        throw new Error(`Google Mail SMTP hatası (${code}): ${lines.join(" ")}`);
      }
      return;
    }
  }

  function write(command: string) {
    socket.write(command.endsWith("\r\n") ? command : `${command}\r\n`);
  }

  try {
    await readResponse(220);

    write("EHLO b2b.ecalisgan.com");
    await readResponse(250);

    write("AUTH LOGIN");
    await readResponse(334);

    write(Buffer.from(senderEmail, "utf8").toString("base64"));
    await readResponse(334);

    write(Buffer.from(appPassword, "utf8").toString("base64"));
    await readResponse(235);

    write(`MAIL FROM:<${senderEmail}>`);
    await readResponse(250);

    write(`RCPT TO:<${input.to}>`);
    await readResponse(250);

    write("DATA");
    await readResponse(354);

    const boundary = `b2b-${randomBytes(12).toString("hex")}`;
    const mime = [
      `From: ${encodeMimeHeader(senderName)} <${senderEmail}>`,
      `To: ${input.to}`,
      `Subject: ${encodeMimeHeader(input.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      input.text,
      "",
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      input.html,
      "",
      `--${boundary}--`,
      "",
    ]
      .join("\r\n")
      .replace(/(^|\r\n)\./g, "$1..");

    socket.write(`${mime}\r\n.\r\n`);
    await readResponse(250);

    write("QUIT");
    await readResponse(221);
  } finally {
    reader.close();
    socket.end();
  }
}

async function getGoogleMailAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_GMAIL_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Mail OAuth bilgileri eksik");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10000),
  });

  const payload = await response.json().catch(() => ({})) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    const detail =
      payload.error_description ||
      payload.error ||
      `HTTP ${response.status}`;
    throw new Error(`Google Mail yetkilendirmesi başarısız: ${detail}`);
  }

  return payload.access_token;
}

async function sendViaGoogleMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const senderEmail = process.env.GOOGLE_GMAIL_SENDER?.trim();
  const senderName =
    process.env.GOOGLE_GMAIL_SENDER_NAME?.trim() ||
    "Çalışkan B2B";

  if (!senderEmail) {
    throw new Error("Google Mail gönderici adresi tanımlı değil");
  }

  const accessToken = await getGoogleMailAccessToken();
  const boundary = `b2b-${randomBytes(12).toString("hex")}`;

  const mime = [
    `From: ${encodeMimeHeader(senderName)} <${senderEmail}>`,
    `To: ${input.to}`,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: toBase64Url(mime) }),
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("Google Mail send failed:", response.status, details);
    throw new Error("Tek kullanımlık şifre Google Mail ile gönderilemedi");
  }
}

async function sendTemporaryPasswordEmail(input: {
  to: string;
  firstName?: string | null;
  companyName?: string | null;
  temporaryPassword: string;
}): Promise<void> {
  const loginUrl =
    process.env.B2B_PUBLIC_URL?.trim() ||
    process.env.RAILWAY_SERVICE_CALISKAN_B2B_WEB_URL?.trim() ||
    "https://b2b.ecalisgan.com/uye-girisi";

  const subject = "Çalışkan B2B hesabınız onaylandı";
  const greeting = input.firstName?.trim() ? `Merhaba ${input.firstName.trim()},` : "Merhaba,";
  const text = [
    greeting,
    "",
    "Çalışkan B2B başvurunuz onaylandı.",
    `Tek kullanımlık giriş şifreniz: ${input.temporaryPassword}`,
    "",
    "Bu şifre yalnızca ilk girişte kullanılabilir. Giriş yaptıktan hemen sonra yeni şifrenizi oluşturmanız istenecektir.",
    `Giriş: ${loginUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
      <h2 style="margin:0 0 16px">Çalışkan B2B hesabınız onaylandı</h2>
      <p>${escapeHtml(greeting)}</p>
      <p>${escapeHtml(input.companyName || "Firma")} başvurunuz yönetici tarafından onaylandı.</p>
      <div style="margin:22px 0;padding:18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc">
        <div style="font-size:12px;color:#64748b;margin-bottom:6px">Tek kullanımlık şifreniz</div>
        <div style="font-size:26px;font-weight:700;letter-spacing:2px">${escapeHtml(input.temporaryPassword)}</div>
      </div>
      <p style="font-size:13px;color:#475569">Bu şifre yalnızca ilk girişte kullanılabilir. Giriş yaptıktan sonra yeni şifre oluşturma ekranı açılacaktır.</p>
      <p><a href="${escapeHtml(loginUrl)}">Çalışkan B2B giriş ekranını aç</a></p>
    </div>
  `;

  const gmailSmtpConfigured =
    Boolean(process.env.GOOGLE_GMAIL_SENDER?.trim()) &&
    Boolean(process.env.GOOGLE_GMAIL_APP_PASSWORD?.replace(/\s+/g, "").trim());

  if (gmailSmtpConfigured) {
    await sendViaGoogleSmtp({
      to: input.to,
      subject,
      text,
      html,
    });
    return;
  }

  const gmailOauthConfigured =
    Boolean(process.env.GOOGLE_GMAIL_CLIENT_ID?.trim()) &&
    Boolean(process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim()) &&
    Boolean(process.env.GOOGLE_GMAIL_REFRESH_TOKEN?.trim()) &&
    Boolean(process.env.GOOGLE_GMAIL_SENDER?.trim());

  if (gmailOauthConfigured) {
    await sendViaGoogleMail({
      to: input.to,
      subject,
      text,
      html,
    });
    return;
  }

  const webhookUrl = process.env.B2B_MAIL_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: input.to,
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      throw new Error(`E-posta servisi HTTP ${response.status}`);
    }
    return;
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.B2B_MAIL_FROM?.trim();
  if (resendApiKey && from) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error("Resend email failed:", response.status, details);
      throw new Error("Tek kullanımlık şifre e-posta ile gönderilemedi");
    }
    return;
  }

  throw new Error("Google Mail bağlantısı henüz yapılandırılmamış");
}

async function initDatabase(): Promise<void> {
  const maxRetries = 20;
  const delayMs = 5000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await storage.ensureSystemUser();
      dbReady = true;
      console.log("Database connected successfully");
      return;
    } catch (error: any) {
      const msg = error?.message || "";
      if (msg.includes("disabled") || msg.includes("endpoint") || msg.includes("connect")) {
        console.log(`Database waking up... retry ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
  console.error("Database failed to connect after retries - app running without DB");
}

async function hydrateB2BOrderItems(rawItems: unknown) {
  if (!pool) return Array.isArray(rawItems) ? rawItems : [];
  const items = Array.isArray(rawItems) ? rawItems.map((item) => ({ ...(item || {}) })) : [];
  const ids = Array.from(
    new Set(
      items
        .map((item: any) => String(item?.productId || "").trim())
        .filter(Boolean),
    ),
  );

  if (!ids.length) return items;

  const products = await pool.query(
    `SELECT id::text AS id, image_data, images
     FROM b2b_products
     WHERE id::text = ANY($1::text[])`,
    [ids],
  );

  const imageById = new Map<string, string | null>();
  for (const row of products.rows) {
    const image =
      typeof row.image_data === "string" && row.image_data.trim()
        ? row.image_data
        : Array.isArray(row.images) && typeof row.images[0] === "string"
          ? row.images[0]
          : null;
    imageById.set(String(row.id), image);
  }

  return items.map((item: any) => ({
    ...item,
    image:
      typeof item?.image === "string" && item.image.trim()
        ? item.image
        : imageById.get(String(item?.productId || "")) || null,
  }));
}

function hasObjectValues(value: unknown) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).length,
  );
}

async function hydrateB2BOrderDetail(row: any) {
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
        "Legacy order card summary could not be refreshed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  let billingDetails = hasObjectValues(row.billing_details)
    ? row.billing_details
    : {};
  let shippingAddress = hasObjectValues(row.shipping_address)
    ? row.shipping_address
    : {};

  if ((!hasObjectValues(billingDetails) || !hasObjectValues(shippingAddress)) && row.user_id) {
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

    if (!hasObjectValues(billingDetails)) {
      billingDetails = {
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

    if (!hasObjectValues(shippingAddress)) {
      shippingAddress = {
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
    items: await hydrateB2BOrderItems(row.items),
    billing_details: billingDetails,
    shipping_address: shippingAddress,
    card_last4: cardLast4 || null,
    card_association: cardAssociation || null,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  initDatabase()
    .then(() => ensureB2BAccountTables())
    .catch(err => console.error("DB/B2B account init error:", err));

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", database: dbReady ? "ready" : "starting" });
  });

  app.get("/api/auth/session", async (req, res) => {
    const userId = sessionUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Oturum bulunamadı" });
    }

    const user = await storage.getUser(userId);
    if (!user || user.isActive !== 1) {
      return res.status(401).json({ error: "Oturum geçersiz" });
    }

    return res.json({ user: authResponseUser(user) });
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = sessionUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      req.session.destroy(() => undefined);
      return res.status(401).json({ error: "Oturum geçersiz" });
    }
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      appAccess: user.appAccess,
      isActive: user.isActive === 1,
      mustChangePassword: user.mustChangePassword === 1,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.companyName,
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    const identifier =
      typeof req.body?.username === "string"
        ? req.body.username.trim()
        : typeof req.body?.email === "string"
          ? req.body.email.trim()
          : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!identifier || !password) {
      return res.status(400).json({ error: "E-posta/kullanıcı adı ve şifre gerekli" });
    }

    const primaryAdminEmail = (process.env.PRIMARY_ADMIN_EMAIL || "").trim().toLowerCase();
    const primaryAdminAuthEmail = (process.env.PRIMARY_ADMIN_AUTH_EMAIL || primaryAdminEmail).trim().toLowerCase();
    const identifierLower = identifier.toLowerCase();
    const isPrimaryAdminAttempt =
      Boolean(primaryAdminEmail) &&
      (identifierLower === primaryAdminEmail || identifierLower === primaryAdminAuthEmail);

    const localUsername = isPrimaryAdminAttempt ? "admin" : identifier;
    const localUser = await storage.getUserByUsername(localUsername);
    const primaryAdminTemporaryPassword = process.env.PRIMARY_ADMIN_TEMP_PASSWORD || "";

    if (
      isPrimaryAdminAttempt &&
      primaryAdminTemporaryPassword &&
      password === primaryAdminTemporaryPassword
    ) {
      await storage.ensureSystemUser();
      const adminUser = await storage.getUserByUsername("admin");
      if (!adminUser || adminUser.isActive !== 1) {
        return res.status(403).json({ error: "Yönetici hesabı aktif değil" });
      }

      (req.session as { userId?: number }).userId = adminUser.id;
      return res.json(
        authResponse(
          { ...adminUser, role: "super_admin", isActive: 1 },
          primaryAdminEmail,
        ),
      );
    }

    if (
      localUser &&
      localUser.isActive === 1 &&
      ["super_admin", "admin"].includes(localUser.role) &&
      verifyPassword(password, localUser.password)
    ) {
      (req.session as { userId?: number }).userId = localUser.id;
      return res.json(
        authResponse(
          localUser,
          isPrimaryAdminAttempt ? primaryAdminEmail : localUser.username,
        ),
      );
    }

    const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";

    if (isPrimaryAdminAttempt && supabaseUrl && supabaseKey && primaryAdminAuthEmail) {
      try {
        const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
          },
          body: JSON.stringify({
            email: primaryAdminAuthEmail,
            password,
          }),
        });

        if (authResponse.ok) {
          const authPayload = await authResponse.json() as { user?: { email?: string } };
          const authenticatedEmail = authPayload.user?.email?.trim().toLowerCase();

          if (authenticatedEmail === primaryAdminAuthEmail) {
            await storage.ensureSystemUser();
            const adminUser = await storage.getUserByUsername("admin");

            if (!adminUser || adminUser.isActive !== 1) {
              return res.status(403).json({ error: "Yönetici hesabı aktif değil" });
            }

            (req.session as { userId?: number }).userId = adminUser.id;
            return res.json(
              authResponse(
                { ...adminUser, role: "super_admin", isActive: 1 },
                primaryAdminEmail || primaryAdminAuthEmail,
              ),
            );
          }
        }
      } catch (error) {
        console.error("Supabase admin auth fallback failed:", error);
      }
    }

    return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı" });
  });

  app.post("/api/b2b/login", async (req, res) => {
    const identifier =
      typeof req.body?.username === "string"
        ? req.body.username.trim().toLowerCase()
        : typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!identifier || !password) {
      return res.status(400).json({ error: "E-posta ve şifre gerekli" });
    }

    const user = await storage.getUserByUsername(identifier);
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: "E-posta veya şifre hatalı" });
    }

    if (user.isActive !== 1) {
      const message =
        user.applicationStatus === "rejected"
          ? "Başvurunuz onaylanmadı"
          : "Hesabınız yönetici onayı bekliyor";
      return res.status(403).json({ error: message });
    }

    if (user.appAccess !== "b2b" && user.role !== "b2b_customer") {
      return res.status(403).json({ error: "Bu hesap B2B web sitesi için yetkili değil" });
    }

    (req.session as { userId?: number }).userId = user.id;

    if (user.mustChangePassword === 1) {
      // Tek kullanımlık şifre ilk başarılı girişte hemen geçersiz kılınır.
      await storage.updateUser(user.id, {
        password: hashPassword(randomBytes(32).toString("hex")),
      });

      const payload = authResponse(user);
      return res.json({
        ...payload,
        mustChangePassword: true,
        user: { ...payload.user, mustChangePassword: true },
      });
    }

    const payload = authResponse(user);
    return res.json({
      ...payload,
      mustChangePassword: false,
      user: { ...payload.user, mustChangePassword: false },
    });
  });

  app.post("/api/b2b/change-initial-password", async (req, res) => {
    const userId = sessionUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Oturum bulunamadı. Tek kullanımlık şifreyi yeniden isteyin." });
    }

    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const passwordAgain = typeof req.body?.passwordAgain === "string" ? req.body.passwordAgain : "";

    if (password.length < 8) {
      return res.status(400).json({ error: "Yeni şifre en az 8 karakter olmalı" });
    }
    if (password !== passwordAgain) {
      return res.status(400).json({ error: "Şifreler eşleşmiyor" });
    }

    const user = await storage.getUser(userId);
    if (!user || user.role !== "b2b_customer" || user.isActive !== 1) {
      return res.status(403).json({ error: "Bu işlem için geçerli B2B hesabı bulunamadı" });
    }
    if (user.mustChangePassword !== 1) {
      return res.status(409).json({ error: "İlk giriş şifre oluşturma işlemi zaten tamamlanmış" });
    }

    await storage.updateUser(user.id, {
      password: hashPassword(password),
      mustChangePassword: 0,
    });

    return res.json({ ok: true });
  });

  app.post("/api/b2b/tax-verify", async (req, res) => {
    const taxNumber =
      typeof req.body?.taxNumber === "string"
        ? req.body.taxNumber.replace(/\D/g, "").slice(0, 10)
        : "";

    if (!/^\d{10}$/.test(taxNumber)) {
      return res.status(400).json({ error: "Vergi numarası 10 haneli olmalıdır" });
    }

    try {
      const result = await lookupTaxpayer(taxNumber);
      if (!result.structurallyValid) {
        return res.status(400).json({
          valid: false,
          verified: false,
          error: "Vergi numarası geçersiz",
        });
      }
      if (!result.serviceConfigured) {
        return res.status(503).json({
          valid: true,
          verified: false,
          error: "Vergi dairesi otomatik sorgulama servisine şu anda ulaşılamıyor",
        });
      }
      if (!result.verified || !result.taxOffice) {
        return res.status(422).json({
          valid: true,
          verified: false,
          error: "Vergi numarası için vergi dairesi doğrulanamadı",
        });
      }

      return res.json({
        valid: true,
        verified: true,
        taxNumber,
        taxOffice: result.taxOffice,
        companyName: result.companyName,
        serviceConfigured: true,
        message: "Vergi bilgileri doğrulandı",
      });
    } catch (error) {
      console.error("B2B tax verification failed:", error);
      return res.status(502).json({
        error: "Vergi dairesi otomatik sorgulanamadı. Lütfen tekrar deneyin.",
      });
    }
  });

  app.post("/api/b2b/register", async (req, res) => {
    const companyName = typeof req.body?.companyName === "string" ? req.body.companyName.trim() : "";
    const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
    const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const companyCategory = typeof req.body?.companyCategory === "string" ? req.body.companyCategory.trim() : "";
    const taxNumber = typeof req.body?.taxNumber === "string" ? req.body.taxNumber.replace(/\D/g, "").slice(0, 10) : "";

    if (companyName.length < 2) {
      return res.status(400).json({ error: "Firma ismi zorunludur" });
    }
    if (firstName.length < 2 || lastName.length < 2) {
      return res.status(400).json({ error: "İsim ve soy isim zorunludur" });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: "Geçerli bir e-posta adresi girin" });
    }
    if (!(B2B_COMPANY_CATEGORIES as readonly string[]).includes(companyCategory)) {
      return res.status(400).json({ error: "Geçerli bir firma kategorisi seçin" });
    }
    if (!isValidVknChecksum(taxNumber)) {
      return res.status(400).json({ error: "Vergi numarası geçersiz" });
    }

    const existing = await storage.getUserByUsername(email);
    if (existing) {
      return res.status(409).json({ error: "Bu e-posta ile daha önce başvuru oluşturulmuş" });
    }

    const allUsers = await storage.listUsers();
    if (allUsers.some((user) => user.taxNumber === taxNumber)) {
      return res.status(409).json({ error: "Bu vergi numarasıyla daha önce başvuru oluşturulmuş" });
    }

    let taxLookup: TaxLookupResult = {
      structurallyValid: true,
      verified: false,
      taxOffice: null,
      companyName: null,
      serviceConfigured: false,
    };

    try {
      taxLookup = await lookupTaxpayer(taxNumber);
    } catch (error) {
      // Vergi sorgu servisi başvuruyu engellemez; VKN kontrol basamağı
      // backend tarafında zaten doğrulanmıştır.
      console.error("Registration tax lookup failed:", error);
    }

    try {
      const user = await storage.createUser({
        username: email,
        password: hashPassword(randomBytes(32).toString("hex")),
        role: "b2b_customer",
        appAccess: "b2b",
        isActive: 0,
        companyName: taxLookup.companyName || companyName,
        firstName,
        lastName,
        email,
        companyCategory,
        taxNumber,
        taxOffice: taxLookup.taxOffice || null,
        taxVerified: taxLookup.verified && taxLookup.taxOffice ? 1 : 0,
        applicationStatus: "pending",
        mustChangePassword: 0,
      });

      return res.status(201).json({
        id: user.id,
        username: user.username,
        status: "pending",
        taxVerified: user.taxVerified === 1,
        taxOffice: user.taxOffice,
        message: "Başvurunuz alındı. Yönetici onayından sonra tek kullanımlık şifreniz e-posta adresinize gönderilecektir.",
      });
    } catch (error) {
      console.error("B2B registration failed:", error);
      return res.status(500).json({ error: "Başvuru oluşturulamadı" });
    }
  });

  app.get("/api/admin/b2b-applications", requireAdmin, async (_req, res) => {
    const allUsers = await storage.listUsers();
    const applications = allUsers
      .filter((user) => user.role === "b2b_customer" && Boolean(user.applicationStatus))
      .map(({ password, ...user }) => ({
        ...user,
        isActive: user.isActive === 1,
        taxVerified: user.taxVerified === 1,
        mustChangePassword: user.mustChangePassword === 1,
      }));

    return res.json(applications);
  });

  app.post("/api/admin/b2b-applications/:id/approve", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const user = await storage.getUser(id);
    if (!user || user.role !== "b2b_customer") {
      return res.status(404).json({ error: "Başvuru bulunamadı" });
    }
    if (!user.email) {
      return res.status(400).json({ error: "Başvuruda e-posta adresi bulunmuyor" });
    }
    if (user.applicationStatus === "rejected") {
      return res.status(409).json({ error: "Reddedilmiş başvuru doğrudan onaylanamaz" });
    }

    const temporaryPassword = generateTemporaryPassword();

    const updated = await storage.updateUser(id, {
      password: hashPassword(temporaryPassword),
      isActive: 1,
      applicationStatus: "approved",
      mustChangePassword: 1,
      approvedAt: new Date(),
      credentialsSentAt: null,
    });

    if (!updated) {
      return res.status(404).json({ error: "Başvuru bulunamadı" });
    }

    let emailSent = false;
    let emailError: string | null = null;

    try {
      await sendTemporaryPasswordEmail({
        to: user.email,
        firstName: user.firstName,
        companyName: user.companyName,
        temporaryPassword,
      });

      emailSent = true;
      await storage.updateUser(id, {
        credentialsSentAt: new Date(),
      });
    } catch (error) {
      emailError =
        error instanceof Error
          ? error.message
          : "Tek kullanımlık şifre e-posta ile gönderilemedi";
      console.error("B2B temporary password email failed after approval:", error);
    }

    const { password, ...safeUser } = updated;
    return res.json({
      ...safeUser,
      isActive: true,
      taxVerified: safeUser.taxVerified === 1,
      mustChangePassword: true,
      emailSent,
      emailError,
      temporaryPassword: emailSent ? undefined : temporaryPassword,
      message: emailSent
        ? "Başvuru onaylandı ve tek kullanımlık şifre e-posta ile gönderildi."
        : "Başvuru onaylandı. E-posta servisi hazır olmadığı için tek kullanımlık şifre yöneticiye gösterildi.",
    });
  });

  app.post("/api/admin/b2b-applications/:id/reject", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const user = await storage.getUser(id);
    if (!user || user.role !== "b2b_customer") {
      return res.status(404).json({ error: "Başvuru bulunamadı" });
    }

    const updated = await storage.updateUser(id, {
      isActive: 0,
      applicationStatus: "rejected",
      mustChangePassword: 0,
      password: hashPassword(randomBytes(32).toString("hex")),
    });

    if (!updated) {
      return res.status(404).json({ error: "Başvuru bulunamadı" });
    }

    const { password, ...safeUser } = updated;
    return res.json({
      ...safeUser,
      isActive: false,
      taxVerified: safeUser.taxVerified === 1,
      mustChangePassword: false,
    });
  });

  app.post("/api/admin/b2b-applications/:id/resend-password", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const user = await storage.getUser(id);
    if (!user || user.role !== "b2b_customer") {
      return res.status(404).json({ error: "Başvuru bulunamadı" });
    }
    if (user.applicationStatus !== "approved" || user.isActive !== 1 || !user.email) {
      return res.status(409).json({ error: "Yalnızca onaylı ve aktif hesaplara yeni tek kullanımlık şifre gönderilebilir" });
    }

    const temporaryPassword = generateTemporaryPassword();

    try {
      await sendTemporaryPasswordEmail({
        to: user.email,
        firstName: user.firstName,
        companyName: user.companyName,
        temporaryPassword,
      });

      await storage.updateUser(id, {
        password: hashPassword(temporaryPassword),
        mustChangePassword: 1,
        credentialsSentAt: new Date(),
      });

      return res.json({ ok: true, message: "Yeni tek kullanımlık şifre e-posta ile gönderildi." });
    } catch (error) {
      console.error("B2B temporary password resend failed:", error);
      return res.status(502).json({
        error: normalizeMailError(error),
      });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    const allUsers = await storage.listUsers();
    res.json(allUsers.filter((user) => user.role !== "system").map(({ password, ...user }) => ({ ...user, isActive: user.isActive === 1 })));
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const payload = insertUserSchema.parse({
        username: req.body?.username,
        password: req.body?.password,
        role: req.body?.role || "staff",
        appAccess: req.body?.appAccess || "business",
        isActive: req.body?.isActive === false ? 0 : 1,
      });
      const user = await storage.createUser(payload);
      const { password, ...safeUser } = user;
      res.status(201).json({ ...safeUser, isActive: safeUser.isActive === 1 });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
      res.status(500).json({ error: "Kullanıcı oluşturulamadı" });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const data = insertUserSchema.partial().parse({
        ...(req.body?.username !== undefined ? { username: req.body.username } : {}),
        ...(req.body?.password !== undefined ? { password: req.body.password } : {}),
        ...(req.body?.role !== undefined ? { role: req.body.role } : {}),
        ...(req.body?.appAccess !== undefined ? { appAccess: req.body.appAccess } : {}),
        ...(req.body?.isActive !== undefined ? { isActive: req.body.isActive ? 1 : 0 } : {}),
      });
      const user = await storage.updateUser(id, data);
      if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
      const { password, ...safeUser } = user;
      res.json({ ...safeUser, isActive: safeUser.isActive === 1 });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
      res.status(500).json({ error: "Kullanıcı güncellenemedi" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((error) => {
      if (error) {
        return res.status(500).json({ error: "Oturum kapatılamadı" });
      }
      res.clearCookie("connect.sid");
      res.status(204).send();
    });
  });

  app.post("/api/ai/chat", requireAuth, async (req, res) => {
    if (!openai) {
      return res.status(503).json({ error: "Yapay zeka servisi yapılandırılmamış" });
    }

    try {
      const { messages } = aiChatSchema.parse(req.body);
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: "Sen Çalışkan Group RMA Paneli için Türkçe konuşan bir operasyon asistanısın. İade, değişim, servis, müşteri ve ürün kayıtları hakkında kısa, net ve uygulanabilir yanıtlar ver. Bilmediğin verileri uydurma.",
          },
          ...messages,
        ],
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) return res.status(502).json({ error: "Yapay zeka boş yanıt döndürdü" });
      return res.json({ message: content });
    } catch (error) {
      console.error("AI chat error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Geçersiz mesaj formatı", details: error.errors });
      }
      return res.status(502).json({ error: "Yapay zeka servisine ulaşılamadı" });
    }
  });

  registerProductAIRoutes(app, requireAdmin);
  await registerAdminPlatformRoutes(app, requireAdmin);

  app.get("/api/b2b/products", async (req, res) => {
    if (!pool) return res.json([]);

    try {
      const priceVisible = await canViewB2BPrices(req);
      const result = await pool.query(`
        SELECT
          id,
          sku,
          name,
          price,
          stock,
          min_order_qty,
          units_per_box,
          image_data,
          images,
          barcode,
          collection_name
        FROM b2b_products
        WHERE is_active IS DISTINCT FROM FALSE
        ORDER BY created_at DESC
      `);
      return res.json(
        result.rows.map((row) => ({
          ...row,
          price: priceVisible ? row.price : null,
        })),
      );
    } catch (error: any) {
      if (error?.code === "42P01") {
        return res.json([]);
      }
      console.error("Error fetching B2B products:", error);
      return res.status(500).json({ error: "B2B ürünleri alınamadı" });
    }
  });

  app.get("/api/b2b/products/:id", async (req, res) => {
    if (!pool) return res.status(404).json({ error: "Ürün bulunamadı" });

    try {
      const priceVisible = await canViewB2BPrices(req);
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
          features,
          variants
        FROM b2b_products
        WHERE id::text = $1
          AND is_active IS DISTINCT FROM FALSE
        LIMIT 1
      `, [String(req.params.id)]);

      if (!result.rows[0]) {
        return res.status(404).json({ error: "Ürün bulunamadı" });
      }

      return res.json({
        ...result.rows[0],
        price: priceVisible ? result.rows[0].price : null,
      });
    } catch (error: any) {
      if (error?.code === "42P01") {
        return res.status(404).json({ error: "Ürün bulunamadı" });
      }
      console.error("Error fetching B2B product:", error);
      return res.status(500).json({ error: "B2B ürünü alınamadı" });
    }
  });

  app.post("/api/uploads", requireAuth, async (req, res) => {
    try {
      const dataUrl = req.body?.dataUrl;
      if (typeof dataUrl !== "string") {
        return res.status(400).json({ error: "Görsel verisi bulunamadı" });
      }

      const url = await saveImageDataUrl(dataUrl);
      res.status(201).json({ url });
    } catch (error) {
      console.error("Error uploading image:", error);
      const message = error instanceof Error ? error.message : "Görsel yüklenemedi";
      res.status(error instanceof Error && message.includes("Geçersiz") ? 400 : 500).json({ error: message });
    }
  });


  app.get("/api/b2b/account", requireB2B, async (_req, res) => {
    const user = (res.locals as any).b2bUser;
    return res.json({
      id: user.id,
      email: user.email || user.username,
      companyName: user.companyName,
      firstName: user.firstName,
      lastName: user.lastName,
      companyCategory: user.companyCategory,
      taxNumber: user.taxNumber,
      taxOffice: user.taxOffice,
      taxVerified: user.taxVerified === 1,
    });
  });

  app.patch("/api/b2b/account", requireB2B, async (req, res) => {
    const user = (res.locals as any).b2bUser;
    const clean = (value: unknown, max = 180) =>
      typeof value === "string" ? value.trim().slice(0, max) : "";

    const updated = await storage.updateUser(user.id, {
      companyName: clean(req.body?.companyName, 240) || user.companyName,
      firstName: clean(req.body?.firstName, 120) || user.firstName,
      lastName: clean(req.body?.lastName, 120) || user.lastName,
      companyCategory: clean(req.body?.companyCategory, 180) || user.companyCategory,
    });

    if (!updated) return res.status(404).json({ error: "Hesap bulunamadı" });

    return res.json({
      id: updated.id,
      email: updated.email || updated.username,
      companyName: updated.companyName,
      firstName: updated.firstName,
      lastName: updated.lastName,
      companyCategory: updated.companyCategory,
      taxNumber: updated.taxNumber,
      taxOffice: updated.taxOffice,
      taxVerified: updated.taxVerified === 1,
    });
  });

  app.get("/api/b2b/addresses", requireB2B, async (_req, res) => {
    if (!pool) return res.json([]);
    const user = (res.locals as any).b2bUser;
    const result = await pool.query(
      `SELECT id, title, recipient, phone, city, district, address_line, postal_code, is_default, created_at
       FROM b2b_addresses
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [user.id],
    );
    return res.json(result.rows);
  });

  app.post("/api/b2b/addresses", requireB2B, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    const user = (res.locals as any).b2bUser;
    const value = (input: unknown, max: number) =>
      typeof input === "string" ? input.trim().slice(0, max) : "";

    const title = value(req.body?.title, 100);
    const recipient = value(req.body?.recipient, 160);
    const phone = value(req.body?.phone, 40);
    const city = value(req.body?.city, 100);
    const district = value(req.body?.district, 100);
    const addressLine = value(req.body?.addressLine, 700);
    const postalCode = value(req.body?.postalCode, 20);

    if (!title || !addressLine) {
      return res.status(400).json({ error: "Adres başlığı ve açık adres zorunludur" });
    }

    const existing = await pool.query(
      "SELECT COUNT(*)::int AS count FROM b2b_addresses WHERE user_id = $1",
      [user.id],
    );
    const makeDefault = Number(existing.rows[0]?.count || 0) === 0;

    const result = await pool.query(
      `INSERT INTO b2b_addresses
        (user_id, title, recipient, phone, city, district, address_line, postal_code, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [user.id, title, recipient || null, phone || null, city || null, district || null, addressLine, postalCode || null, makeDefault],
    );
    return res.status(201).json(result.rows[0]);
  });

  app.patch("/api/b2b/addresses/:id", requireB2B, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    const user = (res.locals as any).b2bUser;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz adres" });

    const value = (input: unknown, max: number) =>
      typeof input === "string" ? input.trim().slice(0, max) : "";

    const title = value(req.body?.title, 100);
    const recipient = value(req.body?.recipient, 160);
    const phone = value(req.body?.phone, 40);
    const city = value(req.body?.city, 100);
    const district = value(req.body?.district, 100);
    const addressLine = value(req.body?.addressLine, 700);
    const postalCode = value(req.body?.postalCode, 20);

    if (!title || !addressLine) {
      return res.status(400).json({ error: "Adres başlığı ve açık adres zorunludur" });
    }

    const result = await pool.query(
      `UPDATE b2b_addresses
       SET title = $3,
           recipient = $4,
           phone = $5,
           city = $6,
           district = $7,
           address_line = $8,
           postal_code = $9
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        id,
        user.id,
        title,
        recipient || null,
        phone || null,
        city || null,
        district || null,
        addressLine,
        postalCode || null,
      ],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Adres bulunamadı" });
    }

    return res.json(result.rows[0]);
  });

  app.delete("/api/b2b/addresses/:id", requireB2B, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    const user = (res.locals as any).b2bUser;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz adres" });

    const result = await pool.query(
      "DELETE FROM b2b_addresses WHERE id = $1 AND user_id = $2 RETURNING id, is_default",
      [id, user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Adres bulunamadı" });

    if (result.rows[0].is_default) {
      await pool.query(
        `UPDATE b2b_addresses SET is_default = TRUE
         WHERE id = (
           SELECT id FROM b2b_addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
         )`,
        [user.id],
      );
    }

    return res.json({ ok: true });
  });

  app.get("/api/b2b/checkout/preview", requireB2B, async (req, res) => {
    try {
      const quantity = cleanOrderQuantity(req.query.qty);
      const product = await checkoutProduct(req.query.productId, quantity);
      const totalUnits = quantity * product.unitsPerBox;
      const total = Number((product.price * totalUnits).toFixed(2));

      return res.json({
        product,
        quantity,
        totalUnits,
        total,
        currency: "TRY",
        iyzicoConfigured: await isIyzicoConfigured(),
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Ödeme özeti hazırlanamadı",
      });
    }
  });

  app.post("/api/b2b/checkout/preview", requireB2B, async (req, res) => {
    try {
      const cart = await checkoutItems(req.body?.items);
      return res.json({
        items: cart.items.map((entry) => ({
          product: entry.product,
          quantity: entry.quantity,
          totalUnits: entry.totalUnits,
          total: entry.total,
        })),
        total: cart.total,
        itemCount: cart.itemCount,
        boxCount: cart.boxCount,
        currency: "TRY",
        iyzicoConfigured: await isIyzicoConfigured(),
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Ödeme özeti hazırlanamadı",
      });
    }
  });

  app.post("/api/b2b/payments/iyzico/installments", requireB2B, async (req, res) => {
    if (!(await isIyzicoConfigured())) {
      return res.status(503).json({ error: "iyzico canlı bağlantısı henüz etkin değil" });
    }

    const binNumber = String(req.body?.binNumber || "")
      .replace(/\D/g, "")
      .slice(0, 8);
    if (!/^\d{8}$/.test(binNumber)) {
      return res.status(400).json({ error: "Kartın ilk 8 hanesini girin" });
    }

    try {
      const rawItems = Array.isArray(req.body?.items)
        ? req.body.items
        : [{ productId: req.body?.productId, quantity: req.body?.quantity }];
      const checkout = await checkoutItems(rawItems);
      const result = await retrieveIyzicoInstallments(checkout.total, binNumber);
      const detail = Array.isArray(result.installmentDetails)
        ? result.installmentDetails[0]
        : undefined;

      if (!detail || !Array.isArray(detail.installmentPrices)) {
        return res.status(404).json({
          error: "Bu kart için iyzico taksit bilgisi bulunamadı",
        });
      }

      const options = detail.installmentPrices
        .map((item) => {
          const installmentNumber = Number(item.installmentNumber);
          const installmentPrice = Number(item.installmentPrice);
          const totalPrice = Number(item.totalPrice);
          const commissionRate =
            checkout.total > 0
              ? Number((((totalPrice / checkout.total) - 1) * 100).toFixed(2))
              : 0;

          return {
            installmentNumber,
            installmentPrice: Number(installmentPrice.toFixed(2)),
            totalPrice: Number(totalPrice.toFixed(2)),
            commissionRate,
          };
        })
        .filter(
          (item) =>
            [1, 2, 3, 6, 9, 12].includes(item.installmentNumber) &&
            Number.isFinite(item.installmentPrice) &&
            item.installmentPrice > 0 &&
            Number.isFinite(item.totalPrice) &&
            item.totalPrice > 0,
        )
        .sort((a, b) => a.installmentNumber - b.installmentNumber);

      if (!options.length) {
        return res.status(404).json({
          error: "Bu kart için kullanılabilir taksit seçeneği bulunamadı",
        });
      }

      return res.json({
        binNumber,
        price: checkout.total,
        bankName: detail.bankName || "",
        bankCode: detail.bankCode || null,
        cardType: detail.cardType || "",
        cardAssociation: detail.cardAssociation || "",
        cardFamilyName: detail.cardFamilyName || "",
        commercial: Number(detail.commercial || 0),
        force3ds: Number(detail.force3ds || 0),
        options,
      });
    } catch (error) {
      return res.status(502).json({
        error:
          error instanceof Error
            ? error.message
            : "iyzico taksit seçenekleri alınamadı",
      });
    }
  });

  app.post("/api/b2b/payments/iyzico/3ds/initialize", requireB2B, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    if (!(await isIyzicoConfigured())) {
      return res.status(503).json({ error: "iyzico canlı bağlantısı henüz etkin değil" });
    }

    const user = (res.locals as any).b2bUser;
    const taxNumber = String(user.taxNumber || "").replace(/\D/g, "").slice(0, 50);
    if (taxNumber.length < 5) {
      return res.status(400).json({
        error: "Kartlı ödeme için firma vergi numarası hesap bilgilerinde bulunmalıdır",
      });
    }

    const card = req.body?.card && typeof req.body.card === "object"
      ? req.body.card as Record<string, unknown>
      : {};
    const cardHolderName = String(card.cardHolderName || "").trim().slice(0, 100);
    const cardNumber = String(card.cardNumber || "").replace(/\D/g, "").slice(0, 19);
    const expireMonth = String(card.expireMonth || "").replace(/\D/g, "").padStart(2, "0").slice(0, 2);
    let expireYear = String(card.expireYear || "").replace(/\D/g, "").slice(0, 4);
    const cvc = String(card.cvc || "").replace(/\D/g, "").slice(0, 4);
    const installment = Number.parseInt(String(req.body?.installment || "1"), 10);

    if (expireYear.length === 4) expireYear = expireYear.slice(-2);
    if (cardHolderName.length < 2) {
      return res.status(400).json({ error: "Kart üzerindeki isim soyisim zorunludur" });
    }
    if (!isValidPaymentCardNumber(cardNumber)) {
      return res.status(400).json({
        error: "Kart numarası eksik veya geçersiz. Lütfen kart üzerindeki numarayı kontrol edin.",
      });
    }
    if (!/^(0[1-9]|1[0-2])$/.test(expireMonth) || !/^\d{2}$/.test(expireYear)) {
      return res.status(400).json({ error: "Kart son kullanım tarihi geçersiz" });
    }
    if (!/^\d{3,4}$/.test(cvc)) {
      return res.status(400).json({ error: "CVV bilgisi geçersiz" });
    }
    if (![1, 2, 3, 6, 9, 12].includes(installment)) {
      return res.status(400).json({ error: "Geçersiz taksit seçeneği" });
    }

    let checkout: Awaited<ReturnType<typeof checkoutItems>>;
    let address: any;
    let shipping: ShippingSelection;

    try {
      const rawItems = Array.isArray(req.body?.items)
        ? req.body.items
        : [{ productId: req.body?.productId, quantity: req.body?.quantity }];
      checkout = await checkoutItems(rawItems);
      address = await checkoutAddress(user.id, req.body?.addressId);
      shipping = checkoutShipping(req.body?.shipping);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Sipariş bilgileri geçersiz",
      });
    }

    let installmentTotal = checkout.total;
    let installmentRate = 0;
    try {
      const installmentInfo = await retrieveIyzicoInstallments(
        checkout.total,
        cardNumber.slice(0, 8),
      );
      const detail = Array.isArray(installmentInfo.installmentDetails)
        ? installmentInfo.installmentDetails[0]
        : undefined;
      const selected = detail?.installmentPrices?.find(
        (item) => Number(item.installmentNumber) === installment,
      );

      if (!selected) {
        return res.status(400).json({
          error: "Seçilen taksit bu kart için iyzico tarafından desteklenmiyor",
        });
      }

      installmentTotal = Number(Number(selected.totalPrice).toFixed(2));
      if (!Number.isFinite(installmentTotal) || installmentTotal <= 0) {
        throw new Error("iyzico geçerli taksit toplamı döndürmedi");
      }
      installmentRate = Number(
        (((installmentTotal / checkout.total) - 1) * 100).toFixed(2),
      );
    } catch (error) {
      return res.status(502).json({
        error:
          error instanceof Error
            ? error.message
            : "Taksit bilgisi iyzico üzerinden doğrulanamadı",
      });
    }

    const city = String(address.city || "").trim();
    const postalCode = String(address.postal_code || "").trim();
    const addressText = String(address.address_line || "").trim();
    if (!city || !postalCode || !addressText) {
      return res.status(400).json({
        error: "Kartlı ödeme için teslimat adresinde şehir, posta kodu ve açık adres zorunludur",
      });
    }

    const orderNumber = newB2BOrderNumber();
    const total = checkout.total;
    const email = String(user.email || user.username || "").trim();
    const firstName = String(user.firstName || user.companyName || "Müşteri").trim().slice(0, 120);
    const lastName = String(user.lastName || "Yetkili").trim().slice(0, 120);
    const contactName = String(address.recipient || `${firstName} ${lastName}`).trim().slice(0, 180);
    const gsm = String(address.phone || "").trim();
    const callbackBase = String(process.env.B2B_PUBLIC_URL || "https://b2b.ecalisgan.com").replace(/\/$/, "");
    const isCartCheckout = Array.isArray(req.body?.items) && req.body.items.length > 0;
    const callbackUrl =
      `${callbackBase}/api/b2b/payments/iyzico/3ds/callback?order=${encodeURIComponent(orderNumber)}${isCartCheckout ? "&cart=1" : ""}`;

    const orderItems = checkout.items.map((entry) => ({
      productId: entry.product.id,
      sku: entry.product.sku,
      name: entry.product.name,
      quantity: entry.quantity,
      unitsPerBox: entry.product.unitsPerBox,
      totalUnits: entry.totalUnits,
      unitPrice: entry.product.price,
      total: entry.total,
      image: entry.product.image,
    }));
    const { billingDetails, shippingAddress, checkoutTrace } = buildOrderSnapshots(
      user,
      address,
      shipping,
      req.body?.checkoutContext,
    );

    const created = await pool.query(
      `INSERT INTO b2b_orders (
        order_no, order_number, customer_email, status, item_count, total_amount,
        payment_method, payment_provider, payment_status,
        shipping_method, shipping_details, user_id, items,
        billing_details, shipping_address, checkout_trace
      )
      VALUES ($1,$1,$2,'payment_pending',$3,$4,'card','iyzico_3ds','initializing',$5,$6::jsonb,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb)
      RETURNING id`,
      [
        orderNumber,
        email,
        checkout.itemCount,
        installmentTotal,
        shipping.method,
        JSON.stringify(shipping.details),
        user.id,
        JSON.stringify(orderItems),
        JSON.stringify(billingDetails),
        JSON.stringify(shippingAddress),
        JSON.stringify(checkoutTrace),
      ],
    );
    const orderId = created.rows[0]?.id;

    try {
      const payment = await initializeIyzico3DS({
        locale: "tr",
        conversationId: orderNumber,
        price: total,
        paidPrice: installmentTotal,
        currency: "TRY",
        installment,
        paymentChannel: "WEB",
        basketId: orderNumber,
        paymentGroup: "PRODUCT",
        callbackUrl,
        paymentCard: {
          cardHolderName,
          cardNumber,
          expireYear,
          expireMonth,
          cvc,
          registerCard: 0,
        },
        buyer: {
          id: String(user.id),
          name: firstName,
          surname: lastName,
          identityNumber: taxNumber,
          email,
          ...(gsm ? { gsmNumber: gsm } : {}),
          registrationAddress: addressText,
          city,
          country: "Turkey",
          zipCode: postalCode,
          ip: requestIp(req),
        },
        shippingAddress: {
          address: shipping.method === "pickup" ? shipping.details.address : addressText,
          zipCode: shipping.method === "pickup" ? "34218" : postalCode,
          contactName,
          city: shipping.method === "pickup" ? "İstanbul" : city,
          country: "Turkey",
        },
        billingAddress: {
          address: addressText,
          zipCode: postalCode,
          contactName,
          city,
          country: "Turkey",
        },
        basketItems: checkout.items.map((entry) => ({
          id: entry.product.id,
          price: entry.total,
          name: `${entry.product.name} · ${entry.quantity} koli · ${entry.totalUnits} adet`.slice(0, 500),
          category1: entry.product.category || "Genel",
          itemType: "PHYSICAL",
        })),
      });

      if (!payment.paymentId || !payment.threeDSHtmlContent) {
        throw new Error("3D Secure doğrulama ekranı oluşturulamadı");
      }

      await pool.query(
        `UPDATE b2b_orders
         SET payment_id = $2,
             payment_status = '3ds_pending'
         WHERE id = $1`,
        [orderId, payment.paymentId],
      );

      return res.json({
        orderNumber,
        paymentId: payment.paymentId,
        paidPrice: installmentTotal,
        installment,
        installmentRate,
        threeDSHtmlContent: payment.threeDSHtmlContent,
      });
    } catch (error) {
      const providerMessage =
        error instanceof Error ? error.message : "Kartlı ödeme başlatılamadı";

      console.error("iyzico 3DS initialize failed", {
        order: orderNumber,
        cardBin: cardNumber.slice(0, 8),
        cardLength: cardNumber.length,
        installment,
        paidPrice: installmentTotal,
        message: providerMessage,
      });

      await pool.query(
        `UPDATE b2b_orders
         SET status = 'payment_failed',
             payment_status = 'initialize_failed'
         WHERE id = $1`,
        [orderId],
      );

      const friendlyMessage = /kart num/i.test(providerMessage)
        ? "Kart numarası iyzico tarafından geçersiz bulundu. Kart numarasını kontrol edip tekrar deneyin."
        : providerMessage;

      return res.status(502).json({
        error: friendlyMessage,
      });
    }
  });

  app.post("/api/b2b/payments/iyzico/3ds/callback", async (req, res) => {
    if (!pool) return res.status(503).send("Database unavailable");

    const redirectBase = String(process.env.B2B_PUBLIC_URL || "https://b2b.ecalisgan.com").replace(/\/$/, "");
    const cartQuery = String(req.query?.cart || "") === "1" ? "&cart=1" : "";
    const topRedirect = (url: string) => {
      const target = JSON.stringify(url);
      return res
        .status(200)
        .type("html")
        .send(`<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
<script>
(function () {
  var target = ${target};
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "caliskan-b2b-payment-result", url: target }, "*");
    }
  } catch (_) {}

  try {
    if (window.top && window.top !== window) {
      window.top.location.replace(target);
      return;
    }
  } catch (_) {}

  window.location.replace(target);
})();
</script>
</body>
</html>`);
    };
    const callbackOrder = String(req.query?.order || "").trim();
    let paymentId = String(req.body?.paymentId || "").trim();
    let conversationId =
      String(req.body?.conversationId || "").trim() || callbackOrder;
    const conversationData = String(req.body?.conversationData || "").trim();
    const callbackStatus = String(req.body?.status || "").toLowerCase();
    const mdStatus = String(req.body?.mdStatus || "").trim();

    if ((!paymentId || !conversationId) && callbackOrder) {
      const stored = await pool.query(
        `SELECT order_number, payment_id
         FROM b2b_orders
         WHERE order_number = $1
         LIMIT 1`,
        [callbackOrder],
      ).catch(() => ({ rows: [] as any[] }));
      const row = stored.rows[0];
      if (!conversationId && row?.order_number) {
        conversationId = String(row.order_number);
      }
      if (!paymentId && row?.payment_id) {
        paymentId = String(row.payment_id);
      }
    }

    console.info("iyzico 3DS callback received", {
      order: conversationId || callbackOrder || null,
      hasPaymentId: Boolean(paymentId),
      hasConversationData: Boolean(conversationData),
      status: callbackStatus || null,
      mdStatus: mdStatus || null,
    });

    if (!paymentId || !conversationId) {
      if (conversationId) {
        await pool.query(
          `UPDATE b2b_orders
           SET status = 'payment_failed', payment_status = '3ds_callback_incomplete'
           WHERE order_number = $1`,
          [conversationId],
        ).catch(() => undefined);
      }
      return topRedirect(
        `${redirectBase}/odeme?result=failed&order=${encodeURIComponent(conversationId || callbackOrder)}${cartQuery}`,
      );
    }

    if (callbackStatus !== "success" || mdStatus !== "1") {
      const paymentStatus = "3ds_failed_md_" + (mdStatus || "unknown");
      await pool.query(
        `UPDATE b2b_orders
         SET status = 'payment_failed',
             payment_status = $2
         WHERE order_number = $1`,
        [conversationId, paymentStatus],
      ).catch(() => undefined);

      console.warn("iyzico 3DS bank verification failed", {
        order: conversationId,
        callbackStatus: callbackStatus || null,
        mdStatus: mdStatus || null,
      });

      return topRedirect(
        `${redirectBase}/odeme?result=failed&reason=3ds&mdStatus=${encodeURIComponent(mdStatus || "unknown")}&order=${encodeURIComponent(conversationId)}${cartQuery}`,
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const orderResult = await client.query(
        `SELECT id, order_number, payment_status, items
         FROM b2b_orders
         WHERE order_number = $1 AND payment_id = $2
         LIMIT 1
         FOR UPDATE`,
        [conversationId, paymentId],
      );
      const order = orderResult.rows[0];

      if (!order) {
        await client.query("ROLLBACK");
        return topRedirect(`${redirectBase}/odeme?result=failed`);
      }

      if (order.payment_status === "SUCCESS") {
        await client.query("COMMIT");
        return topRedirect(
          `${redirectBase}/odeme?result=success&order=${encodeURIComponent(order.order_number)}${cartQuery}`,
        );
      }

      const payment = await completeIyzico3DS({
        locale: "tr",
        paymentId,
        conversationId,
        ...(conversationData ? { conversationData } : {}),
      });

      const success =
        payment.status === "success" &&
        Number(payment.fraudStatus ?? 1) !== -1;

      if (!success) {
        console.warn("iyzico 3DS auth rejected", {
          order: order.order_number,
          status: payment.status || null,
          fraudStatus: payment.fraudStatus ?? null,
          errorCode: payment.errorCode || null,
          errorMessage: payment.errorMessage || null,
          callbackStatus: callbackStatus || null,
          mdStatus: mdStatus || null,
        });
        await client.query(
          `UPDATE b2b_orders
           SET status = 'payment_failed',
               payment_status = 'FAILURE'
           WHERE id = $1`,
          [order.id],
        );
        await client.query("COMMIT");
        return topRedirect(
          `${redirectBase}/odeme?result=failed&order=${encodeURIComponent(order.order_number)}${cartQuery}`,
        );
      }

      const items = Array.isArray(order.items) ? order.items : [];
      let stockReview = false;
      for (const entry of items) {
        const productId = String(entry?.productId || "").trim();
        const totalUnits = Math.max(
          0,
          cleanOrderQuantity(entry?.totalUnits) ||
            cleanOrderQuantity(entry?.quantity) *
              Math.max(1, cleanOrderQuantity(entry?.unitsPerBox) || 1),
        );
        if (!productId || totalUnits <= 0) continue;

        const stockUpdate = await client.query(
          `UPDATE b2b_products
           SET stock = stock - $2,
               updated_at = NOW()
           WHERE id::text = $1
             AND stock >= $2
           RETURNING stock`,
          [productId, totalUnits],
        );
        if (!stockUpdate.rows[0]) stockReview = true;
      }

      await client.query(
        `UPDATE b2b_orders
         SET status = $2,
             payment_status = 'SUCCESS',
             payment_id = $3
         WHERE id = $1`,
        [order.id, stockReview ? "paid_stock_review" : "paid", payment.paymentId || paymentId],
      );
      await client.query("COMMIT");

      return topRedirect(
        `${redirectBase}/odeme?result=success&order=${encodeURIComponent(order.order_number)}${cartQuery}${stockReview ? "&stock=review" : ""}`,
      );
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("iyzico 3DS callback failed:", error instanceof Error ? error.message : "unknown");
      return topRedirect(`${redirectBase}/odeme?result=failed&order=${encodeURIComponent(conversationId)}${cartQuery}`);
    } finally {
      client.release();
    }
  });

  app.post("/api/b2b/payments/iyzico/initialize", requireB2B, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    if (!(await isIyzicoConfigured())) {
      return res.status(503).json({
        error: "iyzico canlı bağlantısı henüz API anahtarlarıyla etkinleştirilmedi",
      });
    }

    const user = (res.locals as any).b2bUser;
    const identityNumber = String(user.taxNumber || "")
      .replace(/\D/g, "")
      .slice(0, 50);

    if (identityNumber.length < 5) {
      return res.status(400).json({
        error: "Kartlı ödeme için firma vergi numarası hesap bilgilerinde bulunmalıdır",
      });
    }

    let checkout: Awaited<ReturnType<typeof checkoutItems>>;
    let address: any;
    let shipping: ShippingSelection;

    try {
      const rawItems = Array.isArray(req.body?.items)
        ? req.body.items
        : [{ productId: req.body?.productId, quantity: req.body?.quantity }];
      checkout = await checkoutItems(rawItems);
      address = await checkoutAddress(user.id, req.body?.addressId);
      shipping = checkoutShipping(req.body?.shipping);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Sipariş bilgileri geçersiz",
      });
    }

    const city = String(address.city || "").trim();
    const postalCode = String(address.postal_code || "").trim();
    if (!city || !postalCode) {
      return res.status(400).json({
        error: "iyzico ödemesi için teslimat adresinde şehir ve posta kodu bulunmalıdır",
      });
    }

    const orderNumber = newB2BOrderNumber();
    const total = checkout.total;
    const email = String(user.email || user.username || "").trim();
    const firstName = String(user.firstName || user.companyName || "Müşteri").trim().slice(0, 120);
    const lastName = String(user.lastName || "Yetkili").trim().slice(0, 120);
    const contactName = String(address.recipient || `${firstName} ${lastName}`).trim().slice(0, 180);
    const callbackBase = String(process.env.B2B_PUBLIC_URL || "https://b2b.ecalisgan.com").replace(/\/$/, "");
    const isCartCheckout = Array.isArray(req.body?.items) && req.body.items.length > 0;
    const callbackUrl = `${callbackBase}/api/b2b/payments/iyzico/callback${isCartCheckout ? "?cart=1" : ""}`;
    const addressText = String(address.address_line || "").trim();
    const gsm = String(address.phone || "").trim();
    const orderItems = checkout.items.map((entry) => ({
      productId: entry.product.id,
      sku: entry.product.sku,
      name: entry.product.name,
      quantity: entry.quantity,
      unitsPerBox: entry.product.unitsPerBox,
      totalUnits: entry.totalUnits,
      unitPrice: entry.product.price,
      total: entry.total,
      image: entry.product.image,
    }));
    const { billingDetails, shippingAddress, checkoutTrace } = buildOrderSnapshots(
      user,
      address,
      shipping,
      req.body?.checkoutContext,
    );

    const created = await pool.query(
      `INSERT INTO b2b_orders (
        order_no, order_number, customer_email, status, item_count, total_amount,
        payment_method, payment_provider, payment_status,
        shipping_method, shipping_details, user_id, items,
        billing_details, shipping_address, checkout_trace
      )
      VALUES ($1,$1,$2,'payment_pending',$3,$4,'card','iyzico','initializing',$5,$6::jsonb,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb)
      RETURNING id, order_number`,
      [
        orderNumber,
        email,
        checkout.itemCount,
        total,
        shipping.method,
        JSON.stringify(shipping.details),
        user.id,
        JSON.stringify(orderItems),
        JSON.stringify(billingDetails),
        JSON.stringify(shippingAddress),
        JSON.stringify(checkoutTrace),
      ],
    );

    const orderId = created.rows[0]?.id;

    try {
      const iyzico = await initializeIyzicoCheckout({
        locale: "tr",
        conversationId: orderNumber,
        price: total,
        paidPrice: total,
        currency: "TRY",
        basketId: orderNumber,
        paymentGroup: "PRODUCT",
        callbackUrl,
        enabledInstallments: [1, 2, 3, 6, 9, 12],
        buyer: {
          id: String(user.id),
          name: firstName,
          surname: lastName,
          identityNumber,
          email,
          ...(gsm ? { gsmNumber: gsm } : {}),
          registrationAddress: addressText,
          city,
          country: "Turkey",
          zipCode: postalCode,
          ip: requestIp(req),
        },
        shippingAddress: {
          address:
            shipping.method === "pickup"
              ? shipping.details.address
              : addressText,
          zipCode: shipping.method === "pickup" ? "34218" : postalCode,
          contactName,
          city: shipping.method === "pickup" ? "İstanbul" : city,
          country: "Turkey",
        },
        billingAddress: {
          address: addressText,
          zipCode: postalCode,
          contactName,
          city,
          country: "Turkey",
        },
        basketItems: checkout.items.map((entry) => ({
          id: entry.product.id,
          price: entry.total,
          name: `${entry.product.name} · ${entry.quantity} koli · ${entry.totalUnits} adet`.slice(0, 500),
          category1: entry.product.category || "Genel",
          itemType: "PHYSICAL",
        })),
      });

      if (!iyzico.token || !iyzico.paymentPageUrl) {
        throw new Error("iyzico ödeme sayfası oluşturulamadı");
      }

      await pool.query(
        `UPDATE b2b_orders
         SET payment_token = $2,
             payment_status = 'initialized'
         WHERE id = $1`,
        [orderId, iyzico.token],
      );

      return res.json({
        orderNumber,
        paymentPageUrl: iyzico.paymentPageUrl,
        tokenExpireTime: iyzico.tokenExpireTime || null,
      });
    } catch (error) {
      await pool.query(
        `UPDATE b2b_orders
         SET status = 'payment_failed',
             payment_status = 'initialize_failed'
         WHERE id = $1`,
        [orderId],
      );

      console.error("iyzico checkout initialize failed:", error);
      return res.status(502).json({
        error: error instanceof Error ? error.message : "iyzico ödeme başlatılamadı",
      });
    }
  });

  app.post("/api/b2b/payments/iyzico/callback", async (req, res) => {
    if (!pool) return res.status(503).send("Database unavailable");

    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const redirectBase = String(process.env.B2B_PUBLIC_URL || "https://b2b.ecalisgan.com").replace(/\/$/, "");
    const cartQuery = String(req.query?.cart || "") === "1" ? "&cart=1" : "";

    if (!token) {
      return res.redirect(303, `${redirectBase}/odeme?result=failed`);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const orderResult = await client.query(
        `SELECT id, order_number, payment_status, items
         FROM b2b_orders
         WHERE payment_token = $1
         LIMIT 1
         FOR UPDATE`,
        [token],
      );

      const order = orderResult.rows[0];
      if (!order) {
        await client.query("ROLLBACK");
        return res.redirect(303, `${redirectBase}/odeme?result=failed`);
      }

      if (order.payment_status === "SUCCESS") {
        await client.query("COMMIT");
        return res.redirect(
          303,
          `${redirectBase}/odeme?result=success&order=${encodeURIComponent(order.order_number)}${cartQuery}`,
        );
      }

      const payment = await retrieveIyzicoCheckout(token);
      const success =
        payment.status === "success" &&
        String(payment.paymentStatus || "").toUpperCase() === "SUCCESS";

      if (success) {
        const items = Array.isArray(order.items) ? order.items : [];
        for (const entry of items) {
          const productId = String(entry?.productId || "").trim();
          const boxQuantity = Math.max(0, cleanOrderQuantity(entry?.quantity));
          const unitsPerBox = Math.max(1, cleanOrderQuantity(entry?.unitsPerBox) || 1);
          const totalUnits = Math.max(
            0,
            cleanOrderQuantity(entry?.totalUnits) || boxQuantity * unitsPerBox,
          );
          if (!productId || boxQuantity <= 0 || totalUnits <= 0) continue;

          const stockUpdate = await client.query(
            `UPDATE b2b_products
             SET stock = stock - $2,
                 updated_at = NOW()
             WHERE id::text = $1
               AND stock >= $2
             RETURNING stock`,
            [productId, totalUnits],
          );

          if (!stockUpdate.rows[0]) {
            await client.query(
              `UPDATE b2b_orders
               SET status = 'paid_stock_review',
                   payment_status = 'SUCCESS',
                   payment_id = $2,
                   card_last4 = $3,
                   card_association = $4,
                   total_amount = COALESCE(NULLIF($5::numeric, 0), total_amount),
                   checkout_trace = COALESCE(checkout_trace, '{}'::jsonb) ||
                     jsonb_build_object('completedAt', NOW(), 'result', 'SUCCESS')
               WHERE id = $1`,
              [
                order.id,
                payment.paymentId || null,
                payment.lastFourDigits || null,
                payment.cardAssociation || null,
                Number(payment.paidPrice || payment.price || 0),
              ],
            );
            await client.query("COMMIT");
            return res.redirect(
              303,
              `${redirectBase}/odeme?result=success&order=${encodeURIComponent(order.order_number)}${cartQuery}&stock=review`,
            );
          }
        }

        await client.query(
          `UPDATE b2b_orders
           SET status = 'paid',
               payment_status = 'SUCCESS',
               payment_id = $2,
               card_last4 = $3,
               card_association = $4,
               total_amount = COALESCE(NULLIF($5::numeric, 0), total_amount),
               checkout_trace = COALESCE(checkout_trace, '{}'::jsonb) ||
                 jsonb_build_object('completedAt', NOW(), 'result', 'SUCCESS')
           WHERE id = $1`,
          [
            order.id,
            payment.paymentId || null,
            payment.lastFourDigits || null,
            payment.cardAssociation || null,
            Number(payment.paidPrice || payment.price || 0),
          ],
        );
      } else {
        await client.query(
          `UPDATE b2b_orders
           SET status = 'payment_failed',
               payment_status = 'FAILURE',
               payment_id = $2,
               card_last4 = $3,
               card_association = $4,
               checkout_trace = COALESCE(checkout_trace, '{}'::jsonb) ||
                 jsonb_build_object('completedAt', NOW(), 'result', 'FAILURE')
           WHERE id = $1`,
          [
            order.id,
            payment.paymentId || null,
            payment.lastFourDigits || null,
            payment.cardAssociation || null,
          ],
        );
      }

      await client.query("COMMIT");

      return res.redirect(
        303,
        success
          ? `${redirectBase}/odeme?result=success&order=${encodeURIComponent(order.order_number)}${cartQuery}`
          : `${redirectBase}/odeme?result=failed&order=${encodeURIComponent(order.order_number)}${cartQuery}`,
      );
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("iyzico callback failed:", error);
      return res.redirect(303, `${redirectBase}/odeme?result=failed`);
    } finally {
      client.release();
    }
  });

  app.post("/api/b2b/payments/bank-transfer", requireB2B, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    const user = (res.locals as any).b2bUser;
    const bank = await bankTransferSettings();

    if (!bank.enabled || !bank.iban || !bank.bankName || !bank.accountHolder) {
      return res.status(503).json({ error: "Havale/EFT ödeme yöntemi henüz yapılandırılmadı" });
    }

    let checkout: Awaited<ReturnType<typeof checkoutItems>>;
    let address: any;
    let shipping: ShippingSelection;

    try {
      const rawItems = Array.isArray(req.body?.items)
        ? req.body.items
        : [{ productId: req.body?.productId, quantity: req.body?.quantity }];
      checkout = await checkoutItems(rawItems);
      address = await checkoutAddress(user.id, req.body?.addressId);
      shipping = checkoutShipping(req.body?.shipping);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Sipariş bilgileri geçersiz",
      });
    }

    const orderNumber = newB2BOrderNumber();
    const total = checkout.total;
    const email = String(user.email || user.username || "").trim();
    const orderItems = checkout.items.map((entry) => ({
      productId: entry.product.id,
      sku: entry.product.sku,
      name: entry.product.name,
      quantity: entry.quantity,
      unitsPerBox: entry.product.unitsPerBox,
      totalUnits: entry.totalUnits,
      unitPrice: entry.product.price,
      total: entry.total,
      image: entry.product.image,
    }));
    const { billingDetails, shippingAddress, checkoutTrace } = buildOrderSnapshots(
      user,
      address,
      shipping,
      req.body?.checkoutContext,
    );

    await pool.query(
      `INSERT INTO b2b_orders (
        order_no, order_number, customer_email, status, item_count, total_amount,
        payment_method, payment_provider, payment_status,
        shipping_method, shipping_details, user_id, items,
        billing_details, shipping_address, checkout_trace
      )
      VALUES ($1,$1,$2,'awaiting_bank_transfer',$3,$4,'bank_transfer','manual_eft','pending',$5,$6::jsonb,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb)`,
      [
        orderNumber,
        email,
        checkout.itemCount,
        total,
        shipping.method,
        JSON.stringify(shipping.details),
        user.id,
        JSON.stringify(orderItems),
        JSON.stringify(billingDetails),
        JSON.stringify(shippingAddress),
        JSON.stringify(checkoutTrace),
      ],
    );

    return res.status(201).json({
      orderNumber,
      total,
      bankTransfer: bank,
      transferDescription: orderNumber,
    });
  });

  app.post("/api/b2b/payments/bank-transfer/:orderNumber/confirm", requireB2B, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    const user = (res.locals as any).b2bUser;
    const orderNumber = String(req.params.orderNumber || "").trim().slice(0, 80);

    const result = await pool.query(
      `UPDATE b2b_orders
       SET status = 'awaiting_bank_confirmation',
           payment_status = 'customer_reported_paid'
       WHERE order_number = $1
         AND user_id = $2
         AND payment_method = 'bank_transfer'
         AND payment_status IN ('pending','customer_reported_paid')
       RETURNING id, order_number, status, payment_status`,
      [orderNumber, user.id],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Havale/EFT siparişi bulunamadı" });
    }

    return res.json(result.rows[0]);
  });

  app.get("/api/b2b/payment-methods", requireB2B, async (_req, res) => {
    if (!pool) return res.json([]);
    const user = (res.locals as any).b2bUser;
    const result = await pool.query(
      `SELECT id, provider, brand, last4, holder_name, is_default, created_at
       FROM b2b_payment_methods
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [user.id],
    );
    return res.json(result.rows);
  });

  app.get("/api/b2b/my-orders", requireB2B, async (_req, res) => {
    if (!pool) return res.json([]);
    const user = (res.locals as any).b2bUser;
    const email = String(user.email || user.username || "").toLowerCase();
    const result = await pool.query(
      `SELECT id, order_number, customer_email, status, item_count, total_amount,
              payment_method, payment_status, shipping_method, shipping_details,
              card_last4, card_association, cancel_requested_at, created_at
       FROM b2b_orders
       WHERE LOWER(COALESCE(customer_email, '')) = $1
         AND COALESCE(status, '') <> 'payment_failed'
         AND COALESCE(payment_status, '') NOT IN ('FAILURE','initialize_failed')
         AND COALESCE(payment_status, '') NOT LIKE '3ds_failed%'
       ORDER BY created_at DESC`,
      [email],
    );
    return res.json(result.rows);
  });

  app.get("/api/b2b/my-orders/:id", requireB2B, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    const user = (res.locals as any).b2bUser;
    const email = String(user.email || user.username || "").toLowerCase();
    const id = String(req.params.id || "").trim();

    const result = await pool.query(
      `SELECT *
       FROM b2b_orders
       WHERE id::text = $1
         AND LOWER(COALESCE(customer_email, '')) = $2
         AND COALESCE(status, '') <> 'payment_failed'
         AND COALESCE(payment_status, '') NOT IN ('FAILURE','initialize_failed')
         AND COALESCE(payment_status, '') NOT LIKE '3ds_failed%'
       LIMIT 1`,
      [id, email],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Sipariş bulunamadı" });
    }

    return res.json(await hydrateB2BOrderDetail(result.rows[0]));
  });

  app.post("/api/b2b/my-orders/:id/cancel", requireB2B, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    const user = (res.locals as any).b2bUser;
    const email = String(user.email || user.username || "").toLowerCase();
    const id = String(req.params.id || "").trim();

    const result = await pool.query(
      `UPDATE b2b_orders
       SET status = 'cancel_requested',
           cancel_requested_at = NOW()
       WHERE id::text = $1
         AND LOWER(COALESCE(customer_email, '')) = $2
         AND status IN ('paid','paid_stock_review')
         AND cancel_requested_at IS NULL
       RETURNING id, order_number, status, cancel_requested_at`,
      [id, email],
    );

    if (!result.rows[0]) {
      return res.status(409).json({
        error: "Bu sipariş için iptal talebi oluşturulamıyor veya talep zaten mevcut",
      });
    }

    await pool.query(
      `INSERT INTO b2b_support_tickets (user_id, subject, message)
       VALUES ($1,$2,$3)`,
      [
        user.id,
        `Sipariş iptal talebi · ${result.rows[0].order_number}`,
        `Müşteri ${result.rows[0].order_number} numaralı sipariş için iptal talebi oluşturdu.`,
      ],
    ).catch(() => undefined);

    return res.json(result.rows[0]);
  });

  app.get("/api/b2b/my-returns", requireB2B, async (_req, res) => {
    if (!pool) return res.json([]);
    const user = (res.locals as any).b2bUser;
    const result = await pool.query(
      `SELECT id, order_number, status, reason, created_at
       FROM b2b_returns
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id],
    );
    return res.json(result.rows);
  });

  app.get("/api/b2b/my-invoices", requireB2B, async (_req, res) => {
    if (!pool) return res.json([]);
    const user = (res.locals as any).b2bUser;
    const result = await pool.query(
      `SELECT id, invoice_number, order_number, total_amount, download_url, created_at
       FROM b2b_invoices
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id],
    );
    return res.json(result.rows);
  });

  app.get("/api/b2b/support", requireB2B, async (_req, res) => {
    if (!pool) return res.json([]);
    const user = (res.locals as any).b2bUser;
    const result = await pool.query(
      `SELECT id, subject, message, status, created_at
       FROM b2b_support_tickets
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [user.id],
    );
    return res.json(result.rows);
  });

  app.post("/api/b2b/support", requireB2B, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    const user = (res.locals as any).b2bUser;
    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim().slice(0, 180) : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 4000) : "";

    if (subject.length < 2 || message.length < 3) {
      return res.status(400).json({ error: "Konu ve mesaj alanlarını doldurun" });
    }

    const result = await pool.query(
      `INSERT INTO b2b_support_tickets (user_id, subject, message)
       VALUES ($1,$2,$3)
       RETURNING id, subject, message, status, created_at`,
      [user.id, subject, message],
    );
    return res.status(201).json(result.rows[0]);
  });

  app.post("/api/b2b/change-password", requireB2B, async (req, res) => {
    const user = (res.locals as any).b2bUser;
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    const newPasswordAgain = typeof req.body?.newPasswordAgain === "string" ? req.body.newPasswordAgain : "";

    if (!verifyPassword(currentPassword, user.password)) {
      return res.status(401).json({ error: "Mevcut şifreniz hatalı" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Yeni şifre en az 8 karakter olmalıdır" });
    }
    if (newPassword !== newPasswordAgain) {
      return res.status(400).json({ error: "Yeni şifreler eşleşmiyor" });
    }

    await storage.updateUser(user.id, {
      password: hashPassword(newPassword),
      mustChangePassword: 0,
    });

    return res.json({ ok: true });
  });

  app.delete("/api/b2b/account", requireB2B, async (req, res) => {
    const user = (res.locals as any).b2bUser;
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({ error: "Hesabı silmek için mevcut şifrenizi doğru girin" });
    }

    await storage.updateUser(user.id, {
      username: `deleted-${user.id}-${Date.now()}`,
      email: null,
      isActive: 0,
      applicationStatus: "deleted",
      password: hashPassword(randomBytes(32).toString("hex")),
    });

    req.session.destroy(() => undefined);
    res.clearCookie("connect.sid");
    return res.json({ ok: true });
  });

  app.use("/api", requireAuth);

  app.get("/api/customers", async (_req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomer(id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(id, validatedData);
      if (!customer) {
        return res.status(404).json({ error: "Müşteri bulunamadı" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error updating customer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Müşteri güncellenemedi" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.deleteCustomer(id);
      if (!result.ok) {
        return res.status(409).json({ error: result.error });
      }
      res.status(200).json({ message: "Müşteri silindi" });
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ error: "Müşteri silinemedi" });
    }
  });

  app.get("/api/warehouses", async (_req, res) => {
    try {
      res.json(await storage.getWarehouses());
    } catch (error) {
      console.error("Error fetching warehouses:", error);
      res.status(500).json({ error: "Depolar alınamadı" });
    }
  });

  app.post("/api/warehouses", async (req, res) => {
    try {
      const data = insertWarehouseSchema.parse(req.body);
      res.status(201).json(await storage.createWarehouse(data));
    } catch (error) {
      console.error("Error creating warehouse:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Depo oluşturulamadı" });
    }
  });

  app.patch("/api/warehouses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertWarehouseSchema.partial().parse(req.body);
      const warehouse = await storage.updateWarehouse(id, data);
      if (!warehouse) return res.status(404).json({ error: "Depo bulunamadı" });
      res.json(warehouse);
    } catch (error) {
      console.error("Error updating warehouse:", error);
      res.status(500).json({ error: "Depo güncellenemedi" });
    }
  });

  app.delete("/api/warehouses/:id", async (req, res) => {
    try {
      const result = await storage.deleteWarehouse(parseInt(req.params.id));
      if (!result.ok) return res.status(409).json({ error: result.error });
      res.json({ message: "Depo silindi" });
    } catch (error) {
      console.error("Error deleting warehouse:", error);
      res.status(500).json({ error: "Depo silinemedi" });
    }
  });

  app.get("/api/suppliers", async (_req, res) => {
    try {
      res.json(await storage.getSuppliers());
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ error: "Tedarikçiler alınamadı" });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const data = insertSupplierSchema.parse(req.body);
      res.status(201).json(await storage.createSupplier(data));
    } catch (error) {
      console.error("Error creating supplier:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Tedarikçi oluşturulamadı" });
    }
  });

  app.patch("/api/suppliers/:id", async (req, res) => {
    try {
      const supplier = await storage.updateSupplier(parseInt(req.params.id), insertSupplierSchema.partial().parse(req.body));
      if (!supplier) return res.status(404).json({ error: "Tedarikçi bulunamadı" });
      res.json(supplier);
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ error: "Tedarikçi güncellenemedi" });
    }
  });

  app.delete("/api/suppliers/:id", async (req, res) => {
    try {
      const result = await storage.deleteSupplier(parseInt(req.params.id));
      if (!result.ok) return res.status(409).json({ error: result.error });
      res.json({ message: "Tedarikçi silindi" });
    } catch (error) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ error: "Tedarikçi silinemedi" });
    }
  });

  app.get("/api/invoices", async (_req, res) => {
    try {
      res.json(await storage.getInvoices());
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ error: "Faturalar alınamadı" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const data = insertInvoiceSchema.parse({
        ...req.body,
        invoiceDate: req.body.invoiceDate ? new Date(req.body.invoiceDate) : new Date(),
        customerId: req.body.customerId || undefined,
      });
      res.status(201).json(await storage.createInvoice(data));
    } catch (error) {
      console.error("Error creating invoice:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Fatura oluşturulamadı" });
    }
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    try {
      const payload: Record<string, unknown> = { ...req.body };
      if (payload.invoiceDate) payload.invoiceDate = new Date(payload.invoiceDate as string);
      const invoice = await storage.updateInvoice(parseInt(req.params.id), insertInvoiceSchema.partial().parse(payload));
      if (!invoice) return res.status(404).json({ error: "Fatura bulunamadı" });
      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ error: "Fatura güncellenemedi" });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const result = await storage.deleteInvoice(parseInt(req.params.id));
      if (!result.ok) return res.status(409).json({ error: result.error });
      res.json({ message: "Fatura silindi" });
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ error: "Fatura silinemedi" });
    }
  });

  app.get("/api/tickets", async (_req, res) => {
    try {
      const tickets = await storage.getTickets();
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.get("/api/tickets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ticket = await storage.getTicket(id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      res.json(ticket);
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  const createTicketWithProductsSchema = z.object({
    receiptNumber: z.string().optional(),
    customerName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    address: z.string().optional(),
    products: z.array(
      z.object({
        name: z.string().optional(),
        serialNumber: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        category: z.enum(["iade", "degisim", "servis"]).optional(),
        description: z.string().optional(),
        quantity: z.number().int().optional(),
        imageUrl: z.string().optional(),
        barcode: z.string().optional(),
        faultReason: z.string().optional(),
        supplierId: z.number().int().optional(),
        invoiceId: z.number().int().optional(),
        invoiceNumber: z.string().optional(),
      })
    ).optional(),
  });

  app.post("/api/tickets", async (req, res) => {
    try {
      if (!dbReady) {
        try {
          await storage.ensureSystemUser();
          dbReady = true;
        } catch {
          return res.status(503).json({ error: "Veritabanı henüz hazır değil. Lütfen birkaç saniye sonra tekrar deneyin." });
        }
      }

      const validatedData = createTicketWithProductsSchema.parse(req.body);

      const customer = await storage.findOrCreateCustomer({
        name: validatedData.customerName || "Bilinmeyen",
        phone: validatedData.phone || "-",
        email: validatedData.email || undefined,
        address: validatedData.address || undefined,
      });

      const ticket = await storage.createTicket({
        customerId: customer.id,
        receiptNumber: validatedData.receiptNumber || undefined,
      });

      const products = validatedData.products || [];
      const userId = sessionUserId(req);
      for (const productData of products) {
        let imageUrl: string | undefined;
        try {
          imageUrl = await persistProductImageUrl(productData.imageUrl);
        } catch (imageError) {
          console.error("Error persisting product image:", imageError);
          return res.status(400).json({
            error: imageError instanceof Error ? imageError.message : "Ürün görseli kaydedilemedi",
          });
        }

        let invoiceId = productData.invoiceId;
        if (!invoiceId && productData.invoiceNumber) {
          const invoice = await storage.findOrCreateInvoice({
            invoiceNumber: productData.invoiceNumber,
            customerId: customer.id,
          });
          invoiceId = invoice?.id;
        }

        const product = await storage.createProduct({
          ticketId: ticket.id,
          name: productData.name || "Bilinmeyen",
          serialNumber: productData.serialNumber || undefined,
          brand: productData.brand || "Bilinmeyen",
          model: productData.model || undefined,
          category: productData.category || "servis",
          description: productData.description || undefined,
          status: "beklemede",
          quantity: productData.quantity || 1,
          imageUrl,
          barcode: productData.barcode || undefined,
          faultReason: productData.faultReason || undefined,
          supplierId: productData.supplierId || undefined,
          invoiceId: invoiceId || undefined,
          location: "rma_depo",
        });

        await storage.createStatusHistory({
          productId: product.id,
          status: "beklemede",
          notes: "Kayıt oluşturuldu — ürün teslim alındı",
        });

        await storage.receiveProductIntoRma(product.id, userId);
      }

      const fullTicket = await storage.getTicket(ticket.id);
      res.status(201).json(fullTicket);
    } catch (error) {
      console.error("Error creating ticket:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create ticket" });
    }
  });

  app.delete("/api/tickets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ticket = await storage.getTicket(id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      await storage.deleteTicket(id);
      res.status(200).json({ message: "Ticket deleted successfully" });
    } catch (error) {
      console.error("Error deleting ticket:", error);
      res.status(500).json({ error: "Failed to delete ticket" });
    }
  });

  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  const updateProductStatusSchema = z.object({
    status: z.string().min(1),
  });

  app.patch("/api/products/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = updateProductStatusSchema.parse(req.body);

      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      await storage.updateProductStatus(id, status);

      const updatedProduct = await storage.getProduct(id);
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating product status:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update product status" });
    }
  });

  const updateProductLinksSchema = z.object({
    barcode: z.string().optional(),
    faultReason: z.string().optional(),
    warehouseId: z.number().int().nullable().optional(),
    supplierId: z.number().int().nullable().optional(),
    invoiceId: z.number().int().nullable().optional(),
    invoiceNumber: z.string().optional(),
    location: z.string().optional(),
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = updateProductLinksSchema.parse(req.body);
      const existing = await storage.getProduct(id);
      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }

      let invoiceId = data.invoiceId;
      if (data.invoiceNumber) {
        const invoice = await storage.findOrCreateInvoice({
          invoiceNumber: data.invoiceNumber,
          customerId: existing.ticket?.customerId,
        });
        invoiceId = invoice?.id ?? invoiceId;
      }

      const updated = await storage.updateProduct(id, {
        barcode: data.barcode,
        faultReason: data.faultReason,
        warehouseId: data.warehouseId === null ? undefined : data.warehouseId,
        supplierId: data.supplierId === null ? undefined : data.supplierId,
        invoiceId: invoiceId === null ? undefined : invoiceId,
        location: data.location,
      }, { userId: sessionUserId(req) });

      res.json(await storage.getProduct(updated?.id || id));
    } catch (error) {
      console.error("Error updating product:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Ürün güncellenemedi" });
    }
  });

  app.get("/api/stats/dashboard", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getStatistics();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
