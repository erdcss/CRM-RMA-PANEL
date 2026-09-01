# NIIMBOT iOS SDK — Vendor Package (4.0.3)

Official package: `IOS_4.0.3_20260120_en`

## Required layout (local machine / CI)

Place extracted SDK binaries here before iOS development or EAS build:

```
mobile/vendor/niimbot-ios/
  SDK/
    Headers/JCAPI.h
    Libs/JCAPI.a
    Libs/JCLPAPI.a
    Libs/libSkiaRenderLibrary.a
    font/FONT.json
    font/ZT001.ttf
    font/ZT002.otf
  IOS_4.0.3_20260120_en/   (optional — full NIIMBOT kit archive)
```

The Expo module links against `SDK/Libs/*.a` via `mobile/modules/niimbot-printer/ios/NiimbotPrinter.podspec`.

## API entry point

- Header: `JCAPI.h`
- Class: `JCAPI` (Objective-C)
- Swift import via bridging header

## Git / redistribution

**Do not commit proprietary NIIMBOT binaries to a public repository** unless NIIMBOT license explicitly allows it.

This repo `.gitignore` excludes:

- `vendor/niimbot-ios/SDK/` (static libraries + fonts)
- `vendor/niimbot-ios/IOS_4.0.3*/` (full extracted kit)

Integration source code under `mobile/modules/niimbot-printer/` is safe to commit.

Each developer/CI runner must copy the official SDK package locally before `expo prebuild` / EAS iOS build.

## App key / license

SDK 4.0.3 demo and `JCAPI.h` do **not** require an App Key for Bluetooth print in the shipped demo flow. If NIIMBOT provides a separate commercial agreement or activation step, follow their PDF:

- `Interface documentation/IOS SDK Interface Specification Document V4.0.3.pdf`
- `Instructions for Using the IOS SDK Access Package .pdf`

## D110-M notes (from JCAPI.h)

- Print density (`startJob` first param): **1–3**, default **2**
- Paper style: **1** = gap paper (typical D110-M labels)
- Native Code 128: `drawLableBarCode` with `withCodeType: 20`
- Resolution conversion: `mmToPixel:` / `pixelToMm:` (runtime, not fixed DPI constant in header)

## Do not

- Reverse engineer NIIMBOT Bluetooth protocol
- Use unofficial GitHub protocol implementations
- Commit `.a` / font binaries to public git without license clearance
