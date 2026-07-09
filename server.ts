import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer } from "http";
import compression from "compression";
import { Server as SocketIOServer } from "socket.io";
import { messagingRouter, setSocketIO, seedOmnichannelData, handleMetaWebhookPost } from "./server/messagingHub";
import { logisticsRouter } from "./server/logisticsRouter";
import { catalogRouter } from "./server/catalogRouter";
import { operationsRouter } from "./server/operationsRouter";
import { authRouter } from "./server/authRouter";
import { attachOperationsPersistence, ensureOperationsHydrated } from "./server/operations/operationsPersistence";
import { getAnalyticsSummary } from "./server/operations/analyticsService";
import { ensureCatalogSeedData } from "./lib/vercel-catalog/catalogStore";
import { Logger } from "./server/lib/logger";
import { validateEnvironment } from "./server/lib/env";
import { markApplicationReady } from "./server/lib/readiness";
import { logStartupDiagnostics } from "./server/lib/startupDiagnostics";
import { createHelmetMiddleware } from "./server/lib/helmetConfig";
import { requestIdMiddleware } from "./server/middleware/requestId";
import { requestTimingMiddleware } from "./server/middleware/requestTiming";
import { createCorsMiddleware, getAllowedOrigins } from "./server/middleware/cors";
import { errorHandler } from "./server/middleware/errorHandler";
import { setupGracefulShutdown } from "./server/middleware/gracefulShutdown";
import {
  JSON_BODY_LIMIT,
  RAW_BODY_LIMIT,
  URLENCODED_BODY_LIMIT,
  payloadTooLargeHandler,
} from "./server/middleware/payloadLimits";
import {
  adminRateLimit,
  authRateLimit,
  catalogReadRateLimitMiddleware,
  messagingRateLimit,
  publicApiRateLimit,
  searchRateLimitMiddleware,
} from "./server/middleware/rateLimit";
import { analyticsRouter } from "./server/analytics/analyticsRouter";
import { moderationRouter } from "./server/moderation/moderationRouter";
import { searchRouter } from "./server/search/searchRouter";
import { healthRouter } from "./server/routes/health";
import { diagnosticsRouter } from "./server/routes/diagnostics";

const LOADED_MODULES = [
  "health",
  "diagnostics",
  "analytics",
  "moderation",
  "search",
  "messaging",
  "logistics",
  "catalog",
  "operations",
  "auth",
  "admin-stats",
] as const;

dotenv.config();
validateEnvironment();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3001;

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(requestTimingMiddleware);
  app.use(createHelmetMiddleware());
  app.use(compression());
  app.use(healthRouter);
  app.use(diagnosticsRouter);

  // Meta webhooks need the raw body for signature verification (before JSON parser)
  app.post(
    "/api/webhooks/meta",
    express.raw({ type: "application/json", limit: RAW_BODY_LIMIT }),
    handleMetaWebhookPost,
  );

  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: URLENCODED_BODY_LIMIT }));
  app.use(payloadTooLargeHandler);
  app.use(createCorsMiddleware());

  // Rate limiting — specific policies before public fallback
  app.use("/api/v1/auth", authRateLimit);
  app.use("/api/messaging", messagingRateLimit);
  app.use("/api/conversations", messagingRateLimit);
  app.use("/api/messages", messagingRateLimit);
  app.use("/api/agents", messagingRateLimit);
  app.use("/api/admin", adminRateLimit);
  app.use("/api/v1/catalog/products", searchRateLimitMiddleware);
  app.use("/api/v1/catalog", catalogReadRateLimitMiddleware);
  app.use("/api", publicApiRateLimit);

  // Mount Unified Omnichannel Messaging APIs and Webhooks
  app.use("/api", analyticsRouter);
  app.use("/api", moderationRouter);
  app.use("/api", searchRouter);
  app.use("/api", messagingRouter);
  app.use("/api", logisticsRouter);
  app.use("/api/v1", catalogRouter);
  app.use("/api/v1", operationsRouter);
  app.use("/api/v1", authRouter);

  // API stats route — backed by live operations analytics when available
  app.get("/api/admin/stats", async (_req, res) => {
    const summary = getAnalyticsSummary("30d");
    res.json({
      totalUsers: 48291,
      activeUsers: 14032,
      sellers: 1847,
      creators: 342,
      products: 94520,
      revenue: summary.orders.revenue,
      engagement: summary.orders.total > 0 ? 12.4 : 0,
      pendingModeration: summary.reviews.pending,
      storefrontOrders: summary.orders.total,
      newLeads: summary.leads.new,
      activeShipments: summary.shipments.pending,
    });
  });

  // REST endpoints for creating and updating products as requested
  app.post("/api/products", (req, res) => {
    Logger.info("Deprecated product endpoint called", {
      requestId: req.requestId,
      method: "POST",
      path: "/api/products",
      payloadKeys: Object.keys(req.body || {}),
    });
    res.status(201).json({
      success: true,
      message: "Deprecated endpoint. Use /api/v1/catalog/products",
      productId: "prod_" + Math.random().toString(36).substring(2, 11),
      product: req.body
    });
  });

  app.put("/api/products/:id", (req, res) => {
    Logger.info("Deprecated product endpoint called", {
      requestId: req.requestId,
      method: "PUT",
      path: `/api/products/${req.params.id}`,
      payloadKeys: Object.keys(req.body || {}),
    });
    res.json({
      success: true,
      message: "Deprecated endpoint. Use /api/v1/catalog/products/:id",
      productId: req.params.id,
      product: req.body
    });
  });

  app.patch("/api/products/:id", (req, res) => {
    Logger.info("Deprecated product endpoint called", {
      requestId: req.requestId,
      method: "PATCH",
      path: `/api/products/${req.params.id}`,
      payloadKeys: Object.keys(req.body || {}),
    });
    res.json({
      success: true,
      message: "Deprecated endpoint. Use /api/v1/catalog/products/:id",
      productId: req.params.id,
      product: req.body
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use(errorHandler);

  // Pre-seed Firestore with beautiful messaging sandbox dataset
  attachOperationsPersistence();
  await ensureOperationsHydrated();
  await seedOmnichannelData();
  await ensureCatalogSeedData();
  markApplicationReady();

  // Create HTTP Server & attach Socket.io
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ["GET", "POST", "PATCH", "DELETE"]
    }
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
