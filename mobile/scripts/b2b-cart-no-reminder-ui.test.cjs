const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cartScreen = fs.readFileSync(path.join(__dirname, '../app/(tabs)/orders.tsx'), 'utf8');

test('basket screen does not show a cart reminder card or notification permission CTA', () => {
  for (const removed of [
    'Bekleyen Sepet Hatırlatıcısı',
    'reminderCard',
    'getB2BCartTrackingStatus',
    'enablePush',
    'pushRegistering',
    'Bekleyen sepet bildirimlerini etkinleştir',
    'Telefon bildirimlerini etkinleştir',
  ]) {
    assert.equal(cartScreen.includes(removed), false, 'Unexpected cart reminder UI: ' + removed);
  }
});

test('basket and completed order actions remain intact', () => {
  for (const required of [
    'Tamamlanmış Siparişlerim',
    'getOrderList()',
    'subscribeOrderList',
    'updateOrderListQuantity',
    'removeFromOrderList',
    'Ödemeyi Tamamla',
    'orderListItemTotal',
  ]) {
    assert.ok(cartScreen.includes(required), 'Basket functionality was unintentionally removed: ' + required);
  }
});
