import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ALLOWED = Object.freeze({
  b2b: { directory: "mobile", profile: "testflight" },
  business: { directory: "business-mobile", profile: "testflight" },
  dukkan: { directory: "dukkan-mobile", profile: "testflight" },
  mayk: { directory: "mayk-source/mayk-ios", profile: "production" },
});
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
let app, operation, ascAppId = "";
if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch") {
  app = event.inputs?.app;
  operation = event.inputs?.operation;
  ascAppId = event.inputs?.mayk_asc_app_id || "";
} else if (process.env.GITHUB_EVENT_NAME === "push") {
  // GitHub Actions push payload omits added/modified lists; read the committed file diff.
  const changes = execFileSync("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], {
    encoding: "utf8",
  }).split(/\r?\n/).filter(Boolean);
  const markers = changes.filter((name) =>
    /^\.github\/release-requests\/central-ios\/[a-zA-Z0-9_-]+\.json$/.test(name),
  );
  if (markers.length !== 1) throw new Error("A single named central-ios release request is required");
  const request = JSON.parse(fs.readFileSync(path.join(process.cwd(), markers[0]), "utf8"));
  app = request.app;
  operation = request.operation;
  ascAppId = request.maykAscAppId || "";
} else {
  throw new Error("Unsupported workflow event");
}
if (!Object.hasOwn(ALLOWED, app)) throw new Error("Unknown iOS application selection");
if (operation !== "verify" && operation !== "testflight") {
  throw new Error("Operation must be verify or testflight");
}
if (typeof ascAppId !== "string") throw new Error("Invalid App Store Connect ID");
ascAppId = ascAppId.trim();
if (app === "mayk" && operation === "testflight" && !/^[0-9]{8,15}$/.test(ascAppId)) {
  throw new Error("M.A.Y.K TestFlight requires its numeric App Store Connect Apple ID");
}
if (ascAppId && app !== "mayk") {
  throw new Error("App Store Connect ID override is only accepted for M.A.Y.K");
}
const selected = ALLOWED[app];
const values = {
  app,
  operation,
  app_dir: selected.directory,
  profile: selected.profile,
  mayk_asc_app_id: ascAppId,
};
fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(values).map(([k,v]) => k + "=" + v).join("\n") + "\n");
console.log("iOS target:", app, operation, "profile:", selected.profile, "repository: erdcss/" + (app === "mayk" ? "AI-PROGRES" : "CRM-RMA-PANEL"));
