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
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
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
  markApplicationReady();

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
