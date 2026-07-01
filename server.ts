import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { messagingRouter, setSocketIO, seedOmnichannelData } from "./server/messagingHub";
import { logisticsRouter } from "./server/logisticsRouter";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mount Unified Omnichannel Messaging APIs and Webhooks
  app.use("/api", messagingRouter);
  app.use("/api", logisticsRouter);

  // API stats route
  app.get("/api/admin/stats", async (req, res) => {
    // In production, this would use Firebase Admin to count docs
    res.json({
      totalUsers: 48291,
      activeUsers: 14032,
      sellers: 1847,
      creators: 342,
      products: 94520,
      revenue: 3200000,
      engagement: 12.4,
      pendingModeration: 127
    });
  });

  // REST endpoints for creating and updating products as requested
  app.post("/api/products", (req, res) => {
    console.log("POST /api/products called with payload:", req.body);
    res.status(201).json({
      success: true,
      message: "Product created successfully",
      productId: "prod_" + Math.random().toString(36).substring(2, 11),
      product: req.body
    });
  });

  app.put("/api/products/:id", (req, res) => {
    console.log(`PUT /api/products/${req.params.id} called with payload:`, req.body);
    res.json({
      success: true,
      message: "Product fully updated successfully",
      productId: req.params.id,
      product: req.body
    });
  });

  app.patch("/api/products/:id", (req, res) => {
    console.log(`PATCH /api/products/${req.params.id} called with payload:`, req.body);
    res.json({
      success: true,
      message: "Product partially updated successfully",
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
  await seedOmnichannelData();

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
