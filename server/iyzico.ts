import { createHmac, randomBytes } from "crypto";
import { getPaymentConfig } from "./payment-config";

export async function isIyzicoConfigured() {
  const { iyzico } = await getPaymentConfig();
  return Boolean(iyzico.enabled && iyzico.apiKey && iyzico.secretKey);
}

async function authorization(path: string, body: string) {
  const { iyzico } = await getPaymentConfig();
  if (!iyzico.enabled || !iyzico.apiKey || !iyzico.secretKey) {
    throw new Error("iyzico canlı API anahtarları yapılandırılmamış");
  }

  const randomKey = `${Date.now()}${randomBytes(8).toString("hex")}`;
  const signature = createHmac("sha256", iyzico.secretKey)
    .update(randomKey + path + body)
    .digest("hex");
  const authString =
    `apiKey:${iyzico.apiKey}&randomKey:${randomKey}&signature:${signature}`;

  return {
    baseUrl: iyzico.baseUrl,
    headers: {
      Authorization: `IYZWSv2 ${Buffer.from(authString, "utf8").toString("base64")}`,
      "x-iyzi-rnd": randomKey,
    },
  };
}

async function iyzicoPost<T extends Record<string, any>>(
  path: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const body = JSON.stringify(payload);
  const { baseUrl, headers } = await authorization(path, body);

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


export type Iyzico3DSInitializeResponse = {
  status?: string;
  threeDSHtmlContent?: string;
  paymentId?: string;
  conversationId?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type Iyzico3DSAuthResponse = {
  status?: string;
  paymentId?: string;
  conversationId?: string;
  basketId?: string;
  paidPrice?: number | string;
  price?: number | string;
  currency?: string;
  fraudStatus?: number;
  errorCode?: string;
  errorMessage?: string;
};

export async function initializeIyzico3DS(
  payload: Record<string, unknown>,
) {
  return iyzicoPost<Iyzico3DSInitializeResponse>(
    "/payment/3dsecure/initialize",
    payload,
  );
}

export async function completeIyzico3DS(
  payload: Record<string, unknown>,
) {
  return iyzicoPost<Iyzico3DSAuthResponse>(
    "/payment/3dsecure/auth",
    payload,
  );
}
