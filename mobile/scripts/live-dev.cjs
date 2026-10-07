const { execFileSync, spawn } = require("node:child_process");
const path = require("node:path");

const mobileRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mobileRoot, "..");
const branch = process.env.LIVE_DEV_BRANCH || "main";
const connectionMode = process.argv.includes("--tunnel") ? "--tunnel" : "--lan";
const isWindows = process.platform === "win32";

let syncing = false;
let warnedDirty = false;
let warnedBranch = false;

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function syncFromGitHub() {
  if (syncing) return;
  syncing = true;

  try {
    const currentBranch = git(["branch", "--show-current"]);
    if (currentBranch !== branch) {
      if (!warnedBranch) {
        console.warn(
          `[live-dev] Auto-sync paused: current branch is "${currentBranch}". Switch to "${branch}" or set LIVE_DEV_BRANCH.`,
        );
        warnedBranch = true;
      }
      return;
    }
    warnedBranch = false;

    const status = git(["status", "--porcelain"]);
    if (status) {
      if (!warnedDirty) {
        console.warn(
          "[live-dev] Auto-sync paused because local changes exist. Commit/stash them to resume safe GitHub syncing.",
        );
        warnedDirty = true;
      }
      return;
    }
    warnedDirty = false;

    git(["fetch", "origin", branch, "--quiet"]);

    const local = git(["rev-parse", "HEAD"]);
    const remote = git(["rev-parse", `origin/${branch}`]);
    if (local === remote) return;

    try {
      execFileSync("git", ["merge-base", "--is-ancestor", local, remote], {
        cwd: repoRoot,
        stdio: "ignore",
      });
    } catch {
      console.warn(
        "[live-dev] Auto-sync paused because local and GitHub history diverged. Resolve the branch manually.",
      );
      return;
    }

    const changedFiles = git(["diff", "--name-only", local, remote])
      .split(/\r?\n/)
      .filter(Boolean);

    execFileSync("git", ["merge", "--ff-only", `origin/${branch}`], {
      cwd: repoRoot,
      stdio: "inherit",
    });

    console.log(
      `[live-dev] GitHub changes synced (${changedFiles.length} file${changedFiles.length === 1 ? "" : "s"}). Expo Fast Refresh will update the phone.`,
    );

    if (
      changedFiles.some(
        (file) =>
          file === "mobile/package.json" ||
          file === "mobile/package-lock.json" ||
          file === "mobile/app.json" ||
          file === "mobile/app.config.js",
      )
    ) {
      console.warn(
        "[live-dev] Native/config dependency changed. If the running client cannot apply it, rebuild the development client.",
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[live-dev] GitHub sync skipped: ${message.split("\n")[0]}`);
  } finally {
    syncing = false;
  }
}

console.log(
  `[live-dev] Starting Çalışkan B2B Dev with ${connectionMode === "--tunnel" ? "tunnel" : "LAN"} mode.`,
);
console.log(
  `[live-dev] Watching origin/${branch}; ChatGPT GitHub commits will be pulled safely when the worktree is clean.`,
);

syncFromGitHub();
const timer = setInterval(syncFromGitHub, 4000);

const expoCommand = isWindows ? "cmd.exe" : "npx";
const expoArgs = isWindows
  ? ["/d", "/s", "/c", `npx expo start --dev-client ${connectionMode}`]
  : ["expo", "start", "--dev-client", connectionMode];

const expo = spawn(expoCommand, expoArgs, {
  cwd: mobileRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    APP_VARIANT: "development",
  },
  shell: false,
});

function stop(signal) {
  clearInterval(timer);
  if (!expo.killed) expo.kill(signal);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

expo.on("exit", (code) => {
  clearInterval(timer);
  process.exit(code ?? 0);
});
