const fs = require("fs");
const path = require("path");
const { createHash } = require("node:crypto");

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
  // Home header is a separate brand asset. Bundle the selected admin image
  // so the header never falls back to an unrelated hardcoded logo offline.
  const headerPath = target === "b2b"
    ? await saveAsset("header-logo", branding.headerLogo || branding.logo)
    : null;
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

  if (logoPath) {
    expo.icon = logoPath;
    expo.android = expo.android || {};
    expo.android.adaptiveIcon = {
      ...(expo.android.adaptiveIcon || {}),
      foregroundImage: logoPath,
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

  // Only files referenced by app.json are bundled. Older unreferenced files
  // may be locked by Windows Photos; cleanup should never block a valid build.
  const activeFiles = new Set([path.basename(logoPath), path.basename(splashPath), ...(headerPath ? [path.basename(headerPath)] : [])]);
  for (const filename of fs.readdirSync(assetsDir)) {
    if (
      /^managed-(?:logo|splash)(?:-[a-f0-9]{12})?\.(?:png|jpg|webp)$/.test(filename) &&
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

  if (target === "b2b" && headerPath) {
    const libDir = path.join(root, "lib");
    fs.mkdirSync(libDir, { recursive: true });
    const runtimePath = path.join(libDir, "managed-header-logo.ts");
    const filename = path.basename(headerPath);
    const source = `import { Image } from 'react-native';\nexport const managedHeaderLogo: string = Image.resolveAssetSource(require('../assets/${filename}')).uri;\n`;
    if (!fs.existsSync(runtimePath) || fs.readFileSync(runtimePath, "utf8") !== source) {
      fs.writeFileSync(runtimePath, source);
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
    `Mobil marka senkronizasyonu tamamlandı: ${target} · logo=${Boolean(logoPath)} · splash=${Boolean(splashPath)}`,
  );
}

main().catch((error) => {
  console.error(
    "[brand-sync] Build iptal edildi; eksik admin görsellerinin yerine eski logo kullanılmayacak:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
