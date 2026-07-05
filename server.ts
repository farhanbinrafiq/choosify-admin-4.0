import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { messagingRouter, setSocketIO, seedOmnichannelData, handleMetaWebhookPost } from "./server/messagingHub";
import { logisticsRouter } from "./server/logisticsRouter";
import { catalogRouter } from "./server/catalogRouter";
import { operationsRouter } from "./server/operationsRouter";
import { authRouter } from "./server/authRouter";
import { attachOperationsPersistence, ensureOperationsHydrated } from "./server/operations/operationsPersistence";
import { getAnalyticsSummary } from "./server/operations/analyticsService";
import { ensureCatalogSeedData } from "./lib/vercel-catalog/catalogStore";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3001;

  // Meta webhooks need the raw body for signature verification (before JSON parser)
  app.post(
    "/api/webhooks/meta",
    express.raw({ type: "application/json" }),
    handleMetaWebhookPost,
  );

  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // Mount Unified Omnichannel Messaging APIs and Webhooks
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
    console.log("POST /api/products called with payload:", req.body);
    res.status(201).json({
      success: true,
      message: "Deprecated endpoint. Use /api/v1/catalog/products",
      productId: "prod_" + Math.random().toString(36).substring(2, 11),
      product: req.body
    });
  });

  app.put("/api/products/:id", (req, res) => {
    console.log(`PUT /api/products/${req.params.id} called with payload:`, req.body);
    res.json({
      success: true,
      message: "Deprecated endpoint. Use /api/v1/catalog/products/:id",
      productId: req.params.id,
      product: req.body
    });
  });

  app.patch("/api/products/:id", (req, res) => {
    console.log(`PATCH /api/products/${req.params.id} called with payload:`, req.body);
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

  // Pre-seed Firestore with beautiful messaging sandbox dataset
  attachOperationsPersistence();
  await ensureOperationsHydrated();
  await seedOmnichannelData();
  await ensureCatalogSeedData();

  // Create HTTP Server & attach Socket.io
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PATCH", "DELETE"]
    }
  });

  setSocketIO(io);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
