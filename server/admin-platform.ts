import type { Express, RequestHandler } from "express";
import { pool } from "./db";

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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

async function ensurePlatformTables() {
  if (!pool) return;
  await pool.query(PLATFORM_SQL);
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

  app.get("/api/admin/branding", requireAdmin, async (_req, res) => {
    try {
      res.json(await brandingMap());
    } catch (error) {
      console.error("Admin branding load failed:", error);
      res.status(500).json({ error: "Marka ayarları alınamadı" });
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
      const [
        sessionUsers,
        liveUsers,
        orders,
        recentOrders,
        returns,
        recentReturns,
        topSearches,
        topViewedProducts,
      ] = await Promise.all([
        pool.query(`
          SELECT COUNT(DISTINCT visitor_id)::int AS count
          FROM analytics_events
          WHERE event_type IN ('session','heartbeat')
            AND created_at >= CURRENT_DATE
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
          WHERE created_at >= CURRENT_DATE
        `),
        pool.query(`
          SELECT id, order_number, customer_email, status, item_count, total_amount, created_at
          FROM b2b_orders
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
