import type { Express, RequestHandler } from "express";
import { createHash } from "crypto";
import OpenAI, { toFile } from "openai";
import { z } from "zod";

const supportedExtractTypes = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const supportedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxDocumentBytes = 10 * 1024 * 1024;
const maxImageBytes = 8 * 1024 * 1024;

const productSchema = z.object({
  name: z.string().nullable(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  purchasePrice: z.number().nullable(),
  salePrice: z.number().nullable(),
  vatRate: z.number().nullable(),
  stock: z.number().int().nullable(),
  unitsPerBox: z.number().int().nullable(),
  minimumOrderQuantity: z.number().int().nullable(),
  color: z.string().nullable(),
  size: z.string().nullable(),
  variant: z.string().nullable(),
  label: z.string().nullable(),
  otherProperties: z.array(z.object({ key: z.string(), value: z.string() })),
});

const productListSchema = z.object({ products: z.array(productSchema).max(500) });

const imageSearchInputSchema = z.object({
  attempt: z.number().int().min(0).max(1).optional().default(0),
  products: z.array(
    z.object({
      key: z.string().min(1).max(120),
      sku: z.string().max(160).optional().default(""),
      barcode: z.string().max(160).optional().default(""),
      name: z.string().max(500).optional().default(""),
      brand: z.string().max(240).optional().default(""),
      category: z.string().max(240).optional().default(""),
      description: z.string().max(1600).optional().default(""),
      attributes: z.string().max(800).optional().default(""),
    }),
  ).min(1).max(40),
});

const imageCandidateSchema = z.object({
  imageUrl: z.string().nullable(),
  pageUrl: z.string().nullable(),
  sourceTitle: z.string().nullable(),
  searchConfidence: z.number().min(0).max(1),
});

const imageSearchOutputSchema = z.object({
  matches: z.array(
    z.object({
      key: z.string(),
      candidates: z.array(imageCandidateSchema).max(2),
    }),
  ).max(40),
});

const imageSearchJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    matches: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string" },
          candidates: {
            type: "array",
            maxItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                imageUrl: { type: ["string", "null"] },
                pageUrl: { type: ["string", "null"] },
                sourceTitle: { type: ["string", "null"] },
                searchConfidence: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["imageUrl", "pageUrl", "sourceTitle", "searchConfidence"],
            },
          },
        },
        required: ["key", "candidates"],
      },
    },
  },
  required: ["matches"],
} as const;

const imageValidationOutputSchema = z.object({
  selectedIndex: z.number().int().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  status: z.enum(["accepted", "review", "rejected"]),
  reason: z.string().max(700),
  matchedAttributes: z.array(z.string()).max(8),
  conflicts: z.array(z.string()).max(8),
});

const imageValidationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    selectedIndex: { type: "integer", minimum: -1, maximum: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    status: { type: "string", enum: ["accepted", "review", "rejected"] },
    reason: { type: "string" },
    matchedAttributes: {
      type: "array",
      maxItems: 8,
      items: { type: "string" },
    },
    conflicts: {
      type: "array",
      maxItems: 8,
      items: { type: "string" },
    },
  },
  required: [
    "selectedIndex",
    "confidence",
    "status",
    "reason",
    "matchedAttributes",
    "conflicts",
  ],
} as const;

type ImageSearchProduct = z.infer<typeof imageSearchInputSchema>["products"][number];
type ProductPageEvidence = {
  imageUrl: string | null;
  title: string;
  description: string;
  sku: string;
  barcode: string;
  brand: string;
  name: string;
  searchableText: string;
};

type ResolvedImageCandidate = z.infer<typeof imageCandidateSchema> & {
  resolvedImageUrl: string;
  evidence: ProductPageEvidence | null;
  evidenceScore: number;
  exactBarcode: boolean;
  exactSku: boolean;
  brandMatch: boolean;
  nameOverlap: number;
};

type ImageMatchResult = {
  key: string;
  imageData: string | null;
  sourceUrl: string | null;
  confidence: number;
  status: "verified" | "review" | "not_found";
  reason: string;
};

