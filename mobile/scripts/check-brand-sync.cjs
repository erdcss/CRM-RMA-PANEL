const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { PNG } = require("pngjs");

const script = path.resolve(__dirname, "sync-mobile-branding.cjs");
// Generate a valid PNG with pngjs rather than relying on an old fixture
// whose CRC was ignored until the adaptive-icon processor decoded it.
const sample = new PNG({ width: 4, height: 4 });
sample.data.fill(255);
const samplePng = PNG.sync.write(sample);

function launch(args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { ...options, shell: false });
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk.toString(); });
    child.stderr.on("data", (chunk) => { out += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, out }));
  });
}

async function runCase(withSplash) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "b2b-brand-sync-"));
  fs.writeFileSync(path.join(tmp, "app.json"), JSON.stringify({
    expo: { name: "Çalışkan B2B", ios: {}, android: {} },
  }));
  const server = http.createServer((req, res) => {
    if (req.url.startsWith("/api/public/mobile-branding/b2b")) {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({
        logo: "/api/public/mobile-image/b2b-logo",
        splash: withSplash ? "/api/public/mobile-image/b2b-splash" : null,
      }));
    }
    if (req.url.startsWith("/api/public/mobile-image/")) {
      res.setHeader("Content-Type", "image/png");
      return res.end(samplePng);
    }
    res.statusCode = 404;
    res.end();
  });

  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const result = await launch([script, "b2b"], {
      cwd: tmp,
      env: { ...process.env, EXPO_PUBLIC_BRANDING_API_URL: "http://127.0.0.1:" + port },
    });
    const config = JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8"));
    if (withSplash) {
      assert.equal(result.code, 0, result.out);
      assert.match(config.expo.icon, /^\.\/assets\/managed-logo-[a-f0-9]{12}\.png$/);
      assert.match(config.expo.splash.image, /^\.\/assets\/managed-splash-[a-f0-9]{12}\.png$/, "Native iOS splash must show branded artwork immediately");
      assert.equal(config.expo.ios.splash.image, config.expo.splash.image);
      assert.equal(config.expo.ios.splash.resizeMode, "cover");
      assert.equal(config.expo.splash.backgroundColor, "#101010");
      const logoFile = path.join(tmp, config.expo.icon);
      const splashFile = path.join(tmp, config.expo.splash.image);
      assert.ok(
        path.basename(config.expo.android.adaptiveIcon.foregroundImage).startsWith("managed-android-foreground-") &&
        config.expo.android.adaptiveIcon.foregroundImage.endsWith(".png"),
        "Android must use its own padded foreground PNG"
      );
      assert.notEqual(config.expo.android.adaptiveIcon.foregroundImage, config.expo.icon,
        "Android adaptive foreground must be padded rather than full bleed");
      const adaptiveFile = path.join(tmp, config.expo.android.adaptiveIcon.foregroundImage);
      const adaptive = PNG.sync.read(fs.readFileSync(adaptiveFile));
      assert.equal(adaptive.width, 1024);
      assert.equal(adaptive.height, 1024);
      assert.equal(adaptive.data[3], 0, "Outside safe zone must be transparent");
      assert.ok(adaptive.data[((512 * 1024) + 512) * 4 + 3] > 0,
        "Logo must remain visible at the icon center");

      assert.ok(fs.statSync(logoFile).size > 50);
      assert.ok(fs.statSync(splashFile).size > 50);
      assert.equal(
        fs.existsSync(path.join(tmp, "lib", "managed-header-logo.ts")),
        false,
        "Homepage header logo must no longer be bundled"
      );

      const runtimeModule = path.join(tmp, "lib", "managed-splash.ts");
      assert.match(fs.readFileSync(runtimeModule, "utf8"), /managedSplash: ImageSourcePropType \| null = null/);


      // Repeating sync must reuse the same files rather than overwrite files
      // that may be held open in Windows Photos.
      const logoModifiedAt = fs.statSync(logoFile).mtimeMs;
      const splashModifiedAt = fs.statSync(splashFile).mtimeMs;
      const second = await launch([script, "b2b"], {
        cwd: tmp,
        env: { ...process.env, EXPO_PUBLIC_BRANDING_API_URL: "http://127.0.0.1:" + port },
      });
      assert.equal(second.code, 0, second.out);
      assert.equal(fs.statSync(logoFile).mtimeMs, logoModifiedAt);
      assert.equal(fs.statSync(splashFile).mtimeMs, splashModifiedAt);
    } else {
      assert.equal(result.code, 0, result.out);
      assert.equal(config.expo.splash.image, undefined);
      assert.equal(config.expo.ios.splash, undefined, "When removed, do not bundle the previous iOS splash");
      assert.equal(config.expo.splash.backgroundColor, "#101010");
      assert.match(config.expo.icon, /^\.\/assets\/managed-logo-[a-f0-9]{12}\.png$/);
      assert.match(fs.readFileSync(path.join(tmp, "lib", "managed-splash.ts"), "utf8"), /managedSplash: ImageSourcePropType \| null = null/);
      assert.equal(fs.readdirSync(path.join(tmp, "assets")).some(file => file.startsWith("managed-splash-")), false);
    }
    return result;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}


// Startup contract: no separate login-background branding or premature
// splash dismissal while the authentication navigator is still redirecting.
function checkStartupContract() {
  const root = path.resolve(__dirname, "..");
  const layout = fs.readFileSync(path.join(root, "app", "_layout.tsx"), "utf8");
  const login = fs.readFileSync(path.join(root, "app", "login.tsx"), "utf8");
  const signup = fs.readFileSync(path.join(root, "app", "signup.tsx"), "utf8");
  const branding = fs.readFileSync(path.join(root, "lib", "branding.ts"), "utf8");
  assert.match(layout, /initialRoutePainted/, "Wait for initial route before hiding splash");
  assert.match(layout, /!initialRoutePainted/, "Keep splash opaque until initial route is painted");
  assert.match(layout, /SplashScreen.preventAutoHideAsync/, "Keep native splash at startup");
  for (const [name, source] of [["login", login], ["signup", signup], ["branding", branding]]) {
    assert.doesNotMatch(source, /b2b_mobile_login_background|loginBackground/, name + " must not use a second splash-like background");
  }
}

async function main() {
  checkStartupContract();
  await runCase(true);
  await runCase(false);
  console.log("B2B first-frame native splash / removal regression checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
