import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log } from "./log";
import { serveStatic } from "./static";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { getUploadsDir } from "./image-storage";

const app = express();
const uploadsDir = getUploadsDir();

// Old supplier URLs on the B2B storefront move to the dedicated marketplace
// domain. Redirect at HTTP level, including deep links and query parameters.
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const host = req.hostname.toLowerCase();
  const b2bHost = host === "b2b.ecalisgan.com" ||
    (host.startsWith("caliskan-b2b-web-") && host.endsWith(".up.railway.app"));
  if (!b2bHost || !/^\/satici(?:\/|$)/.test(req.path)) return next();
  const original = req.originalUrl;
  const queryIndex = original.indexOf("?");
  const query = queryIndex < 0 ? "" : original.slice(queryIndex);
  const path = req.path === "/satici" || req.path === "/satici/" ? "/" : req.path;
  return res.redirect(302, "https://pazaryeri.ecalisgan.com" + path + query);
});

// This deployment is dedicated to suppliers. Keep the existing admin and buyer
// APIs on their respective services, even though they share the source repo.
if (process.env.APP_SERVICE_MODE === "marketplace") {
  app.use((req, res, next) => {
    const path = req.path;
    if (!path.startsWith("/api/")) return next();
    const allowed = path === "/api/health" ||
      path === "/api/auth/me" || path === "/api/auth/logout" ||
      path === "/api/public/branding" || path.startsWith("/api/public/branding-icon/") ||
      path.startsWith("/api/public/branding-asset/") || path.startsWith("/api/public/branding-image/") ||
      path.startsWith("/api/seller/") || path.startsWith("/api/marketplace/");
    if (!allowed) return res.status(404).json({ error: "Bu servis yalnızca tedarikçi işlemleri içindir." });
    next();
  });
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: "15mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
const PgSession = connectPgSimple(session);

app.use(session({
  ...(pool
    ? {
        store: new PgSession({
          pool,
          tableName: "user_sessions",
          createTableIfMissing: true,
        }),
      }
    : {}),
  secret: process.env.SESSION_SECRET || "local-rma-panel-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));
app.use("/uploads", express.static(uploadsDir));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const safeResponse =
          capturedJsonResponse && typeof capturedJsonResponse === "object"
            ? { ...capturedJsonResponse, ...(capturedJsonResponse.token ? { token: "[redacted]" } : {}) }
            : capturedJsonResponse;
        logLine += ` :: ${JSON.stringify(safeResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const listenOptions: { port: number; host: string; reusePort?: boolean } = {
    port,
    host: "0.0.0.0",
  };
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }
  server.listen(listenOptions, () => {
    log(`serving on http://localhost:${port}`);
  });
})();
