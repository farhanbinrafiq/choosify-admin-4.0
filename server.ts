import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { messagingRouter, setSocketIO, seedOmnichannelData } from "./server/messagingHub";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mount Unified Omnichannel Messaging APIs and Webhooks
  app.use("/api", messagingRouter);

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