const imageMatchCache = new Map<string, { expiresAt: number; value: ImageMatchResult }>();
const IMAGE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_IMAGE_CACHE_ENTRIES = 800;

type ExtractCacheValue = {
  products: z.infer<typeof productSchema>[];
  model: string;
};

const productExtractCache = new Map<
  string,
  { expiresAt: number; value: ExtractCacheValue }
>();
const EXTRACT_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_EXTRACT_CACHE_ENTRIES = 80;

function extractCacheKey(buffer: Buffer, mime: string) {
  return createHash("sha256")
    .update(mime)
    .update(buffer)
    .digest("hex");
}

function getCachedExtraction(key: string) {
  const cached = productExtractCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    productExtractCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedExtraction(key: string, value: ExtractCacheValue) {
  if (productExtractCache.size >= MAX_EXTRACT_CACHE_ENTRIES) {
    const firstKey = productExtractCache.keys().next().value;
    if (firstKey) productExtractCache.delete(firstKey);
  }
  productExtractCache.set(key, {
    expiresAt: Date.now() + EXTRACT_CACHE_TTL_MS,
    value,
  });
}

const productJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    products: {
      type: "array",
      maxItems: 500,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: ["string", "null"] },
          sku: { type: ["string", "null"] },
          barcode: { type: ["string", "null"] },
          brand: { type: ["string", "null"] },
          category: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          purchasePrice: { type: ["number", "null"] },
          salePrice: { type: ["number", "null"] },
          vatRate: { type: ["number", "null"] },
          stock: { type: ["integer", "null"] },
          unitsPerBox: { type: ["integer", "null"] },
          minimumOrderQuantity: { type: ["integer", "null"] },
          color: { type: ["string", "null"] },
          size: { type: ["string", "null"] },
          variant: { type: ["string", "null"] },
          label: { type: ["string", "null"] },
          otherProperties: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                key: { type: "string" },
                value: { type: "string" },
              },
              required: ["key", "value"],
            },
          },
        },
        required: [
          "name", "sku", "barcode", "brand", "category", "description",
          "purchasePrice", "salePrice", "vatRate", "stock", "unitsPerBox",
          "minimumOrderQuantity", "color", "size", "variant", "label", "otherProperties",
        ],
      },
    },
  },
  required: ["products"],
} as const;

function parseDataUrl(dataUrl: unknown, mime: unknown, maxBytes: number) {
  if (typeof dataUrl !== "string" || typeof mime !== "string") {
    throw new ProductAiInputError("Belge verisi veya MIME türü eksik.", 400);
  }
  if (!dataUrl.startsWith(`data:${mime};base64,`)) {
    throw new ProductAiInputError("Belge verisi geçerli bir base64 data URL olmalıdır.", 400);
  }
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  if (!base64 || !/^[A-Za-z0-9+/=\s]+$/.test(base64)) {
    throw new ProductAiInputError("Belge verisi geçersiz.", 400);
  }
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > maxBytes) {
    throw new ProductAiInputError(`Dosya boyutu en fazla ${Math.floor(maxBytes / 1024 / 1024)} MB olabilir.`, 413);
  }
  return buffer;
}

class ProductAiInputError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function isPublicHttpUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return false;

    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function htmlEntityDecode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function imageFromHtml(html: string, pageUrl: string) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    try {
      return new URL(htmlEntityDecode(match[1]), pageUrl).toString();
    } catch {
      continue;
    }
  }

  const jsonLdImages = [
    /"image"\s*:\s*"([^"]+)"/i,
    /"image"\s*:\s*\[\s*"([^"]+)"/i,
    /"contentUrl"\s*:\s*"([^"]+)"/i,
  ];
  for (const pattern of jsonLdImages) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    try {
      return new URL(htmlEntityDecode(match[1].replace(/\\\//g, "/")), pageUrl).toString();
    } catch {
      continue;
    }
  }

  return null;
}

function firstMatch(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return htmlEntityDecode(match[1]).trim();
  }
  return "";
}

