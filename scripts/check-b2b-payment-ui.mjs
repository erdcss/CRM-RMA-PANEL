import fs from "node:fs";

const paymentFile = "client/src/pages/b2b-payment.tsx";
const source = fs.readFileSync(paymentFile, "utf8");

const required = [
  'data-b2b-card-fields="persistent"',
  'title="iyzico Güvenli Kart Ödemesi"',
  'paymentUrl.searchParams.set("iframe", "true")',
  '"/api/b2b/payments/iyzico/initialize"',
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(
      `B2B ödeme koruması ihlal edildi: eksik zorunlu işaretçi -> ${marker}`,
    );
  }
}

if (source.includes('"/api/b2b/payments/iyzico/3ds/initialize"')) {
  throw new Error(
    "B2B ödeme ekranı doğrudan 3DS initialize endpointine dönemez; resmi iyzico Checkout Form kullanılmalıdır.",
  );
}

console.log("B2B payment UI guard: OK");
