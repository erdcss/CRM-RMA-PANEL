import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectB2BPreviewHtml, isB2BPreviewRequest, resolveB2BPreview } from "./b2b-link-preview";

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Do not serve the generic index.html directly for the B2B homepage.
  // Share crawlers must receive route-specific metadata on the initial HTTP response.
  const indexPath = path.resolve(distPath, "index.html");
  const indexHtml = fs.readFileSync(indexPath, "utf-8");
  app.use(express.static(distPath, { index: false }));

  app.use("*", async (req, res, next) => {
    if (!isB2BPreviewRequest(req)) return res.sendFile(indexPath);
    try {
      const preview = await resolveB2BPreview(req.path);
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.type("html");
      return res.send(injectB2BPreviewHtml(indexHtml, preview));
    } catch (error) {
      console.error("B2B social preview metadata failed:", error);
      // Fail safely to the brand metadata, never the generic admin description.
      try {
        const preview = await resolveB2BPreview("/");
        res.setHeader("Cache-Control", "no-store, max-age=0");
        res.type("html");
        return res.send(injectB2BPreviewHtml(indexHtml, preview));
      } catch (fallbackError) { return next(fallbackError); }
    }
  });
}