function normalizeMatchText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactIdentifier(value: unknown) {
  return normalizeMatchText(value).replace(/\s+/g, "");
}

function nameTokenOverlap(productName: string, evidenceText: string) {
  const ignored = new Set([
    "ve", "ile", "icin", "adet", "urun", "yeni", "model", "the", "and",
  ]);
  const tokens = normalizeMatchText(productName)
    .split(" ")
    .filter((token) => token.length >= 3 && !ignored.has(token));
  if (!tokens.length) return 0;
  const haystack = ` ${normalizeMatchText(evidenceText)} `;
  const matched = tokens.filter((token) => haystack.includes(` ${token} `)).length;
  return matched / tokens.length;
}

async function fetchProductPageEvidence(pageUrl: string): Promise<ProductPageEvidence | null> {
  if (!isPublicHttpUrl(pageUrl)) return null;

  try {
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CaliskanB2BProductImageBot/2.0; +https://b2b.ecalisgan.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;

    const html = (await response.text()).slice(0, 1_200_000);
    const finalUrl = response.url || pageUrl;
    const image = imageFromHtml(html, finalUrl);
    const title = firstMatch(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ]);
    const description = firstMatch(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    ]);
    const sku = firstMatch(html, [
      /"sku"\s*:\s*"([^"]+)"/i,
      /itemprop=["']sku["'][^>]+content=["']([^"']+)["']/i,
    ]);
    const barcode = firstMatch(html, [
      /"gtin(?:8|12|13|14)?"\s*:\s*"([^"]+)"/i,
      /"barcode"\s*:\s*"([^"]+)"/i,
      /itemprop=["']gtin(?:8|12|13|14)?["'][^>]+content=["']([^"']+)["']/i,
    ]);
    const brand = firstMatch(html, [
      /"brand"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i,
      /"brand"\s*:\s*"([^"]+)"/i,
    ]);
    const name = firstMatch(html, [
      /"@type"\s*:\s*"Product"[\s\S]{0,2500}?"name"\s*:\s*"([^"]+)"/i,
      /"name"\s*:\s*"([^"]+)"/i,
    ]);

    const visibleText = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 180_000);

    return {
      imageUrl: image && isPublicHttpUrl(image) ? image : null,
      title,
      description,
      sku,
      barcode,
      brand,
      name,
      searchableText: [
        finalUrl,
        title,
        description,
        sku,
        barcode,
        brand,
        name,
        visibleText,
      ].join(" "),
    };
  } catch {
    return null;
  }
}

async function fetchProductPageImage(pageUrl: string) {
  return (await fetchProductPageEvidence(pageUrl))?.imageUrl || null;
}

async function downloadImageAsDataUrl(imageUrl: string) {
  if (!isPublicHttpUrl(imageUrl)) return null;

  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CaliskanB2BProductImageBot/1.0; +https://b2b.ecalisgan.com)",
        Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(contentType)) return null;

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 5 * 1024 * 1024) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) return null;

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function imageCacheKey(product: ImageSearchProduct) {
  return [
    product.barcode,
    product.sku,
    product.brand,
    product.name,
    product.category,
    product.description,
    product.attributes,
  ]
    .map((value) => String(value || "").trim().toLocaleLowerCase("tr-TR"))
    .join("|")
    .replace(/^/, "v3|");
}

function getCachedImageMatch(product: ImageSearchProduct) {
  const key = imageCacheKey(product);
  const cached = imageMatchCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    imageMatchCache.delete(key);
    return null;
  }
  return { ...cached.value, key: product.key };
}

function setCachedImageMatch(product: ImageSearchProduct, value: ImageMatchResult) {
  // Retryable/non-matching results must not poison later automatic attempts.
  if (value.status !== "verified" || !value.imageData) return;

  if (imageMatchCache.size >= MAX_IMAGE_CACHE_ENTRIES) {
    const firstKey = imageMatchCache.keys().next().value;
    if (firstKey) imageMatchCache.delete(firstKey);
  }
  imageMatchCache.set(imageCacheKey(product), {
    expiresAt: Date.now() + IMAGE_CACHE_TTL_MS,
    value: { ...value, key: "" },
  });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, limit), items.length) },
      () => runner(),
    ),
  );
  return results;
}

