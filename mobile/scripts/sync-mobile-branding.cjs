const fs = require("fs");
const path = require("path");

const target = process.argv[2] === "business" ? "business" : "b2b";
const root = process.cwd();
const appJsonPath = path.join(root, "app.json");
const assetsDir = path.join(root, "assets");
const api = (process.env.EXPO_PUBLIC_API_URL || "https://admin.ecalisgan.com").replace(/\/$/, "");

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
  if (target === "b2b" && (!branding.logo || !branding.splash)) {
    throw new Error(
      "Çalışkan B2B için admin panelinde Mobil Logo ve Splash Ekranı görsellerinin ikisi de yüklenmeli. Eski görselle build alınmayacak.",
    );
  }
  const logoPath = await saveAsset("logo", branding.logo);
  const splashPath = await saveAsset("splash", branding.splash);
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
