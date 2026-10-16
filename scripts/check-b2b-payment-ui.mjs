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

const storefront = fs.readFileSync("client/src/pages/b2b-storefront.tsx","utf8");
const footer = "<B2BFooter />";
const occurrences = storefront.split(footer).length - 1;
if (occurrences !== 1) {
  throw new Error(`B2B ana sayfada footer yalnızca bir kez kullanılmalıdır (bulunan: ${occurrences})`);
}
const featureStart = storefront.indexOf("function Feature(");
const footerPlace = storefront.indexOf(footer);
const mainEnd = storefront.indexOf("</main>");
if (featureStart < 0 || mainEnd < 0 || footerPlace <= mainEnd || footerPlace >= featureStart) {
  throw new Error("B2BFooter tanıtım kartının içine giremez; ürün kataloğundan sonra yer almalıdır.");
}
console.log("B2B storefront layout guard: OK");

console.log("B2B payment UI guard: OK");