async function webSearchImageMatches(
  openai: OpenAI,
  products: ImageSearchProduct[],
  attempt = 0,
) {
  const response = await openai.responses.create({
    model:
      process.env.OPENAI_WEB_SEARCH_MODEL ||
      process.env.OPENAI_PRODUCT_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-4o-mini",
    tools: [{ type: "web_search" } as any],
    max_output_tokens: 2200,
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text:
          "Aşağıdaki ürünler için webde ürün görseli araştır. Her ürün için EN FAZLA 2 aday ver. " +
          (attempt === 0
            ? "İlk arama: barkod tam eşleşmesi; yoksa stok/model kodu + marka kullan. "
            : "İkinci ve son arama: tam ürün adı + marka + kategori kullan; açıklamadaki ayırt edici özelliklerle destekle. ") +
          "Açıklamadaki renk, model, ölçü, cinsiyet, paket/adet ve varyantla çelişen sonucu verme. " +
          "Üretici, distribütör veya gerçek ürün sayfasını tercih et. Reklam, kategori görseli, logo ve kolaj verme. " +
          "imageUrl gerçek doğrudan ürün görseliyse yaz; emin değilsen null yap ve pageUrl ver. " +
          "Kısa yanıt ver; kaynak başlığını 100 karakteri geçirme.\n\n" +
          JSON.stringify(products),
      }],
    }],
    text: {
      format: {
        type: "json_schema",
        name: "product_image_candidates",
        strict: true,
        schema: imageSearchJsonSchema,
      },
    },
  } as any);

  return imageSearchOutputSchema.parse(
    JSON.parse(cleanOutputText(response.output_text)),
  ).matches;
}

async function webSearchSingleProduct(
  openai: OpenAI,
  product: ImageSearchProduct,
  attempt = 0,
) {
  try {
    const result = await webSearchImageMatches(openai, [product], attempt);
    return result[0]?.candidates || [];
  } catch (error) {
    console.warn(
      "Single product web image search failed:",
      product.sku || product.barcode || product.name,
      error instanceof Error ? error.message : "unknown error",
    );
    return [];
  }
}

function scoreCandidateEvidence(
  product: ImageSearchProduct,
  candidate: z.infer<typeof imageCandidateSchema>,
  evidence: ProductPageEvidence | null,
) {
  const text = evidence?.searchableText || [
    candidate.sourceTitle,
    candidate.pageUrl,
  ].join(" ");

  const normalizedText = compactIdentifier(text);
  const barcode = compactIdentifier(product.barcode);
  const sku = compactIdentifier(product.sku);
  const brand = normalizeMatchText(product.brand);
  const evidenceBrand = normalizeMatchText(
    [evidence?.brand, evidence?.title, evidence?.description].join(" "),
  );

  const exactBarcode =
    barcode.length >= 8 &&
    normalizedText.includes(barcode);
  const exactSku =
    sku.length >= 4 &&
    normalizedText.includes(sku);
  const brandMatch =
    brand.length >= 2 &&
    evidenceBrand.includes(brand);
  const overlap = nameTokenOverlap(
    product.name,
    [evidence?.name, evidence?.title, evidence?.description, text].join(" "),
  );

  let score = candidate.searchConfidence * 0.15;
  if (exactBarcode) score += 0.62;
  if (exactSku) score += 0.36;
  if (brandMatch) score += 0.1;
  score += Math.min(0.22, overlap * 0.22);

  return {
    score: Math.min(1, Math.round(score * 100) / 100),
    exactBarcode,
    exactSku,
    brandMatch,
    nameOverlap: overlap,
  };
}

