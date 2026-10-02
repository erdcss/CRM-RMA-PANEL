import type { Express, RequestHandler } from "express";
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
  products: z.array(
    z.object({
      key: z.string().min(1).max(120),
      sku: z.string().max(160).optional().default(""),
      barcode: z.string().max(160).optional().default(""),
      name: z.string().max(500).optional().default(""),
      brand: z.string().max(240).optional().default(""),
    }),
  ).min(1).max(40),
});

const imageSearchOutputSchema = z.object({
  matches: z.array(
    z.object({
      key: z.string(),
      imageUrl: z.string().nullable(),
      pageUrl: z.string().nullable(),
      confidence: z.number().min(0).max(1),
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
          imageUrl: { type: ["string", "null"] },
          pageUrl: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["key", "imageUrl", "pageUrl", "confidence"],
      },
    },
  },
  required: ["matches"],
} as const;

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

async function fetchProductPageImage(pageUrl: string) {
  if (!isPublicHttpUrl(pageUrl)) return null;

  try {
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CaliskanB2BProductImageBot/1.0; +https://b2b.ecalisgan.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;

    const html = (await response.text()).slice(0, 1_500_000);
    const candidate = imageFromHtml(html, response.url || pageUrl);
    return candidate && isPublicHttpUrl(candidate) ? candidate : null;
  } catch {
    return null;
  }
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

async function webSearchImageMatches(
  openai: OpenAI,
  products: z.infer<typeof imageSearchInputSchema>["products"],
) {
  const response = await openai.responses.create({
    model:
      process.env.OPENAI_WEB_SEARCH_MODEL ||
      process.env.OPENAI_PRODUCT_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-4o-mini",
    tools: [{ type: "web_search" } as any],
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text:
          "Aşağıdaki ürünler için webde arama yap. Özellikle barkod, stok kodu, marka ve ürün adını birlikte kullan. " +
          "Yalnızca aynı ürün olduğundan güçlü şekilde emin olduğun eşleşmeleri döndür. " +
          "Üretici, distribütör veya güvenilir perakendeci ürün sayfasını tercih et. " +
          "Mümkünse doğrudan ürün görseli URL'sini imageUrl alanına; bunu doğrulayamıyorsan imageUrl=null ve ürün sayfasını pageUrl alanına yaz. " +
          "Benzer fakat farklı model/ürün için görsel seçme. Emin değilsen her iki URL'yi de null yap.\n\n" +
          JSON.stringify(products),
      }],
    }],
    text: {
      format: {
        type: "json_schema",
        name: "product_image_matches",
        strict: true,
        schema: imageSearchJsonSchema,
      },
    },
  } as any);

  return imageSearchOutputSchema.parse(
    JSON.parse(cleanOutputText(response.output_text)),
  ).matches;
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
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 });
      const source = mime === "application/pdf"
        ? { type: "input_file" as const, filename, file_data: `data:${mime};base64,${buffer.toString("base64")}` }
        : { type: "input_image" as const, image_url: `data:${mime};base64,${buffer.toString("base64")}`, detail: "high" as const };
      const response = await openai.responses.create({
        model: process.env.OPENAI_PRODUCT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Bu belgeyi bir B2B ürün kataloğu veya fiyat listesi olarak incele. Yalnızca belgede açıkça bulunan bilgileri çıkar; tahmin etme. Her ürünü ayrı kaydet. Sayısal alanları sayı, bilinmeyen alanları null yap. category alanına belgede geçen gerçek ürün kategorisini yaz; kategori belirtilmiyorsa null bırak. Stok kodu, barkod, marka, ürün adı, satış fiyatı, stok, koli içi adet ve minimum sipariş gibi alanları özellikle ayır.",
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
      });
      const parsed = productListSchema.parse(JSON.parse(cleanOutputText(response.output_text)));
      return res.json({ products: parsed.products, count: parsed.products.length, model: process.env.OPENAI_PRODUCT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini" });
    } catch (error) {
      if (error instanceof ProductAiInputError) return res.status(error.status).json({ error: error.message });
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        console.error("Product AI structured output validation failed:", error.message);
        return res.status(502).json({ error: "Yapay zeka geçerli ürün verisi döndürmedi." });
      }
      console.error("Product AI extract error:", error instanceof Error ? error.message : "unknown error");
      return res.status(502).json({ error: "Belge analiz edilemedi. Lütfen tekrar deneyin." });
    }
  });

  app.post("/api/product-ai/find-images", requireAdmin, async (req, res) => {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "Yapay zeka servisi yapılandırılmamış." });
    }

    try {
      const parsed = imageSearchInputSchema.parse(req.body);
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 60_000,
        maxRetries: 1,
      });

      const finalMatches: Array<{
        key: string;
        imageData: string | null;
        sourceUrl: string | null;
        confidence: number;
      }> = [];

      for (let index = 0; index < parsed.products.length; index += 8) {
        const batch = parsed.products.slice(index, index + 8);
        const matches = await webSearchImageMatches(openai, batch);
        const byKey = new Map(matches.map((match) => [match.key, match]));

        for (const product of batch) {
          const match = byKey.get(product.key);
          if (!match || match.confidence < 0.72) {
            finalMatches.push({
              key: product.key,
              imageData: null,
              sourceUrl: null,
              confidence: match?.confidence || 0,
            });
            continue;
          }

          let imageUrl =
            match.imageUrl && isPublicHttpUrl(match.imageUrl)
              ? match.imageUrl
              : null;

          if (!imageUrl && match.pageUrl && isPublicHttpUrl(match.pageUrl)) {
            imageUrl = await fetchProductPageImage(match.pageUrl);
          }

          let imageData = imageUrl
            ? await downloadImageAsDataUrl(imageUrl)
            : null;

          if (!imageData && match.pageUrl && isPublicHttpUrl(match.pageUrl)) {
            const fallbackImage = await fetchProductPageImage(match.pageUrl);
            if (fallbackImage && fallbackImage !== imageUrl) {
              imageUrl = fallbackImage;
              imageData = await downloadImageAsDataUrl(fallbackImage);
            }
          }

          finalMatches.push({
            key: product.key,
            imageData,
            sourceUrl: imageData
              ? match.pageUrl || imageUrl
              : null,
            confidence: match.confidence,
          });
        }
      }

      const found = finalMatches.filter((item) => item.imageData).length;
      return res.json({
        matches: finalMatches,
        found,
        count: parsed.products.length,
      });
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        console.error("Product web image search validation failed:", error.message);
        return res.status(502).json({ error: "Web görsel araması geçerli sonuç döndürmedi." });
      }
      console.error(
        "Product web image search failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      return res.status(502).json({
        error: "Ürün görselleri webde aranamadı. Manuel görsel eklemeye devam edebilirsiniz.",
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