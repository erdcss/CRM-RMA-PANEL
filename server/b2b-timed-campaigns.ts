import type { Express, RequestHandler } from "express";
import { pool } from "./db";

// A single campaign price source is shared by the catalog, product detail and checkout.
// The timed offer only wins when it is cheaper than the product's existing effective price.
export const B2B_TIMED_CAMPAIGN_JOIN = `
LEFT JOIN LATERAL (
  SELECT c.id, c.title, c.ends_at, ci.promo_price
  FROM b2b_timed_campaign_items ci
  JOIN b2b_timed_campaigns c ON c.id = ci.campaign_id
  WHERE ci.product_id = p.id
    AND c.is_active = TRUE
    AND c.starts_at <= NOW()
    AND c.ends_at > NOW()
    AND ci.promo_price > 0
    AND ci.promo_price < COALESCE(
      CASE WHEN p.campaign_price > 0 AND p.campaign_price < p.price
        THEN p.campaign_price END, p.price
    )
  ORDER BY ci.promo_price ASC, c.ends_at ASC, c.id ASC
  LIMIT 1
) timed ON TRUE`;
export const B2B_EFFECTIVE_PRICE_SQL =
  "COALESCE(timed.promo_price, CASE WHEN p.campaign_price > 0 AND p.campaign_price < p.price THEN p.campaign_price ELSE p.price END)";
