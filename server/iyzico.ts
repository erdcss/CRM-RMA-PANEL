import { createHmac, randomBytes } from "crypto";

const LIVE_BASE_URL = "https://api.iyzipay.com";

function config() {
  const apiKey = String(process.env.IYZICO_API_KEY || "").trim();
  const secretKey = String(process.env.IYZICO_SECRET_KEY || "").trim();
  const baseUrl = String(process.env.IYZICO_BASE_URL || LIVE_BASE_URL).replace(/\/$/, "");

  return { apiKey, secretKey, baseUrl };
}

export function isIyzicoConfigured() {
  const { apiKey, secretKey } = config();
  return Boolean(apiKey && secretKey);
}

function authorization(path: string, body: string) {
  const { apiKey, secretKey } = config();
  if (!apiKey || !secretKey) {
    throw new Error("iyzico canlı API anahtarları yapılandırılmamış");
  }

  const randomKey = `${Date.now()}${randomBytes(8).toString("hex")}`;
  const signature = createHmac("sha256", secretKey)
    .update(randomKey + path + body)
    .digest("hex");
  const authString =
    `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;

  return {
    Authorization: `IYZWSv2 ${Buffer.from(authString, "utf8").toString("base64")}`,
    "x-iyzi-rnd": randomKey,
  };
}

async function iyzicoPost<T extends Record<string, any>>(
  path: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const { baseUrl } = config();
  const body = JSON.stringify(payload);
  const headers = authorization(path, body);

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });

  const result = (await response.json().catch(() => ({}))) as T & {
    status?: string;
    errorCode?: string;
    errorMessage?: string;
  };

  if (!response.ok || result.status === "failure") {
    const message =
      result.errorMessage ||
      result.errorCode ||
      `iyzico isteği başarısız (HTTP ${response.status})`;
    throw new Error(message);
  }

  return result;
}

export type IyzicoCheckoutInitializeResponse = {
  status?: string;
  token?: string;
  tokenExpireTime?: number;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
  conversationId?: string;
};

export type IyzicoCheckoutRetrieveResponse = {
  status?: string;
  paymentStatus?: "SUCCESS" | "FAILURE" | string;
  paymentId?: string;
  token?: string;
  conversationId?: string;
  basketId?: string;
  paidPrice?: number | string;
  price?: number | string;
  currency?: string;
  cardType?: string;
  cardAssociation?: string;
  lastFourDigits?: string;
};

export async function initializeIyzicoCheckout(
  payload: Record<string, unknown>,
) {
  return iyzicoPost<IyzicoCheckoutInitializeResponse>(
    "/payment/iyzipos/checkoutform/initialize/auth/ecom",
    payload,
  );
}

export async function retrieveIyzicoCheckout(token: string) {
  return iyzicoPost<IyzicoCheckoutRetrieveResponse>(
    "/payment/iyzipos/checkoutform/auth/ecom/detail",
    {
      locale: "tr",
      token,
    },
  );
}