async function resolveImageCandidates(
  product: ImageSearchProduct,
  candidates: z.infer<typeof imageCandidateSchema>[],
) {
  const resolved = await Promise.all(
    candidates.slice(0, 2).map(async (candidate) => {
      const evidence =
        candidate.pageUrl && isPublicHttpUrl(candidate.pageUrl)
          ? await fetchProductPageEvidence(candidate.pageUrl)
          : null;

      const resolvedImageUrl =
        candidate.imageUrl && isPublicHttpUrl(candidate.imageUrl)
          ? candidate.imageUrl
          : evidence?.imageUrl || null;

      if (!resolvedImageUrl || !isPublicHttpUrl(resolvedImageUrl)) return null;

      const scored = scoreCandidateEvidence(product, candidate, evidence);
      return {
        ...candidate,
        resolvedImageUrl,
        evidence,
        evidenceScore: scored.score,
        exactBarcode: scored.exactBarcode,
        exactSku: scored.exactSku,
        brandMatch: scored.brandMatch,
        nameOverlap: scored.nameOverlap,
      } satisfies ResolvedImageCandidate;
    }),
  );

  return resolved
    .filter((candidate): candidate is ResolvedImageCandidate => Boolean(candidate))
    .sort((a, b) => b.evidenceScore - a.evidenceScore);
}

async function validateImageCandidates(
  openai: OpenAI,
  product: ImageSearchProduct,
  candidates: ResolvedImageCandidate[],
) {
  if (!candidates.length) {
    return imageValidationOutputSchema.parse({
      selectedIndex: -1,
      confidence: 0,
      status: "rejected",
      reason: "Görsel adayı bulunamadı.",
      matchedAttributes: [],
      conflicts: [],
    });
  }

  const candidateText = candidates.map((candidate, index) => ({
    index,
    sourceTitle: candidate.sourceTitle,
    pageUrl: candidate.pageUrl,
    searchConfidence: candidate.searchConfidence,
    evidenceScore: candidate.evidenceScore,
    pageTitle: candidate.evidence?.title || "",
    pageDescription: candidate.evidence?.description || "",
    pageSku: candidate.evidence?.sku || "",
    pageBarcode: candidate.evidence?.barcode || "",
    pageBrand: candidate.evidence?.brand || "",
    exactBarcode: candidate.exactBarcode,
    exactSku: candidate.exactSku,
    brandMatch: candidate.brandMatch,
    nameOverlap: candidate.nameOverlap,
  }));

  const content: any[] = [
    {
      type: "input_text",
      text:
        "Görevin verilen ürünle TAM AYNI ürünü gösteren görseli seçmektir. " +
        "Yakın/benzer ürün yeterli değildir. Barkod, stok/model kodu, marka, ürün adı, kategori, açıklamadaki renk, ölçü, cinsiyet, model, paket/adet ve varyant bilgilerini birlikte değerlendir. " +
        "Görselde okunabilen marka/model/yazı ürün bilgisiyle çelişiyorsa reddet. " +
        "Farklı varyant, farklı renk, farklı paket, reklam bannerı, kategori görseli veya yalnızca marka logosu reddedilmelidir. " +
        "Tam eşleşmeden emin değilsen selectedIndex=-1 ve status=review/rejected kullan. " +
        "status=accepted yalnızca çok yüksek güvenli tam ürün eşleşmesinde kullanılmalıdır.\n\n" +
        "ÜRÜN:\n" +
        JSON.stringify(product) +
        "\n\nADAY KAYNAKLAR:\n" +
        JSON.stringify(candidateText),
    },
  ];

  for (const candidate of candidates) {
    content.push({
      type: "input_image",
      image_url: candidate.resolvedImageUrl,
      detail: "low",
    });
  }

  const response = await openai.responses.create({
    model:
      process.env.OPENAI_IMAGE_VERIFY_MODEL ||
      process.env.OPENAI_PRODUCT_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-4o-mini",
    input: [{ role: "user", content }],
    text: {
      format: {
        type: "json_schema",
        name: "product_image_validation",
        strict: true,
        schema: imageValidationJsonSchema,
      },
    },
  } as any);

  return imageValidationOutputSchema.parse(
    JSON.parse(cleanOutputText(response.output_text)),
  );
}

