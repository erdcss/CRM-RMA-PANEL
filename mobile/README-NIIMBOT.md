# NIIMBOT D110-M Direct Print (iOS)

## Expo Go is not supported

NIIMBOT printing uses the official **JCAPI 4.0.3** static libraries via the local Expo module `niimbot-printer`.

Use a **custom Expo development build** or EAS iOS build.

## SDK setup (required before native build)

1. Extract official kit `IOS_4.0.3_20260120_en` from NIIMBOT.
2. Copy binaries to `mobile/vendor/niimbot-ios/SDK/` (see `vendor/niimbot-ios/README.md`).
3. `npm install` in `mobile/`
4. `npx expo prebuild --platform ios`
5. `npx expo run:ios --device`

SDK binaries are gitignored; each machine/CI job needs the vendor files locally.

## Print flow (iOS)

`Barkod Yazdır` → JCAPI Bluetooth scan/connect → 40×12 mm Code 128 via `drawLableBarCode` → `commit` → D110-M.

AirPrint is **not** used for product/shipment barcode labels on iOS.

## Shipment 9-digit barcodes

Sevk ekranındaki `barcodeNumber` (9 hane, string) doğrudan NIIMBOT native Code 128 API'sine gönderilir. Leading zero korunur.
