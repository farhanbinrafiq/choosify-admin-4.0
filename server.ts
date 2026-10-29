import { reconcileVerifiedBadgesOnce } from "./server/claims/verifiedBadgeReconcile";
import { anonymizeDueAccounts } from "./server/auth/accountLifecycle";
import path from "path";
import express from "express";
import { createServer } from "http";
import { bootstrapMessagingJobs, seedOmnichannelData } from "./server/messagingHub";
import { bootstrapConversationEventSubscribers } from "./server/messaging/conversations/conversationEvents";
import { ensureConversationMemoryHydrated } from "./server/messaging/conversations/conversationMemoryBackend";
import { attachOperationsPersistence, ensureOperationsHydrated } from "./server/operations/operationsPersistence";
import { ensureCatalogSeedData } from "./lib/vercel-catalog/catalogStore";
import { Logger } from "./server/lib/logger";
import { markApplicationReady } from "./server/lib/readiness";
import { logStartupDiagnostics } from "./server/lib/startupDiagnostics";
import { getAllowedOrigins } from "./server/middleware/cors";
import { setupGracefulShutdown } from "./server/middleware/gracefulShutdown";
import { createApp, attachErrorHandler } from "./server/app";

const LOADED_MODULES = [
  "health",
  "diagnostics",
  "analytics",
  "moderation",
  "search",
  "communication",
  "ai",
  "emi",
  "messaging",
  "logistics",
  "catalog",
  "operations",
  "auth",
  "admin-stats",
] as const;

async function startServer() {
  const app = createApp();
  const PORT = Number(process.env.PORT) || 3001;
  const HOST = process.env.HOST || "127.0.0.1";

  // Never let browsers keep a stale cms-mirror shell (Brand/Creator Studio blank pane).
  app.use("/cms-mirror/app.html", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    next();
  });

  // Vite middleware for development; static SPA in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // dist/ also holds the server bundle (server.cjs + its source map): never
    // serve it, or any source map. Checked on the decoded, normalized path so
    // "../" and %2e%2e spellings are caught too.
    app.use((req, res, next) => {
      let file = req.path;
      try {
        file = path.posix.basename(path.posix.normalize(decodeURIComponent(req.path)));
      } catch {
        res.status(400).end();
        return;
      }
      if (/^server\.cjs/i.test(file) || /\.map$/i.test(file)) {
        res.status(404).end();
        return;
      }
      next();
    });
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      // Unknown API routes are a JSON 404, not the SPA shell.
      if (req.path.startsWith("/api/")) {
        res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
        return;
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  attachErrorHandler(app);

  attachOperationsPersistence();
  await ensureOperationsHydrated();
  await seedOmnichannelData();
  await bootstrapMessagingJobs();
  ensureConversationMemoryHydrated();
  bootstrapConversationEventSubscribers();
  await ensureCatalogSeedData();
  // One-time: the Verified badge now needs an approved document verification.
  await reconcileVerifiedBadgesOnce().catch((error) =>
    Logger.error("verified badge reconciliation failed", { message: error instanceof Error ? error.message : String(error) }),
  );
  markApplicationReady();
  // Accounts past their 90-day deletion window are anonymized (now, then every 6 hours).
  const runAnonymization = () =>
    anonymizeDueAccounts().catch((error) =>
      Logger.error("account anonymization run failed", { message: error instanceof Error ? error.message : String(error) }),
    );
  void runAnonymization();
  setInterval(() => void runAnonymization(), 6 * 60 * 60 * 1000).unref();

  // Plain HTTP server (no Socket.IO) — realtime messaging uses Firestore onSnapshot.
  const httpServer = createServer(app);
  setupGracefulShutdown(httpServer);

  httpServer.listen(PORT, HOST, () => {
    logStartupDiagnostics({
      port: PORT,
      allowedOrigins: getAllowedOrigins(),
      loadedModules: [...LOADED_MODULES],
    });
  });
}

startServer().catch((error) => {
  Logger.error("Failed to start server", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