async function processImageMatch(
  openai: OpenAI,
  product: ImageSearchProduct,
  candidates: z.infer<typeof imageCandidateSchema>[],
  attempt = 0,
): Promise<ImageMatchResult> {
  const cached = getCachedImageMatch(product);
  if (cached) return cached;

  const resolved = await resolveImageCandidates(product, candidates);
  if (!resolved.length) {
    return {
      key: product.key,
      imageData: null,
      sourceUrl: null,
      confidence: 0,
      status: "not_found",
      reason: "Uygun ürün görseli bulunamadı.",
    };
  }

  const strongest = resolved[0];

  // Fast deterministic matching: do not run a second visual AI round.
  // This makes bulk imports much faster and avoids structured-output failures.
  const directMatch =
    strongest.exactBarcode ||
    strongest.exactSku ||
    (
      strongest.brandMatch &&
      strongest.nameOverlap >= (attempt === 0 ? 0.62 : 0.48)
    ) ||
    strongest.nameOverlap >= (attempt === 0 ? 0.82 : 0.68);

  const minimumEvidence = attempt === 0 ? 0.42 : 0.28;
  const minimumSearch = attempt === 0 ? 0.54 : 0.42;

  if (
    !directMatch ||
    strongest.evidenceScore < minimumEvidence ||
    strongest.searchConfidence < minimumSearch
  ) {
    return {
      key: product.key,
      imageData: null,
      sourceUrl: null,
      confidence: Math.max(strongest.evidenceScore, strongest.searchConfidence),
      status: "not_found",
      reason: "Ürün bilgileriyle yeterli görsel eşleşmesi bulunamadı.",
    };
  }

  const imageData = await downloadImageAsDataUrl(strongest.resolvedImageUrl);
  if (!imageData) {
    return {
      key: product.key,
      imageData: null,
      sourceUrl: null,
      confidence: strongest.evidenceScore,
      status: "not_found",
      reason: "Uygun görsel bulundu ancak indirilemedi.",
    };
  }

  const confidence = Math.min(
    1,
    Math.max(
      strongest.evidenceScore,
      strongest.searchConfidence,
      strongest.exactBarcode ? 0.98 : strongest.exactSku ? 0.9 : 0,
    ),
  );

  const result: ImageMatchResult = {
    key: product.key,
    imageData,
    sourceUrl: null,
    confidence,
    status: "verified",
    reason: strongest.exactBarcode
      ? "Barkod eşleşmesiyle görsel otomatik eklendi."
      : strongest.exactSku
        ? "Stok/model kodu eşleşmesiyle görsel otomatik eklendi."
        : "Ürün adı ve marka eşleşmesiyle görsel otomatik eklendi.",
  };

  setCachedImageMatch(product, result);
  return result;
}

function cleanOutputText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Yapay zeka boş yanıt döndürdü.");
  }
  return value.trim();
}

