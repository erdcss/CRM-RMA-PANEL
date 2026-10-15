const fs = require("fs");
const path = require("path");
const { createHash } = require("node:crypto");
const { makeAndroidAdaptiveIcon } = require("./android-adaptive-icon.cjs");

const target = process.argv[2] === "business" ? "business" : "b2b";
const root = process.cwd();
const appJsonPath = path.join(root, "app.json");
const assetsDir = path.join(root, "assets");
const api = (process.env.EXPO_PUBLIC_BRANDING_API_URL || "https://admin.ecalisgan.com").replace(/\/$/, "");

function extensionFromMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return null;
}

async function readAsset(value) {
  if (!value || typeof value !== "string") return null;

  if (value.startsWith("data:image/")) {
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(value);
    if (!match) return null;
    return {
      mime: match[1].toLowerCase(),
      buffer: Buffer.from(match[2], "base64"),
    };
  }

  if (/^https?:\/\//i.test(value) || value.startsWith("/")) {
    const imageUrl = new URL(value, api).toString();
    const response = await fetch(imageUrl, {
      headers: { Accept: "image/*", "Cache-Control": "no-cache" },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error("Admin görseli indirilemedi: HTTP " + response.status + " (" + imageUrl + ")");
    }
    const mime = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) {
      throw new Error("Admin görseli geçersiz formatta: " + (mime || "bilinmiyor"));
    }
    return {
      mime,
      buffer: Buffer.from(await response.arrayBuffer()),
    };
  }

  return null;
}

async function saveAsset(name, value) {
  const asset = await readAsset(value);
  if (!asset || !asset.buffer.length) {
    throw new Error("Admin panelindeki " + name + " görseli eksik; eski logo kullanılmayacak.");
  }
  fs.mkdirSync(assetsDir, { recursive: true });
  const ext = extensionFromMime(asset.mime);
  if (!ext) {
    throw new Error("Mobil marka görseli native build için desteklenmeyen formatta: " + asset.mime);
  }
  // Content-addressed filenames prevent Windows image viewers from locking
  // a previously generated file during the next TestFlight build.
  const digest = createHash("sha256").update(asset.buffer).digest("hex").slice(0, 12);
  const filename = `managed-${name}-${digest}.${ext}`;
  const filePath = path.join(assetsDir, filename);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size !== asset.buffer.length) {
    fs.writeFileSync(filePath, asset.buffer);
  }
  return `./assets/${filename}`;
}

