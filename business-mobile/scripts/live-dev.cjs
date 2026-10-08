const { execFileSync, spawn } = require("node:child_process");
const path = require("node:path");

const mobileRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mobileRoot, "..");
const branch = process.env.LIVE_DEV_BRANCH || "main";
const connectionMode = process.argv.includes("--tunnel") ? "--tunnel" : "--lan";
const isWindows = process.platform === "win32";
let syncing = false;
let warnedDirty = false;

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options,
  }).trim();
}

function syncFromGitHub() {
  if (syncing) return;
  syncing = true;
  try {
    if (git(["branch", "--show-current"]) !== branch) return;
    const status = git(["status", "--porcelain"]);
    if (status) {
      if (!warnedDirty) console.warn("[business-live-dev] Auto-sync paused: local changes exist.");
      warnedDirty = true;
      return;
    }
    warnedDirty = false;
    git(["fetch", "origin", branch, "--quiet"]);
    const local = git(["rev-parse", "HEAD"]);
    const remote = git(["rev-parse", `origin/${branch}`]);
    if (local === remote) return;
    execFileSync("git", ["merge-base", "--is-ancestor", local, remote], { cwd: repoRoot, stdio: "ignore" });
    execFileSync("git", ["merge", "--ff-only", `origin/${branch}`], { cwd: repoRoot, stdio: "inherit" });
    console.log("[business-live-dev] GitHub changes synced. Expo Fast Refresh will update the phone.");
  } catch (error) {
    console.warn(`[business-live-dev] Sync skipped: ${String(error.message || error).split("\n")[0]}`);
  } finally { syncing = false; }
}

console.log(`[business-live-dev] Starting Çalışkan Business Expo Go (${connectionMode.slice(2)}).`);
syncFromGitHub();
const timer = setInterval(syncFromGitHub, 4000);
const expoCommand = isWindows ? "cmd.exe" : "npx";
const expoArgs = isWindows
  ? ["/d", "/s", "/c", `npx expo start --go ${connectionMode} --clear --port 8091`]
  : ["expo", "start", "--go", connectionMode, "--clear", "--port", "8091"];

const expo = spawn(expoCommand, expoArgs, {
  cwd: mobileRoot, stdio: "inherit",
  env: { ...process.env, APP_VARIANT: "development" }, shell: false,
});
function stop(signal) { clearInterval(timer); if (!expo.killed) expo.kill(signal); }
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
expo.on("exit", code => { clearInterval(timer); process.exit(code ?? 0); });
