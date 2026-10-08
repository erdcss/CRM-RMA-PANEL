const fs = require("fs");
const path = require("path");

const target = process.argv[2] === "business" ? "business" : "b2b";
const root = process.cwd();
const appJsonPath = path.join(root, "app.json");
const assetsDir = path.join(root, "assets");
const api = (process.env.EXPO_PUBLIC_API_URL || "https://admin.ecalisgan.com").replace(/\/$/, "");

function extensionFromMime(mime) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
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

  if (/^https?:\/\//i.test(value)) {
    const response = await fetch(value, {
      headers: { Accept: "image/*", "Cache-Control": "no-cache" },
      redirect: "follow",
    });
    if (!response.ok) return null;
    const mime = (response.headers.get("content-type") || "image/png").split(";")[0].toLowerCase();
    if (!mime.startsWith("image/")) return null;
    return {
      mime,
      buffer: Buffer.from(await response.arrayBuffer()),
    };
  }

  return null;
}

async function saveAsset(name, value) {
  const asset = await readAsset(value);
  if (!asset || !asset.buffer.length) return null;
  fs.mkdirSync(assetsDir, { recursive: true });
  const ext = extensionFromMime(asset.mime);
  const filename = `managed-${name}.${ext}`;
  const filePath = path.join(assetsDir, filename);
  fs.writeFileSync(filePath, asset.buffer);
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
  const logoPath = await saveAsset("logo", branding.logo);
  const splashPath = await saveAsset("splash", branding.splash || branding.logo);

  if (target === "business" && (!logoPath || !splashPath)) {
    throw new Error("Çalışkan Business logo/splash görselleri admin panelinden alınamadı");
  }

  if (!fs.existsSync(appJsonPath)) {
    throw new Error("app.json bulunamadı");
  }

  const config = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
  const expo = config.expo || (config.expo = {});

  if (logoPath) {
    expo.icon = logoPath;
    expo.ios = expo.ios || {};
    expo.ios.icon = logoPath;

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
    const splashBackground = target === "business" ? "#0B0B0B" : "#FFFFFF";

    // Keep legacy splash config as a fallback for tooling that still reads it.
    expo.splash = {
      ...(expo.splash || {}),
      image: splashPath,
      resizeMode: "cover",
      backgroundColor: splashBackground,
    };

    // SDK 57: native release/TestFlight splash is configured with expo-splash-screen.
    // iOS uses the admin-uploaded image as a full-screen cover image.
    expo.plugins = Array.isArray(expo.plugins) ? expo.plugins : [];
    expo.plugins = expo.plugins.filter((plugin) => {
      if (typeof plugin === "string") return plugin !== "expo-splash-screen";
      return !(Array.isArray(plugin) && plugin[0] === "expo-splash-screen");
    });
    expo.plugins.push([
      "expo-splash-screen",
      {
        backgroundColor: splashBackground,
        image: splashPath,
        resizeMode: "cover",
        enableFullScreenImage_legacy: true,
        ios: {
          backgroundColor: splashBackground,
          image: splashPath,
          resizeMode: "cover",
        },
        android: {
          backgroundColor: splashBackground,
          image: logoPath || splashPath,
          resizeMode: "contain",
        },
      },
    ]);
  }

  fs.writeFileSync(appJsonPath, JSON.stringify(config, null, 2) + "\n");
  console.log(
    `Mobil marka senkronizasyonu tamamlandı: ${target} · logo=${Boolean(logoPath)} · splash=${Boolean(splashPath)} · iosFullScreenSplash=${Boolean(splashPath)}`,
  );
}

main().catch((error) => {
  console.error(
    "Mobil marka görselleri build öncesi senkronize edilemedi:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(target === "business" ? 1 : 0);
});
