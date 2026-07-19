import path from "path";
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { setSocketIO, seedOmnichannelData } from "./server/messagingHub";
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
  await ensureCatalogSeedData();
  markApplicationReady();

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ["GET", "POST", "PATCH", "DELETE"],
    },
  });

  setSocketIO(io);
  setupGracefulShutdown(httpServer);

  httpServer.listen(PORT, "0.0.0.0", () => {
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
