'use strict';
// Shared by React Native tracking and Node regression tests: no SDK or I/O.
const PAID_PAYMENT_STATUSES = new Set(['paid','success','bank_confirmed','completed']);
const PAID_ORDER_STATUSES = new Set(['paid','paid_stock_review']);
function amount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
function normalizeItem(row) {
  if (!row || typeof row !== 'object') return null;
  const contentId = String(row.contentId || '').trim().slice(0,128);
  const price = amount(row.price);
  const qty = Number(row.quantity);
  if (!contentId || price === null || !Number.isSafeInteger(qty) || qty <= 0 || qty > 100000) return null;
  return {
    contentId,
    price,
    quantity:qty,
    contentName:String(row.contentName || '').slice(0,160),
    brand:String(row.brand || '').slice(0,80),
    contentCategory:String(row.contentCategory || '').slice(0,80)
  };
}
function buildCommercePayload(name, rows, value, eventId) {
  if (!['ViewContent','AddToCart','Checkout','Purchase'].includes(name)) return null;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 50) return null;
  const contents=rows.map(normalizeItem);
  if (contents.some(row => !row)) return null;
  const total=amount(value);
  if (total === null) return null;
  if (name==='Purchase' && (!eventId || !/^[A-Za-z0-9:_-]{1,128}$/.test(String(eventId)))) return null;
  return { eventId:eventId ? String(eventId) : '', value:total, currency:'TRY', contents };
}
function sanitizeProductSearch(value) {
  const term=String(value||'').trim().replace(/\s+/g,' ');
  // Search text can contain personal information; drop phone/email patterns rather than transmitting.
  if (term.length < 2 || term.length > 120 || /@|(?:\+?90\s?)?0?5\d{9}\b|https?:\/\//i.test(term)) return '';
  return term;
}
function isVerifiedPaidOrder(order) {
  if (!order || typeof order !== 'object') return false;
  const method=String(order.payment_method || '').trim().toLowerCase();
  const payment=String(order.payment_status || '').trim().toLowerCase();
  const status=String(order.status || '').trim().toLowerCase();
  if (['failed','cancelled','canceled','refunded','payment_failed','cancel_requested'].includes(status)) return false;
  if (payment) return PAID_PAYMENT_STATUSES.has(payment);
  // Legacy confirmed card orders may not have payment_status; bank transfer needs bank verification.
  return method !== 'bank_transfer' && PAID_ORDER_STATUSES.has(status);
}
function verifiedPurchaseEventId(order) {
  const id=String(order?.id ?? '').trim();
  if (!/^[0-9]{1,18}$/.test(id)) return '';
  return 'b2b_paid_order_'+id;
}
function createPurchaseGuard() {
  const inFlight=new Set();
  const delivered=new Set();
  return async function deliverOnce(eventId,storage,send) {
    if(!eventId||inFlight.has(eventId)||delivered.has(eventId))return false;
    inFlight.add(eventId);
    try{
      if((await storage.getItem(eventId))==='sent') {
        delivered.add(eventId);
        return false;
      }
      const ok=await send();
      if(!ok)return false;
      delivered.add(eventId);
      // A temporary disk write error must not cause duplicate sends in this session.
      await storage.setItem(eventId,'sent').catch(()=>undefined);
      return true;
    }finally{inFlight.delete(eventId);}
  };
}
module.exports={amount,normalizeItem,buildCommercePayload,sanitizeProductSearch,isVerifiedPaidOrder,verifiedPurchaseEventId,createPurchaseGuard};
