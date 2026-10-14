const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");

const script = path.resolve(__dirname, "sync-mobile-branding.cjs");
const samplePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLZ8AAAAASUVORK5CYII=",
  "base64",
);

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
      assert.match(config.expo.splash.image, /^\.\/assets\/managed-splash-[a-f0-9]{12}\.png$/);
      const logoFile = path.join(tmp, config.expo.icon);
      const splashFile = path.join(tmp, config.expo.splash.image);
      assert.ok(fs.statSync(logoFile).size > 50);
      assert.ok(fs.statSync(splashFile).size > 50);
      const headerModule = path.join(tmp, "lib", "managed-header-logo.ts");
      assert.match(fs.readFileSync(headerModule, "utf8"),
        /managed-header-logo-[a-f0-9]{12}\\.png/);
      assert.match(result.out, /header=managed-header-logo-[a-f0-9]{12}\\.png/);

      const runtimeModule = path.join(tmp, "lib", "managed-splash.ts");
      assert.match(fs.readFileSync(runtimeModule, "utf8"), /require\('\.\.\/assets\/managed-splash-[a-f0-9]{12}\.png'\)/);


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
      assert.notEqual(result.code, 0, result.out);
      assert.equal(config.expo.icon, undefined);
      assert.equal(config.expo.splash, undefined);
    }
    return result;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  await runCase(true);
  await runCase(false);
  console.log("B2B admin-only native asset sync checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