export function registerProductAIRoutes(app: Express, requireAdmin: RequestHandler) {
  app.post("/api/product-ai/extract", requireAdmin, async (req, res) => {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "Yapay zeka servisi yapılandırılmamış." });
    }

    const mime = typeof req.body?.mime === "string" ? req.body.mime.toLowerCase() : "";
    if (!supportedExtractTypes.has(mime)) {
      return res.status(415).json({ error: "Yalnızca PDF, PNG, JPG/JPEG ve WEBP dosyaları desteklenir." });
    }

    try {
      const buffer = parseDataUrl(req.body?.dataUrl, mime, maxDocumentBytes);
      const filename = typeof req.body?.name === "string" && req.body.name.trim()
        ? req.body.name.trim().slice(0, 120)
        : `product-document.${mime === "application/pdf" ? "pdf" : "bin"}`;

      const cacheKey = extractCacheKey(buffer, mime);
      const cached = getCachedExtraction(cacheKey);
      if (cached) {
        return res.json({
          products: cached.products,
          count: cached.products.length,
          model: cached.model,
          cached: true,
        });
      }

      const model =
        process.env.OPENAI_PRODUCT_MODEL ||
        process.env.OPENAI_MODEL ||
        "gpt-4o-mini";

      // PDF/table extraction can legitimately take longer than 45 seconds.
      // Use one longer request instead of two short SDK retries, which previously
      // caused ~90 second failures even when the model was still processing.
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 115_000,
        maxRetries: 0,
      });

      const source = mime === "application/pdf"
        ? {
            type: "input_file" as const,
            filename,
            file_data: `data:${mime};base64,${buffer.toString("base64")}`,
          }
        : {
            type: "input_image" as const,
            image_url: `data:${mime};base64,${buffer.toString("base64")}`,
            detail: "high" as const,
          };

      const response = await openai.responses.create({
        model,
        max_output_tokens: 16000,
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Bu belgeyi bir B2B ürün kataloğu veya fiyat listesi olarak incele. " +
                "Yalnızca belgede açıkça bulunan bilgileri çıkar; tahmin etme. " +
                "Her ürünü ayrı kaydet. Sayısal alanları sayı, bilinmeyen alanları null yap. " +
                "category alanına belgede geçen gerçek ürün kategorisini yaz; kategori belirtilmiyorsa null bırak. " +
                "Stok kodu, barkod, marka, ürün adı, satın alma/satış fiyatı, stok, koli içi adet ve minimum sipariş alanlarını özellikle ayır. " +
                "Tabloda aynı satıra ait bilgileri başka satırlarla karıştırma. Barkod ve stok kodlarını metin olarak eksiksiz koru.",
            },
            source,
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "product_list",
            strict: true,
            schema: productJsonSchema,
          },
        },
      } as any);

      const parsed = productListSchema.parse(
        JSON.parse(cleanOutputText(response.output_text)),
      );

      setCachedExtraction(cacheKey, {
        products: parsed.products,
        model,
      });

      return res.json({
        products: parsed.products,
        count: parsed.products.length,
        model,
        cached: false,
      });
    } catch (error) {
      if (error instanceof ProductAiInputError) {
        return res.status(error.status).json({ error: error.message });
      }

      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        console.error("Product AI structured output validation failed:", error.message);
        return res.status(502).json({
          error: "AI ürün tablosunu eksiksiz oluşturamadı. Dosyayı yeniden analiz edin.",
          retryable: true,
        });
      }

      const message = error instanceof Error ? error.message : "unknown error";
      console.error("Product AI extract error:", message);

      if (/timed out|timeout/i.test(message)) {
        return res.status(504).json({
          error: "AI belge analizi zaman aşımına uğradı. Aynı dosyayı tekrar deneyin; başarılı sonuçlar önbelleğe alınır.",
          retryable: true,
        });
      }

      return res.status(502).json({
        error: "Belge analiz edilemedi. Lütfen tekrar deneyin.",
        retryable: true,
      });
    }
  });

  app.post("/api/product-ai/find-images", requireAdmin, async (req, res) => {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "Yapay zeka servisi yapılandırılmamış." });
    }

    try {
      const parsed = imageSearchInputSchema.parse(req.body);
      const attempt = parsed.attempt;
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 45_000,
        maxRetries: 1,
      });

      const cachedResults = new Map<string, ImageMatchResult>();
      const productsToSearch: ImageSearchProduct[] = [];

      for (const product of parsed.products) {
        const cached = getCachedImageMatch(product);
        if (cached) cachedResults.set(product.key, cached);
        else productsToSearch.push(product);
      }

      const batches: ImageSearchProduct[][] = [];
      for (let index = 0; index < productsToSearch.length; index += 4) {
        batches.push(productsToSearch.slice(index, index + 4));
      }

      const candidateMap = new Map<
        string,
        z.infer<typeof imageCandidateSchema>[]
      >();
      const transientSearchFailures = new Set<string>();

      const searchedBatches = await mapWithConcurrency(
        batches,
        3,
        async (batch) => {
          try {
            return {
              batch,
              matches: await webSearchImageMatches(openai, batch, attempt),
              usedFallback: false,
            };
          } catch (batchError) {
            console.warn(
              "Batch product image search returned invalid/truncated output; falling back to single-product searches:",
              batchError instanceof Error ? batchError.message : "unknown error",
            );

            const singles = await mapWithConcurrency(
              batch,
              4,
              async (product) => ({
                key: product.key,
                candidates: await webSearchSingleProduct(openai, product, attempt),
              }),
            );

            return {
              batch,
              matches: singles,
              usedFallback: true,
            };
          }
        },
      );

      for (const group of searchedBatches) {
        const matchesByKey = new Map(
          group.matches.map((match) => [match.key, match.candidates]),
        );
        for (const product of group.batch) {
          const candidates = matchesByKey.get(product.key) || [];
          candidateMap.set(product.key, candidates);
          if (group.usedFallback && candidates.length === 0) {
            transientSearchFailures.add(product.key);
          }
        }
      }

      const processed = await mapWithConcurrency(
        productsToSearch,
        5,
        async (product) => {
          if (transientSearchFailures.has(product.key)) {
            return {
              key: product.key,
              imageData: null,
              sourceUrl: null,
              confidence: 0,
              status: "review" as const,
              reason: "Web araması geçici olarak tamamlanamadı; otomatik tekrar denenebilir.",
            };
          }

          return processImageMatch(
            openai,
            product,
            candidateMap.get(product.key) || [],
            attempt,
          );
        },
      );

      const processedMap = new Map(processed.map((item) => [item.key, item]));
      const finalMatches = parsed.products.map(
        (product) =>
          cachedResults.get(product.key) ||
          processedMap.get(product.key) || {
            key: product.key,
            imageData: null,
            sourceUrl: null,
            confidence: 0,
            status: "not_found" as const,
            reason: "Görsel bulunamadı.",
          },
      );

      return res.json({
        matches: finalMatches,
        found: finalMatches.filter((item) => item.status === "verified").length,
        review: finalMatches.filter((item) => item.status === "review").length,
        notFound: finalMatches.filter((item) => item.status === "not_found").length,
        count: parsed.products.length,
      });
    } catch (error) {
      console.error(
        "Product web image search failed:",
        error instanceof Error ? error.message : "unknown error",
      );

      // Automatic image enrichment must never block the product import flow.
      const products = Array.isArray(req.body?.products) ? req.body.products : [];
      return res.status(200).json({
        matches: products.map((product: any) => ({
          key: String(product?.key || ""),
          imageData: null,
          sourceUrl: null,
          confidence: 0,
          status: "review",
          reason: "Otomatik görsel taraması bu turda tamamlanamadı; arka planda tekrar denenebilir.",
        })),
        found: 0,
        review: products.length,
        notFound: 0,
        count: products.length,
        degraded: true,
      });
    }
  });

  app.post("/api/product-ai/prepare-image", requireAdmin, async (req, res) => {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "Yapay zeka servisi yapılandırılmamış." });
    }
    const mime = typeof req.body?.mime === "string" ? req.body.mime.toLowerCase() : "";
    if (!supportedImageTypes.has(mime)) {
      return res.status(415).json({ error: "Görsel hazırlama için PNG, JPG/JPEG veya WEBP gerekir." });
    }
    try {
      const buffer = parseDataUrl(req.body?.dataUrl, mime, maxImageBytes);
      const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 1 });
      const result = await openai.images.edit({
        model: "gpt-image-1",
        image: await toFile(buffer, `product-source.${extension}`, { type: mime }),
        prompt: "Preserve the product exactly. Remove the background, center the product, and place it on a clean white e-commerce background. Do not add text, logos, or new objects.",
        size: "1024x1024",
        output_format: "png",
      });
      const image = result.data?.[0]?.b64_json;
      if (!image) return res.status(502).json({ error: "Görsel servisi boş yanıt döndürdü." });
      return res.json({ imageData: `data:image/png;base64,${image}` });
    } catch (error) {
      console.error("Product AI image preparation error:", error instanceof Error ? error.message : "unknown error");
      return res.status(502).json({ error: "Ürün görseli hazırlanamadı. Görseli değiştirmeden tekrar deneyin." });
    }
  });
}