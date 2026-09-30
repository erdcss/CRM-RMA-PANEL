import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCustomerSchema, insertWarehouseSchema, insertSupplierSchema, insertInvoiceSchema, insertUserSchema } from "@shared/schema";
import { saveImageDataUrl, persistProductImageUrl } from "./image-storage";
import { z } from "zod";
import OpenAI from "openai";
import { registerProductAIRoutes } from "./product-ai";
import { pool } from "./db";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { registerAdminPlatformRoutes } from "./admin-platform";

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

function sessionUserId(req: Request): number | undefined {
  return (req.session as { userId?: number }).userId;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if ((req.session as { userId?: number }).userId) {
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

async function ensureB2BAccountTables() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS b2b_addresses (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      recipient TEXT,
      phone TEXT,
      city TEXT,
      district TEXT,
      address_line TEXT NOT NULL,
      postal_code TEXT,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS b2b_addresses_user_idx ON b2b_addresses(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS b2b_payment_methods (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      brand TEXT,
      last4 TEXT,
      holder_name TEXT,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS b2b_payment_methods_user_idx ON b2b_payment_methods(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS b2b_returns (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_number TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS b2b_returns_user_idx ON b2b_returns(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS b2b_invoices (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      order_number TEXT,
      total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      download_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS b2b_invoices_user_idx ON b2b_invoices(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS b2b_support_tickets (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS b2b_support_user_idx ON b2b_support_tickets(user_id, created_at DESC);
  `);
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

export async function registerRoutes(app: Express): Promise<Server> {
  initDatabase()
    .then(() => ensureB2BAccountTables())
    .catch(err => console.error("DB/B2B account init error:", err));

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", database: dbReady ? "ready" : "starting" });
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = (req.session as { userId?: number }).userId;
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
      return res.json({
        id: adminUser.id,
        username: primaryAdminEmail,
        role: "super_admin",
        appAccess: adminUser.appAccess,
        isActive: true,
      });
    }

    if (
      localUser &&
      localUser.isActive === 1 &&
      ["super_admin", "admin"].includes(localUser.role) &&
      verifyPassword(password, localUser.password)
    ) {
      (req.session as { userId?: number }).userId = localUser.id;
      return res.json({
        id: localUser.id,
        username: isPrimaryAdminAttempt ? primaryAdminEmail : localUser.username,
        role: localUser.role,
        appAccess: localUser.appAccess,
        isActive: true,
      });
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
            return res.json({
              id: adminUser.id,
              username: primaryAdminEmail || primaryAdminAuthEmail,
              role: "super_admin",
              appAccess: adminUser.appAccess,
              isActive: true,
            });
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

      return res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        appAccess: user.appAccess,
        isActive: true,
        mustChangePassword: true,
      });
    }

    return res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      appAccess: user.appAccess,
      isActive: true,
      mustChangePassword: false,
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

  app.get("/api/b2b/products", async (_req, res) => {
    if (!pool) return res.json([]);

    try {
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
          collection_name
        FROM b2b_products
        WHERE is_active IS DISTINCT FROM FALSE
        ORDER BY created_at DESC
      `);
      return res.json(result.rows);
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

      return res.json(result.rows[0]);
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
      `SELECT id, order_number, customer_email, status, item_count, total_amount, created_at
       FROM b2b_orders
       WHERE LOWER(COALESCE(customer_email, '')) = $1
       ORDER BY created_at DESC`,
      [email],
    );
    return res.json(result.rows);
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
