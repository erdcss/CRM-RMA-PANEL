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
              text: "Bu belgeyi ürün listesi olarak incele. Yalnızca belgede açıkça bulunan bilgileri çıkar; tahmin etme. Her ürünü ayrı kaydet. Sayısal alanları sayı, bilinmeyen alanları null yap. category mevcutsa iade, degisim veya servis değerlerinden birini kullan; emin değilsen null bırak.",
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