async function main() {
  const response = await fetch(
    `${api}/api/public/mobile-branding/${target}?t=${Date.now()}`,
    { headers: { Accept: "application/json", "Cache-Control": "no-cache" } },
  );

  if (!response.ok) {
    throw new Error(`branding endpoint HTTP ${response.status}`);
  }

  const branding = await response.json();
  if (target === "b2b" && (!branding.logo || !branding.splash)) {
    throw new Error(
      "Çalışkan B2B için admin panelinde Mobil Logo ve Splash Ekranı görsellerinin ikisi de yüklenmeli. Eski görselle build alınmayacak.",
    );
  }
  const logoPath = await saveAsset("logo", branding.logo);
  const splashPath = await saveAsset("splash", branding.splash);
  const androidIconPath = target === "b2b" && branding.androidIcon
    ? await saveAsset("android-icon", branding.androidIcon)
    : logoPath;
  if (target === "b2b" && !androidIconPath.endsWith(".png")) {
    throw new Error("Android uygulama ikonu PNG formatında olmalı.");
  }
  if (target === "b2b" && !logoPath.endsWith(".png")) {
    throw new Error("iOS uygulama simgesi için admin paneline PNG mobil logo yükleyin.");
  }
  if (target === "b2b" && !splashPath.endsWith(".png")) {
    throw new Error("iOS açılış görseli için admin paneline PNG splash yükleyin.");
  }

  if (!fs.existsSync(appJsonPath)) {
    throw new Error("app.json bulunamadı");
  }

  const config = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
  const expo = config.expo || (config.expo = {});

  let androidForegroundPath = null;
  if (logoPath) {
    expo.icon = logoPath;
    androidForegroundPath = target === "b2b" ? makeAndroidAdaptiveIcon(androidIconPath, assetsDir, Boolean(branding.androidIcon)) : logoPath;
    expo.android = expo.android || {};
    expo.android.adaptiveIcon = {
      ...(expo.android.adaptiveIcon || {}),
      foregroundImage: androidForegroundPath,
      backgroundColor:
        expo.android.adaptiveIcon?.backgroundColor ||
        (target === "business" ? "#0B0B0B" : "#FFFFFF"),
    };
  }

  if (splashPath) {
    expo.splash = {
      ...(expo.splash || {}),
      image: splashPath,
      resizeMode: "cover",
      backgroundColor:
        expo.splash?.backgroundColor ||
        (target === "business" ? "#0B0B0B" : "#FFFFFF"),
    };
  }

  // Custom notification sounds are native resources: uploading a WAV in admin
  // cannot change sound playback in an already-installed iOS/Android binary.
  // Bundle the latest configured audio into each new native build.
  if (target === "b2b") {
    try {
      const soundResponse = await fetch(`${api}/api/public/b2b-notification-sound?t=${Date.now()}`,
        { headers: { Accept: "audio/wav", "Cache-Control": "no-cache" } });
      if (soundResponse.ok) {
        const bytes = Buffer.from(await soundResponse.arrayBuffer());
        if (bytes.length >= 100 && bytes.length <= 512 * 1024 &&
            bytes.toString("ascii",0,4) === "RIFF" &&
            bytes.toString("ascii",8,12) === "WAVE") {
          const filename = "b2b-custom.wav";
          fs.writeFileSync(path.join(assetsDir, filename), bytes);
          expo.plugins = Array.isArray(expo.plugins) ? expo.plugins : [];
          expo.plugins = expo.plugins.filter(p =>
            !(typeof p === "string" ? p === "expo-notifications" :
              Array.isArray(p) && p[0] === "expo-notifications"));
          expo.plugins.push(["expo-notifications", { sounds: ["./assets/b2b-custom.wav"] }]);
          console.log("[brand-sync] Admin WAV notification sound bundled for iOS and Android");
        }
      } else if (soundResponse.status !== 404) {
        console.warn("[brand-sync] Optional notification sound returned HTTP " + soundResponse.status);
      }
    } catch(error) {
      console.warn("[brand-sync] Optional notification sound unavailable:", String(error?.message || error));
    }
  }

  // Only files referenced by app.json are bundled. Older unreferenced files
  // may be locked by Windows Photos; cleanup should never block a valid build.
  const activeFiles = new Set([path.basename(logoPath), path.basename(splashPath), path.basename(androidIconPath), ...(androidForegroundPath ? [path.basename(androidForegroundPath)] : [])]);
  for (const filename of fs.readdirSync(assetsDir)) {
    if (
      /^managed-(?:logo|splash|android-icon|android-foreground|header-logo)(?:-[a-f0-9]{12})?\.(?:png|jpg|webp)$/.test(filename) &&
      !activeFiles.has(filename)
    ) {
      try {
        fs.unlinkSync(path.join(assetsDir, filename));
      } catch (error) {
        if (!["EBUSY", "EACCES", "EPERM"].includes(error?.code)) throw error;
        console.warn(`[brand-sync] Eski ${filename} dosyası açık, temizleme daha sonra yapılacak.`);
      }
    }
  }

  // Bundle the actual splash PNG into the JavaScript render tree too. Native
  // splash display can finish before remote branding metadata is loaded.
  // A literal require path is necessary for Metro to include the image.
  if (target === "b2b") {
    const libDir = path.join(root, "lib");
    fs.mkdirSync(libDir, { recursive: true });
    const runtimePath = path.join(libDir, "managed-splash.ts");
    const filename = path.basename(splashPath);
    const source = `import type { ImageSourcePropType } from 'react-native';\nexport const managedSplash: ImageSourcePropType = require('../assets/${filename}');\n`;
    if (!fs.existsSync(runtimePath) || fs.readFileSync(runtimePath, "utf8") !== source) {
      fs.writeFileSync(runtimePath, source);
    }
  }

  fs.writeFileSync(appJsonPath, JSON.stringify(config, null, 2) + "\n");
  console.log(
    `Mobil marka senkronizasyonu tamamlandı: ${target} · logo=${Boolean(logoPath)} · androidForeground=${androidForegroundPath ? path.basename(androidForegroundPath) : 'yok'} · splash=${Boolean(splashPath)}`,
  );
}

main().catch((error) => {
  console.error(
    "[brand-sync] Build iptal edildi; eksik admin görsellerinin yerine eski logo kullanılmayacak:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