export const B2B_ORIGINAL_PRICE_SQL =
  "CASE WHEN timed.promo_price IS NOT NULL THEN p.price WHEN p.campaign_price > 0 AND p.campaign_price < p.price THEN p.price ELSE NULL END";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS b2b_timed_campaigns (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT b2b_timed_campaign_date_check CHECK (ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS b2b_timed_campaign_items (
  campaign_id BIGINT NOT NULL REFERENCES b2b_timed_campaigns(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES b2b_products(id) ON DELETE CASCADE,
  promo_price NUMERIC(14,2) NOT NULL CHECK (promo_price > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id,product_id)
);
CREATE INDEX IF NOT EXISTS b2b_timed_campaign_period_idx
  ON b2b_timed_campaigns (is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS b2b_timed_campaign_product_idx
  ON b2b_timed_campaign_items (product_id);
`;
let schemaPromise: Promise<void> | null = null;
export function ensureB2BTimedCampaignSchema(): Promise<void> {
  if (!pool) return Promise.resolve();
  if (!schemaPromise) {
    schemaPromise = pool.query(SCHEMA).then(() => {}).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}
type CampaignItemInput = { productId: string; promoPrice: number };

function parseBody(body: any): { title: string; startsAt: Date; endsAt: Date; isActive: boolean; items: CampaignItemInput[] } {
  const title = String(body?.title || "").trim();
  if (title.length < 3 || title.length > 120) throw new Error("Kampanya adı 3–120 karakter olmalı");
  const startsAt = new Date(body?.startsAt);
  const endsAt = new Date(body?.endsAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()))
    throw new Error("Başlangıç ve bitiş tarihini belirleyin");
  if (endsAt.getTime() <= startsAt.getTime()) throw new Error("Bitiş tarihi başlangıçtan sonra olmalı");
  if (endsAt.getTime() - startsAt.getTime() > 180 * 86_400_000)
    throw new Error("Kampanya süresi en fazla 180 gün olabilir");
  const isActive = body?.isActive === true;
  if (isActive && endsAt.getTime() <= Date.now())
    throw new Error("Süresi dolmuş kampanya yayınlanamaz");
  const values = body?.items;
  if (!Array.isArray(values) || values.length < 1 || values.length > 60)
    throw new Error("Kampanyaya 1–60 ürün ekleyin");
  const seen = new Set<string>();
  const items = values.map((item: any) => {
    const productId = String(item?.productId ?? "").trim();
    const price = Number(item?.promoPrice);
    if (!/^[1-9]\d*$/.test(productId) || !Number.isSafeInteger(Number(productId)))
      throw new Error("Geçersiz ürün seçimi");
    if (seen.has(productId)) throw new Error("Bir ürün aynı kampanyada iki kez olamaz");
    seen.add(productId);
    if (!Number.isFinite(price) || price <= 0 || Math.round(price * 100) / 100 !== price)
      throw new Error("İndirimli fiyat pozitif ve en fazla iki ondalıklı olmalı");
    return { productId, promoPrice: price };
  });
  return { title, startsAt, endsAt, isActive, items };
}

export async function registerB2BTimedCampaignRoutes(app: Express, requireAdmin: RequestHandler) {
  await ensureB2BTimedCampaignSchema().catch(error => {
    console.error("Timed campaign schema initialization failed:", error);
  });

  app.get("/api/admin/timed-campaigns", requireAdmin, async (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    try {
      await ensureB2BTimedCampaignSchema();
      const campaigns = await pool.query(`
        SELECT id::text AS id,title,starts_at,ends_at,is_active,created_at,updated_at
        FROM b2b_timed_campaigns ORDER BY created_at DESC LIMIT 250
      `);
      const ids = campaigns.rows.map(c => c.id);
      const items = ids.length ? await pool.query(`
        SELECT ci.campaign_id::text AS campaign_id,ci.product_id::text AS product_id,
          ci.promo_price,ci.sort_order,p.name,p.sku,p.price,p.campaign_price,
          p.stock,p.units_per_box,p.min_order_qty,p.is_active AS product_active,
          CASE WHEN p.image_data LIKE 'data:image/%' THEN
            '/api/b2b/product-image/' || p.id::text || '?v=' ||
            EXTRACT(EPOCH FROM p.updated_at)::bigint::text
          ELSE p.image_data END AS image_url
        FROM b2b_timed_campaign_items ci
        JOIN b2b_products p ON p.id=ci.product_id
        WHERE ci.campaign_id::text = ANY($1::text[])
        ORDER BY ci.campaign_id,ci.sort_order,ci.product_id
      `, [ids]) : { rows: [] };
      return res.json(campaigns.rows.map(row => ({
        ...row, items: items.rows.filter(item => item.campaign_id === row.id),
      })));
    } catch (error) {
      console.error("Timed campaigns admin list:", error);
      return res.status(500).json({ error: "Kampanyalar yüklenemedi" });
    }
  });

  app.get("/api/public/timed-campaigns", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (!pool) return res.json([]);
    try {
      await ensureB2BTimedCampaignSchema();
      const rows = await pool.query(`
        SELECT c.id::text AS id,c.title,c.starts_at,c.ends_at,
          ARRAY_AGG(ci.product_id::text ORDER BY ci.sort_order,ci.product_id) AS product_ids
        FROM b2b_timed_campaigns c
        JOIN b2b_timed_campaign_items ci ON ci.campaign_id=c.id
        JOIN b2b_products p ON p.id=ci.product_id
          AND p.is_active IS DISTINCT FROM FALSE
        WHERE c.is_active = TRUE AND c.starts_at <= NOW() AND c.ends_at > NOW()
          AND ci.promo_price < COALESCE(
            CASE WHEN p.campaign_price > 0 AND p.campaign_price < p.price
              THEN p.campaign_price END, p.price)
        GROUP BY c.id,c.title,c.starts_at,c.ends_at
        ORDER BY c.ends_at ASC,c.id DESC LIMIT 30
      `);
      // Public data includes only names, dates and product IDs; B2B prices stay private.
      return res.json(rows.rows);
    } catch (error) {
      console.error("Timed campaigns public list:", error);
      return res.status(500).json({ error: "Kampanya listesi yüklenemedi" });
    }
  });

  const save = async (req: any, res: any, existingId?: string) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı yok" });
    let payload: ReturnType<typeof parseBody>;
    try { payload = parseBody(req.body); }
    catch (error) { return res.status(400).json({ error: (error as Error).message }); }
    const client = await pool.connect();
    try {
      await ensureB2BTimedCampaignSchema();
      await client.query("BEGIN");
      // Prevent concurrent admins from creating overlapping active offers.
      await client.query("SELECT pg_advisory_xact_lock(hashtext('b2b_timed_campaigns_save_v1'))");
      if (existingId) {
        if (!/^[1-9]\d*$/.test(existingId)) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Geçersiz kampanya" });
        }
        const found = await client.query("SELECT id FROM b2b_timed_campaigns WHERE id::text=$1 FOR UPDATE", [existingId]);
        if (!found.rows.length) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Kampanya bulunamadı" });
        }
      }
      const ids = payload.items.map(item => item.productId);
      const products = await client.query(`
        SELECT id::text AS id,name,price,campaign_price,is_active,stock,units_per_box
        FROM b2b_products WHERE id::text=ANY($1::text[]) FOR UPDATE
      `, [ids]);
      if (products.rows.length !== ids.length) throw new Error("Seçilen ürünlerden biri bulunamadı");
      const byId = new Map(products.rows.map(row => [row.id, row]));
      for (const item of payload.items) {
        const product = byId.get(item.productId);
        const base = Number(product.price);
        const permanent = Number(product.campaign_price);
        const effective = permanent > 0 && permanent < base ? permanent : base;
        if (product.is_active === false || !Number.isFinite(effective) ||
            item.promoPrice >= effective)
          throw new Error(product.name + ": kampanya fiyatı mevcut satış fiyatından düşük olmalı");
      }
      if (payload.isActive) {
        const conflict = await client.query(`
          SELECT c.title,p.name
          FROM b2b_timed_campaigns c
          JOIN b2b_timed_campaign_items ci ON ci.campaign_id=c.id
          JOIN b2b_products p ON p.id=ci.product_id
          WHERE c.is_active=TRUE
            AND c.starts_at < $2::timestamptz AND c.ends_at > $1::timestamptz
            AND ci.product_id::text=ANY($3::text[])
            AND ($4::text IS NULL OR c.id::text<>$4)
          LIMIT 1
        `, [payload.startsAt.toISOString(), payload.endsAt.toISOString(), ids, existingId || null]);
        if (conflict.rows.length)
          throw new Error(conflict.rows[0].name + " başka bir etkin kampanyada: " + conflict.rows[0].title);
      }
      const result = existingId ? await client.query(`
        UPDATE b2b_timed_campaigns SET title=$2,starts_at=$3,ends_at=$4,
          is_active=$5,updated_at=NOW()
        WHERE id::text=$1 RETURNING id::text AS id
      `, [existingId,payload.title,payload.startsAt,payload.endsAt,payload.isActive]) :
        await client.query(`
          INSERT INTO b2b_timed_campaigns (title,starts_at,ends_at,is_active)
          VALUES ($1,$2,$3,$4) RETURNING id::text AS id
        `, [payload.title,payload.startsAt,payload.endsAt,payload.isActive]);
      const campaignId = result.rows[0].id;
      if (existingId)
        await client.query("DELETE FROM b2b_timed_campaign_items WHERE campaign_id::text=$1", [campaignId]);
      for (let index=0;index<payload.items.length;index++) {
        const item=payload.items[index];
        await client.query(`
          INSERT INTO b2b_timed_campaign_items(campaign_id,product_id,promo_price,sort_order)
          VALUES ($1,$2,$3,$4)
        `, [campaignId,item.productId,item.promoPrice,index]);
      }
      await client.query("COMMIT");
      return res.status(existingId ? 200 : 201).json({ ok: true, id: campaignId });
    } catch(error) {
      await client.query("ROLLBACK").catch(()=>{});
      const message = error instanceof Error ? error.message : "Kampanya kaydedilemedi";
      console.error("Timed campaign save:", message);
      return res.status(400).json({ error: message });
    } finally { client.release(); }
  };

  app.post("/api/admin/timed-campaigns", requireAdmin, (req, res) => void save(req,res));
  app.put("/api/admin/timed-campaigns/:id", requireAdmin, (req, res) => void save(req,res,String(req.params.id)));
  app.delete("/api/admin/timed-campaigns/:id", requireAdmin, async (req,res) => {
    if (!pool) return res.status(503).json({error:"Veritabanı bağlantısı yok"});
    if (!/^[1-9]\d*$/.test(String(req.params.id))) return res.status(400).json({error:"Geçersiz kampanya"});
    try {
      await ensureB2BTimedCampaignSchema();
      const result=await pool.query("DELETE FROM b2b_timed_campaigns WHERE id::text=$1 RETURNING id",[String(req.params.id)]);
      if(!result.rowCount)return res.status(404).json({error:"Kampanya bulunamadı"});
      return res.json({ok:true});
    } catch(error) {
      console.error("Timed campaign delete:",error);
      return res.status(500).json({error:"Kampanya silinemedi"});
    }
  });
}
