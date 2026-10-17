import type { Express, Request, RequestHandler } from "express";
import { pool } from "./db";
import { notifyB2BEvent } from "./b2b-notification-center";

type UserIdResolver = (req: Request) => number | undefined;

// Admins must explicitly verify the incoming bank movement, amount and reference.
// A customer's report alone must never be interpreted as receipt of funds.
let auditReady: Promise<unknown> | null = null;
async function ensureAudit() {
  if (!pool) throw new Error("Veritabanı bağlı değil");
  if (!auditReady) {
    auditReady = pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_bank_payment_approvals (
        order_id BIGINT PRIMARY KEY REFERENCES b2b_orders(id) ON DELETE RESTRICT,
        order_number TEXT NOT NULL,
        transfer_code TEXT NOT NULL,
        amount NUMERIC(14,2) NOT NULL,
        approved_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `).catch((error) => { auditReady = null; throw error; });
  }
  await auditReady;
}

export function registerB2BBankPaymentApproval(
  app: Express,
  requireAdmin: RequestHandler,
  sessionUserId: UserIdResolver,
) {
  app.post("/api/admin/orders/:id/approve-bank-payment", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "Veritabanı bağlantısı bulunamadı" });
    if (req.body?.bankStatementChecked !== true) {
      return res.status(400).json({
        error: "Banka hesabına gelen tutarı ve CLK açıklama kodunu kontrol ettiğinizi onaylayın.",
      });
    }
    const id = String(req.params.id || "").trim();
    if (!/^\d{1,20}$/.test(id)) return res.status(400).json({ error: "Geçersiz sipariş numarası" });
    const actor = sessionUserId(req);
    if (!actor) return res.status(401).json({ error: "Yönetici oturumu bulunamadı" });
    try {
      await ensureAudit();
      const client = await pool.connect();
      let order: {
        id: string; user_id: number; order_number: string;
        transfer_code: string; total_amount: string; status: string;
      } | null = null;
      let firstApproval = false;
      try {
        await client.query("BEGIN");
        const found = await client.query(`
          SELECT id, user_id, order_number, transfer_code,
            total_amount, payment_method, payment_status, status
          FROM b2b_orders WHERE id::text=$1 FOR UPDATE
        `, [id]);
        const record = found.rows[0];
        if (!record) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Sipariş bulunamadı" });
        }
        if (record.payment_method !== "bank_transfer") {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "Bu işlem yalnızca Havale/EFT siparişleri için kullanılabilir" });
        }
        if (record.status === "paid" && record.payment_status === "bank_confirmed") {
          // Safe retry without double approval or double payment notifications.
          order = record;
        } else if (
          record.status === "awaiting_bank_confirmation" &&
          record.payment_status === "customer_reported_paid"
        ) {
          if (!record.user_id || !record.transfer_code) {
            throw new Error("Müşteri veya havale kodu eksik, sipariş onaylanamaz");
          }
          const updated = await client.query(`
            UPDATE b2b_orders
            SET status='paid', payment_status='bank_confirmed'
            WHERE id=$1 AND status='awaiting_bank_confirmation'
              AND payment_status='customer_reported_paid' AND payment_method='bank_transfer'
            RETURNING id,user_id,order_number,transfer_code,total_amount,status
          `, [record.id]);
          if (!updated.rows[0]) throw new Error("Sipariş ödeme durumu değişmiş, yenileyin");
          const confirmedOrder = updated.rows[0];
          order = confirmedOrder;
          await client.query(`
            INSERT INTO b2b_bank_payment_approvals
              (order_id,order_number,transfer_code,amount,approved_by)
            VALUES ($1,$2,$3,$4,$5) ON CONFLICT(order_id) DO NOTHING
          `, [confirmedOrder.id,confirmedOrder.order_number,confirmedOrder.transfer_code,confirmedOrder.total_amount,actor]);
          firstApproval = true;
        } else {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: "Müşteri havale bildirimi bekleniyor veya sipariş zaten sonuçlandırılmış",
          });
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }

      if (!order || !order.user_id) return res.status(500).json({ error: "Sipariş onay kaydı bulunamadı" });
      // Persist a targeted notification and attempt to push it to B2B devices.
      // Unique dedupe key also protects retries after a failed network response.
      let notification = { recorded: false, sent: 0 };
      try {
        notification = await notifyB2BEvent(
          Number(order.user_id), "order_payment_approved", {
            orderNumber: String(order.order_number),
            amount: Number(order.total_amount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" }),
          }, `order_payment_approved:${order.id}`,
        );
      } catch (error) {
        console.error("Bank payment customer notification failed:", error);
      }
      return res.json({
        ok: true,
        status: "paid",
        paymentStatus: "bank_confirmed",
        firstApproval,
        notificationRecorded: notification.recorded,
        pushSent: notification.sent,
        ...(notification.recorded ? {} : { notice: "Ödeme onaylandı. Bildirim daha önce kaydedilmiş olabilir; bildirim merkezini kontrol edin." }),
      });
    } catch (error) {
      console.error("Admin bank payment approval error:", error);
      return res.status(500).json({ error: "Havale onayı tamamlanamadı" });
    }
  });
}
