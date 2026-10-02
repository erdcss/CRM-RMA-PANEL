import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { pool } from "./db";

const SETTINGS_KEY = "b2b_payment_settings";
const LIVE_BASE_URL = "https://api.iyzipay.com";

type StoredPaymentSettings = {
  iyzico?: {
    enabled?: boolean;
    apiKey?: string;
    secretKey?: string;
    baseUrl?: string;
  };
  bankTransfer?: {
    enabled?: boolean;
    bankName?: string;
    accountHolder?: string;
    iban?: string;
  };
};

export type RuntimePaymentConfig = {
  iyzico: {
    enabled: boolean;
    apiKey: string;
    secretKey: string;
    baseUrl: string;
  };
  bankTransfer: {
    enabled: boolean;
    bankName: string;
    accountHolder: string;
    iban: string;
  };
};

function encryptionKey() {
  const source = String(process.env.PAYMENT_SETTINGS_ENCRYPTION_KEY || "").trim();
  if (!source) return null;
  return createHash("sha256").update(source, "utf8").digest();
}

function encryptSecret(value: string) {
  const key = encryptionKey();
  if (!key) throw new Error("PAYMENT_SETTINGS_ENCRYPTION_KEY tanımlı değil");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "enc",
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

function decryptSecret(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (!raw.startsWith("enc:v1:")) return raw;

  const key = encryptionKey();
  if (!key) return "";

  try {
    const [, , ivValue, tagValue, dataValue] = raw.split(":");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivValue, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataValue, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

function cleanIban(value: unknown) {
  return typeof value === "string"
    ? value.toUpperCase().replace(/\s+/g, "").slice(0, 34)
    : "";
}

async function storedSettings(): Promise<StoredPaymentSettings> {
  if (!pool) return {};

  const result = await pool.query(
    `SELECT value FROM platform_settings WHERE key = $1 LIMIT 1`,
    [SETTINGS_KEY],
  );
  if (!result.rows[0]) return {};

  try {
    return JSON.parse(String(result.rows[0].value || "{}"));
  } catch {
    return {};
  }
}

export async function getPaymentConfig(): Promise<RuntimePaymentConfig> {
  const stored = await storedSettings();

  const storedApiKey = decryptSecret(stored.iyzico?.apiKey);
  const storedSecretKey = decryptSecret(stored.iyzico?.secretKey);
  const apiKey = storedApiKey || String(process.env.IYZICO_API_KEY || "").trim();
  const secretKey =
    storedSecretKey || String(process.env.IYZICO_SECRET_KEY || "").trim();
  const baseUrl = String(
    stored.iyzico?.baseUrl ||
      process.env.IYZICO_BASE_URL ||
      LIVE_BASE_URL,
  )
    .trim()
    .replace(/\/$/, "");

  const bankName = String(stored.bankTransfer?.bankName || "").trim().slice(0, 120);
  const accountHolder = String(stored.bankTransfer?.accountHolder || "")
    .trim()
    .slice(0, 180);
  const iban = cleanIban(stored.bankTransfer?.iban);

  const iyzicoEnabled =
    stored.iyzico?.enabled !== undefined
      ? Boolean(stored.iyzico.enabled)
      : Boolean(apiKey && secretKey);

  return {
    iyzico: {
      enabled: iyzicoEnabled,
      apiKey,
      secretKey,
      baseUrl,
    },
    bankTransfer: {
      enabled: Boolean(
        stored.bankTransfer?.enabled && bankName && accountHolder && iban,
      ),
      bankName,
      accountHolder,
      iban,
    },
  };
}

export async function getPublicPaymentSettings() {
  const config = await getPaymentConfig();
  return {
    iyzicoConfigured: Boolean(
      config.iyzico.enabled &&
        config.iyzico.apiKey &&
        config.iyzico.secretKey,
    ),
    bankTransfer: config.bankTransfer,
  };
}

export async function getAdminPaymentSettings() {
  const config = await getPaymentConfig();
  const iyzicoConfigured = Boolean(config.iyzico.apiKey && config.iyzico.secretKey);
  return {
    iyzicoConfigured,
    iyzico: {
      enabled: config.iyzico.enabled,
      configured: iyzicoConfigured,
      apiKeyPreview: config.iyzico.apiKey
        ? `${config.iyzico.apiKey.slice(0, 6)}••••${config.iyzico.apiKey.slice(-4)}`
        : "",
      baseUrl: config.iyzico.baseUrl,
    },
    bankTransfer: config.bankTransfer,
  };
}

export async function savePaymentSettings(input: any) {
  if (!pool) throw new Error("Veritabanı bağlantısı yok");

  const current = await storedSettings();
  const iyzicoInput = input?.iyzico || {};
  const bankInput = input?.bankTransfer || {};

  const nextApiKey =
    typeof iyzicoInput.apiKey === "string" && iyzicoInput.apiKey.trim()
      ? encryptSecret(iyzicoInput.apiKey.trim())
      : current.iyzico?.apiKey || "";

  const nextSecretKey =
    typeof iyzicoInput.secretKey === "string" && iyzicoInput.secretKey.trim()
      ? encryptSecret(iyzicoInput.secretKey.trim())
      : current.iyzico?.secretKey || "";

  const baseUrl = String(
    iyzicoInput.baseUrl ||
      current.iyzico?.baseUrl ||
      process.env.IYZICO_BASE_URL ||
      LIVE_BASE_URL,
  )
    .trim()
    .replace(/\/$/, "");

  if (!/^https:\/\//i.test(baseUrl)) {
    throw new Error("iyzico API adresi https:// ile başlamalıdır");
  }

  const bankName =
    typeof bankInput.bankName === "string"
      ? bankInput.bankName.trim().slice(0, 120)
      : String(current.bankTransfer?.bankName || "").trim().slice(0, 120);
  const accountHolder =
    typeof bankInput.accountHolder === "string"
      ? bankInput.accountHolder.trim().slice(0, 180)
      : String(current.bankTransfer?.accountHolder || "").trim().slice(0, 180);
  const iban =
    bankInput.iban !== undefined
      ? cleanIban(bankInput.iban)
      : cleanIban(current.bankTransfer?.iban);
  const bankEnabled =
    bankInput.enabled !== undefined
      ? Boolean(bankInput.enabled)
      : Boolean(current.bankTransfer?.enabled);

  if (bankEnabled) {
    if (!bankName || !accountHolder || !iban) {
      throw new Error("Havale/EFT için banka adı, hesap sahibi ve IBAN zorunludur");
    }
    if (!/^TR\d{24}$/.test(iban)) {
      throw new Error("Geçerli bir Türkiye IBAN'ı girin");
    }
  }

  const iyzicoEnabled =
    iyzicoInput.enabled !== undefined
      ? Boolean(iyzicoInput.enabled)
      : current.iyzico?.enabled !== undefined
        ? Boolean(current.iyzico.enabled)
        : Boolean(
            decryptSecret(nextApiKey) ||
            String(process.env.IYZICO_API_KEY || "").trim(),
          ) &&
          Boolean(
            decryptSecret(nextSecretKey) ||
            String(process.env.IYZICO_SECRET_KEY || "").trim(),
          );
  const effectiveApiKey =
    decryptSecret(nextApiKey) || String(process.env.IYZICO_API_KEY || "").trim();
  const effectiveSecretKey =
    decryptSecret(nextSecretKey) || String(process.env.IYZICO_SECRET_KEY || "").trim();

  if (iyzicoEnabled && (!effectiveApiKey || !effectiveSecretKey)) {
    throw new Error("Canlı iyzico için API Key ve Secret Key zorunludur");
  }

  const next: StoredPaymentSettings = {
    iyzico: {
      enabled: iyzicoEnabled,
      apiKey: nextApiKey,
      secretKey: nextSecretKey,
      baseUrl,
    },
    bankTransfer: {
      enabled: bankEnabled,
      bankName,
      accountHolder,
      iban,
    },
  };

  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [SETTINGS_KEY, JSON.stringify(next)],
  );

  return getAdminPaymentSettings();
}
